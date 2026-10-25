import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { APP_CONFIG } from '../core/tokens';
import type { AppConfig } from '../core/config';
export interface MailMessage {
  to: string;
  purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD';
  url: string;
}
export interface MailSender {
  send(message: MailMessage): Promise<void>;
}
@Injectable()
export class FileMailSender implements MailSender {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}
  async send(message: MailMessage): Promise<void> {
    const directory = resolve(this.config.EMAIL_STUB_DIR);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(
      join(directory, `${randomUUID()}.json`),
      JSON.stringify(message),
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    );
  }
}
