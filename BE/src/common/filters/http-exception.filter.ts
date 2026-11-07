import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      console.error('[HttpExceptionFilter] Unhandled Exception:', exception);
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as any)?.message || 'Internal server error';

    const errorDetails =
      typeof rawMessage === 'string'
        ? { message: rawMessage }
        : rawMessage;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      error: errorDetails,
    });
  }
}
