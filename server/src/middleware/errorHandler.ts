import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { AuditService } from '../services/audit.service.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.requestId || (req.headers['x-request-id'] as string) || 'req_unknown';

  // 1. Handle Multer file upload errors
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      // Must return HTTP 413 Payload Too Large as specified in requirements
      AuditService.logEvent({
        actorId: req.user?.id || 'UNAUTHENTICATED',
        actorEmail: req.user?.email,
        actorRole: req.user?.role,
        action: 'UPLOAD_REJECTED',
        outcome: 'FAILED',
        requestId,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        details: { reason: 'LIMIT_FILE_SIZE: Upload exceeded 1,000,000 bytes hard limit' }
      }).catch(() => {});

      res.status(413).json({
        type: 'https://trustvault.internal/errors/payload-too-large',
        title: 'Payload Too Large',
        status: 413,
        detail: 'The uploaded file exceeds the strict maximum limit of 1,000,000 bytes.',
        requestId
      });
      return;
    }

    res.status(400).json({
      type: 'https://trustvault.internal/errors/bad-upload',
      title: 'Malformed Upload Request',
      status: 400,
      detail: `Upload processing error: ${err.message}`,
      requestId
    });
    return;
  }

  // 2. Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      type: 'https://trustvault.internal/errors/validation-error',
      title: 'Request Validation Failed',
      status: 422,
      detail: 'The submitted request payload failed schema validation.',
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      })),
      requestId
    });
    return;
  }

  // 3. Handle JSON parse errors
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({
      type: 'https://trustvault.internal/errors/invalid-json',
      title: 'Malformed JSON Payload',
      status: 400,
      detail: 'The request body could not be parsed as valid JSON.',
      requestId
    });
    return;
  }

  // 4. Default: Sanitized Internal Server Error (Never leak stack traces)
  console.error(`[Unhandled Error] [${requestId}]:`, err);

  res.status(err.status || 500).json({
    type: 'https://trustvault.internal/errors/internal-error',
    title: 'Internal Server Error',
    status: err.status || 500,
    detail: process.env.NODE_ENV === 'test' ? err.message : 'An unexpected server error occurred. Please contact the security team with the requestId.',
    requestId
  });
}
