import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //cookie parser
  app.use(cookieParser()); // enable reading cookies
  app.enableCors({
    origin: process.env.CLIENT_BASEURL, //client url
    credentials: true, //allowing cookies
  });

  const port = process.env.PORT || 4001;
  await app.listen(port);
  console.log(`App is listening on Port ${port}`);
}
bootstrap();
