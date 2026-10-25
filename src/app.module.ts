import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './core/health.controller';
import { DatabaseService } from './database/database.service';
import { parseConfig } from './core/config';
import { APP_CONFIG, MAIL_SENDER } from './core/tokens';
import { AuthGuard } from './core/auth.guard';
import { AuthService } from './mvp/auth.service';
import { AuthController } from './mvp/auth.controller';
import { FileMailSender } from './mvp/mail';
import { AssetsController } from './mvp/assets.controller';
import { AssetsService } from './mvp/assets.service';

@Module({
  controllers: [HealthController, AuthController, AssetsController],
  providers: [
    DatabaseService,
    { provide: APP_CONFIG, useFactory: () => parseConfig(process.env) },
    { provide: MAIL_SENDER, useClass: FileMailSender },
    AuthService,
    AssetsService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
