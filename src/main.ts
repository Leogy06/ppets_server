import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { parseConfig } from './core/config';
import { configureApp } from './core/http';

async function bootstrap(): Promise<void> {
  if (existsSync('.env.development')) process.loadEnvFile('.env.development');
  const config = parseConfig(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  configureApp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'server_started',
      port: config.PORT,
    }),
  );
}
void bootstrap().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'startup_failed',
      message: error instanceof Error ? error.message : 'Startup failed',
    }),
  );
  process.exitCode = 1;
});
