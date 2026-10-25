import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { AppError } from '../core/app-error';
import { Policy } from '../core/policy';
import type { AppRequest, SessionUser } from '../core/types';
import { parseRequest } from '../core/validation';
import {
  AssetsService,
  assetQuerySchema,
  requestQuerySchema,
  createRequestSchema,
  requestIdSchema,
} from './assets.service';
function identity(req: AppRequest): SessionUser {
  if (!req.user)
    throw new AppError('UNAUTHENTICATED', 401, 'Authentication is required.');
  return req.user;
}
@Controller('api')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}
  @Get('summary')
  @Policy('assets:read')
  summary(@Req() req: AppRequest) {
    parseRequest(req);
    return this.assets.summary(identity(req));
  }
  @Get('assets')
  @Policy('assets:read')
  listAssets(@Req() req: AppRequest) {
    const { query } = parseRequest(req, undefined, assetQuerySchema);
    return this.assets.listAssets(identity(req), query);
  }
  @Get('requests')
  @Policy('requests:list')
  listRequests(@Req() req: AppRequest) {
    const { query } = parseRequest(req, undefined, requestQuerySchema);
    return this.assets.listRequests(identity(req), query);
  }
  @Post('requests')
  @Policy('requests:create')
  createRequest(@Req() req: AppRequest) {
    const { body } = parseRequest(req, createRequestSchema);
    return this.assets.createRequest(identity(req), body);
  }
  @Post('requests/:id/approve')
  @HttpCode(200)
  @Policy('requests:approve')
  approve(@Req() req: AppRequest) {
    const { params } = parseRequest(req, undefined, undefined, requestIdSchema);
    return this.assets.approve(identity(req), params.id);
  }
  @Post('requests/:id/return')
  @HttpCode(200)
  @Policy('requests:return')
  returnRequest(@Req() req: AppRequest) {
    const { params } = parseRequest(req, undefined, undefined, requestIdSchema);
    return this.assets.returnRequest(identity(req), params.id);
  }
  @Post('requests/:id/reject')
  @HttpCode(200)
  @Policy('requests:reject')
  reject(@Req() req: AppRequest) {
    const { params } = parseRequest(req, undefined, undefined, requestIdSchema);
    return this.assets.reject(identity(req), params.id);
  }
  @Post('requests/:id/cancel')
  @HttpCode(200)
  @Policy('requests:cancel')
  cancel(@Req() req: AppRequest) {
    const { params } = parseRequest(req, undefined, undefined, requestIdSchema);
    return this.assets.cancel(identity(req), params.id);
  }
}
