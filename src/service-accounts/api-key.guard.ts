import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ServiceAccountsService } from './service-accounts.service.js';

/**
 * Guard that validates API keys passed via the `X-Api-Key` header.
 * The header value must be the full plain key returned at creation time.
 * The first 8 characters are used as a lookup prefix; the full value is
 * verified against the stored Argon2 hash.
 *
 * On success the resolved ApiKey record (with its ServiceAccount) is
 * attached to `request.apiKey` for downstream use.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly serviceAccountsService: ServiceAccountsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-api-key'];
    const plainKey = Array.isArray(header) ? header[0] : header;

    if (!plainKey || plainKey.length < 8) {
      throw new UnauthorizedException('Missing or malformed X-Api-Key header');
    }

    const keyPrefix = plainKey.slice(0, 8);
    const apiKey = await this.serviceAccountsService.validateApiKey(keyPrefix, plainKey);

    (request as Request & { apiKey: typeof apiKey }).apiKey = apiKey;
    return true;
  }
}
