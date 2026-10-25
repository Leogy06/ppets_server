import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { parseRequest } from './validation';
import { Policy } from './policy';
@Controller()
export class HealthController {
  @Policy('public')
  @Get('health')
  health(@Req() req: Request) {
    parseRequest(req);
    return { status: 'ok' };
  }
}
