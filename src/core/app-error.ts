import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import type { AppRequest } from './types';
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const httpCodes: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};
export function sendError(
  error: unknown,
  req: AppRequest,
  res: Response,
): void {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  if (error instanceof AppError) {
    ({ status, code, message } = error);
  } else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed.';
  } else if (error instanceof HttpException) {
    status = error.getStatus();
    code = httpCodes[status] ?? 'HTTP_ERROR';
    message =
      status === 404
        ? 'Resource not found.'
        : status < 500
          ? 'Request could not be completed.'
          : message;
  } else if (typeof error === 'object' && error !== null && 'code' in error) {
    const prismaCode = (error as { code: unknown }).code;
    if (prismaCode === 'P2002') {
      status = 409;
      code = 'CONFLICT';
      message = 'A record already exists.';
    }
    if (prismaCode === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Resource not found.';
    }
    if (prismaCode === 'P2003') {
      status = 400;
      code = 'INVALID_REFERENCE';
      message = 'Referenced record is invalid.';
    }
    if (prismaCode === 'P2034') {
      status = 409;
      code = 'CONFLICT';
      message = 'Please retry the operation.';
    }
  }
  if (status >= 500)
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'request_failed',
        requestId: req.requestId,
        stack: error instanceof Error ? error.stack : 'Unknown exception',
      }),
    );
  res
    .status(status)
    .json({ error: { code, message, requestId: req.requestId } });
}
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    sendError(
      error,
      http.getRequest<AppRequest>(),
      http.getResponse<Response>(),
    );
  }
}
