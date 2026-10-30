import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * QA N8: same limits as ThrottlerGuard, but a client-friendly 429 body with a stable code the apps localize,
 * instead of the raw "ThrottlerException: Too Many Requests".
 */
@Injectable()
export class GotchaThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw new HttpException(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
