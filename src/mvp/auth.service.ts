import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import type { AppConfig } from '../core/config';
import { AppError } from '../core/app-error';
import { APP_CONFIG, MAIL_SENDER } from '../core/tokens';
import type { SessionUser } from '../core/types';
import { DatabaseService } from '../database/database.service';
import type { MailSender } from './mail';

export type PublicUser = SessionUser;
type Account = Prisma.usersGetPayload<{ include: { employee: true } }>;
const signupMessage = {
  message: 'If this account needs verification, an email has been sent.',
};
const forgotMessage = {
  message: 'If this account is eligible, a password reset email has been sent.',
};
const dummyHash =
  '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
const emailSchema = z.email().max(255);
const validPassword = (value: string) =>
  typeof value === 'string' &&
  value.length >= 12 &&
  Buffer.byteLength(value, 'utf8') <= 72;
const validToken = (value?: string): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
  ) {}
  private email(value: string): string {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!emailSchema.safeParse(email).success)
      throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed.');
    return email;
  }
  private hash(token: string): string {
    return createHmac('sha256', this.config.SESSION_SECRET)
      .update(token)
      .digest('hex');
  }
  private eligible(user: Account | null): user is Account {
    return (
      !!user &&
      user.is_active === 1 &&
      !!user.emailVerifiedAt &&
      !!user.email &&
      !!user.employee &&
      user.employee.DELETED !== 1 &&
      (user.role === 1 || user.role === 2)
    );
  }
  private publicUser(user: Account): SessionUser {
    return {
      id: user.id,
      employeeId: user.emp_id,
      departmentId:
        user.employee.CURRENT_DPT_ID ?? user.employee.DEPARTMENT_ID ?? 1,
      email: user.email!,
      name: [user.employee.FIRSTNAME, user.employee.LASTNAME]
        .filter(Boolean)
        .join(' '),
      role: user.role === 1 ? 'admin' : 'member',
    };
  }
  private async sendToken(
    userId: number,
    to: string,
    purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
  ): Promise<void> {
    const token = randomBytes(32).toString('hex');
    const duration =
      purpose === 'VERIFY_EMAIL' ? 24 * 60 * 60_000 : 30 * 60_000;
    await this.db.authToken.create({
      data: {
        tokenHash: this.hash(token),
        userId,
        purpose,
        expiresAt: new Date(Date.now() + duration),
      },
    });
    await this.deliverToken(to, purpose, token);
  }
  private async deliverToken(
    to: string,
    purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
    token: string,
  ): Promise<void> {
    const origin = this.config.CLIENT_BASEURL.split(',')[0].trim();
    const url = `${origin}/mvp/?${purpose === 'VERIFY_EMAIL' ? 'verify' : 'reset'}=${token}`;
    try {
      await this.mail.send({ to, purpose, url });
    } catch {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'mail_delivery_failed',
          purpose,
        }),
      );
    }
  }
  async signup(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ message: string }> {
    const email = this.email(input.email);
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 120 || !validPassword(input.password))
      throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed.');
    let user = await this.db.users.findUnique({
      where: { email },
      include: { employee: true },
    });
    const hashed = await bcrypt.hash(input.password, 12);
    const [first, ...rest] = name.split(/\s+/);
    const persistIntent = (existing: Account | null) =>
      this.db.$transaction(async (tx) => {
        let pending = existing;
        if (pending) {
          // A repeat signup and verification must serialize on the same row.
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${pending.id} FOR UPDATE`;
          pending = await tx.users.findUnique({
            where: { id: pending.id },
            include: { employee: true },
          });
          if (
            !pending ||
            pending.emailVerifiedAt ||
            pending.is_active !== 1 ||
            pending.role !== 2 ||
            pending.employee.DELETED === 1
          )
            return null;
          await tx.users.update({
            where: { id: pending.id },
            data: {
              password: hashed,
              employee: {
                update: { FIRSTNAME: first, LASTNAME: rest.join(' ') },
              },
            },
          });
        } else {
          pending = await tx.users.create({
            data: {
              email,
              password: hashed,
              role: 2,
              is_active: 1,
              emailVerifiedAt: null,
              employee: {
                create: {
                  ID_NUMBER: randomInt(1, 2_000_000_001),
                  FIRSTNAME: first,
                  LASTNAME: rest.join(' '),
                  DEPARTMENT_ID: 1,
                  CURRENT_DPT_ID: 1,
                  DELETED: 0,
                },
              },
            },
            include: { employee: true },
          });
        }
        // Credential replacement and token replacement are one committed intent.
        await tx.authToken.deleteMany({
          where: { userId: pending.id, purpose: 'VERIFY_EMAIL' },
        });
        const token = randomBytes(32).toString('hex');
        await tx.authToken.create({
          data: {
            tokenHash: this.hash(token),
            userId: pending.id,
            purpose: 'VERIFY_EMAIL',
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
          },
        });
        return token;
      });
    let token: string | null;
    try {
      token = await persistIntent(user);
    } catch (error) {
      if (
        user ||
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'P2002'
      )
        throw error;
      // A concurrent first signup may have won the unique email insert.
      user = await this.db.users.findUnique({
        where: { email },
        include: { employee: true },
      });
      if (!user) throw error;
      token = await persistIntent(user);
    }
    if (token) await this.deliverToken(email, 'VERIFY_EMAIL', token);
    return { ...signupMessage };
  }
  async verify(token: string): Promise<{ message: string }> {
    if (!validToken(token))
      throw new AppError(
        'INVALID_TOKEN',
        400,
        'This link is invalid or expired.',
      );
    await this.db.$transaction(async (tx) => {
      const now = new Date();
      const stored = await tx.authToken.findUnique({
        where: { tokenHash: this.hash(token) },
      });
      if (
        !stored ||
        stored.purpose !== 'VERIFY_EMAIL' ||
        stored.expiresAt <= now
      )
        throw new AppError(
          'INVALID_TOKEN',
          400,
          'This link is invalid or expired.',
        );
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${stored.userId} FOR UPDATE`;
      const consumed = await tx.authToken.deleteMany({
        where: {
          tokenHash: this.hash(token),
          purpose: 'VERIFY_EMAIL',
          expiresAt: { gt: now },
        },
      });
      if (consumed.count !== 1)
        throw new AppError(
          'INVALID_TOKEN',
          400,
          'This link is invalid or expired.',
        );
      await tx.users.update({
        where: { id: stored.userId },
        data: { emailVerifiedAt: now },
      });
    });
    return { message: 'Email verified. You can now sign in.' };
  }
  async login(
    input: { email: string; password: string },
    currentToken?: string,
  ): Promise<{ user: SessionUser; token: string }> {
    const invalid = () =>
      new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password.');
    if (!validPassword(input.password)) throw invalid();
    let email: string;
    try {
      email = this.email(input.email);
    } catch {
      throw invalid();
    }
    const user = await this.db.users.findUnique({
      where: { email },
      include: { employee: true },
    });
    const correct = await bcrypt.compare(
      input.password,
      user?.password ?? dummyHash,
    );
    if (!correct || !this.eligible(user)) throw invalid();
    const token = randomBytes(32).toString('hex');
    await this.db.$transaction(async (tx) => {
      // Serialize issuance against password resets. Compare the password that was
      // checked outside the transaction with a fresh, locked database row.
      const rows = await tx.$queryRaw<
        Pick<
          Account,
          'id' | 'password' | 'is_active' | 'emailVerifiedAt' | 'role'
        >[]
      >`
        SELECT id, password, is_active, emailVerifiedAt, role
        FROM users WHERE id = ${user.id} FOR UPDATE
      `;
      const locked = rows[0];
      if (
        !locked ||
        locked.password !== user.password ||
        locked.role !== user.role ||
        !this.eligible({ ...user, ...locked })
      )
        throw invalid();
      if (validToken(currentToken))
        await tx.authSession.deleteMany({
          where: { tokenHash: this.hash(currentToken) },
        });
      await tx.authSession.create({
        data: {
          tokenHash: this.hash(token),
          userId: user.id,
          expiresAt: new Date(
            Date.now() + this.config.SESSION_TTL_HOURS * 60 * 60_000,
          ),
        },
      });
    });
    return { user: this.publicUser(user), token };
  }
  async logout(token?: string): Promise<void> {
    if (validToken(token))
      await this.db.authSession.deleteMany({
        where: { tokenHash: this.hash(token) },
      });
  }
  async authenticate(token?: string): Promise<SessionUser | null> {
    if (!validToken(token)) return null;
    const session = await this.db.authSession.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: { include: { employee: true } } },
    });
    if (
      !session ||
      session.expiresAt <= new Date() ||
      !this.eligible(session.user)
    )
      return null;
    return this.publicUser(session.user);
  }
  async forgotPassword(input: string): Promise<{ message: string }> {
    const email = this.email(input);
    const user = await this.db.users.findUnique({
      where: { email },
      include: { employee: true },
    });
    if (this.eligible(user))
      await this.sendToken(user.id, email, 'RESET_PASSWORD');
    return { ...forgotMessage };
  }
  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ message: string }> {
    if (!validPassword(password))
      throw new AppError('VALIDATION_ERROR', 400, 'Request validation failed.');
    if (!validToken(token))
      throw new AppError(
        'INVALID_TOKEN',
        400,
        'This link is invalid or expired.',
      );
    const hashed = await bcrypt.hash(password, 12);
    await this.db.$transaction(async (tx) => {
      const now = new Date();
      const stored = await tx.authToken.findUnique({
        where: { tokenHash: this.hash(token) },
      });
      if (
        !stored ||
        stored.purpose !== 'RESET_PASSWORD' ||
        stored.expiresAt <= now
      )
        throw new AppError(
          'INVALID_TOKEN',
          400,
          'This link is invalid or expired.',
        );
      const consumed = await tx.authToken.deleteMany({
        where: {
          tokenHash: this.hash(token),
          purpose: 'RESET_PASSWORD',
          expiresAt: { gt: now },
        },
      });
      if (consumed.count !== 1)
        throw new AppError(
          'INVALID_TOKEN',
          400,
          'This link is invalid or expired.',
        );
      await tx.users.update({
        where: { id: stored.userId },
        data: { password: hashed },
      });
      await tx.authSession.deleteMany({ where: { userId: stored.userId } });
      await tx.authToken.deleteMany({
        where: { userId: stored.userId, purpose: 'RESET_PASSWORD' },
      });
    });
    return {
      message: 'Password reset. Please sign in with your new password.',
    };
  }
}
