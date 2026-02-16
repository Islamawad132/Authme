import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import { EventsService } from './events.service.js';
import { ResourceType, OperationType } from './event-types.js';
import type { OperationTypeValue, ResourceTypeValue } from './event-types.js';

const RESOURCE_TYPE_MAP: Array<{ pattern: RegExp; type: ResourceTypeValue }> = [
  { pattern: /\/users/, type: ResourceType.USER },
  { pattern: /\/clients/, type: ResourceType.CLIENT },
  { pattern: /\/roles/, type: ResourceType.ROLE },
  { pattern: /\/groups/, type: ResourceType.GROUP },
  { pattern: /\/client-scopes/, type: ResourceType.SCOPE },
  { pattern: /\/identity-providers/, type: ResourceType.IDP },
];

const METHOD_TO_OPERATION: Record<string, OperationTypeValue> = {
  POST: OperationType.CREATE,
  PUT: OperationType.UPDATE,
  PATCH: OperationType.UPDATE,
  DELETE: OperationType.DELETE,
};

@Injectable()
export class AdminEventInterceptor implements NestInterceptor {
  constructor(private readonly eventsService: EventsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next.handle();
    if (!request.path.startsWith('/admin/')) return next.handle();

    // Skip events API and auth endpoints
    if (request.path.includes('/events') || request.path.includes('/admin-events')) {
      return next.handle();
    }
    if (request.path.includes('/admin/auth/')) return next.handle();

    const realm = (request as any).realm;
    const adminUser = (request as any).adminUser;

    if (!realm || !adminUser) return next.handle();

    const operationType = METHOD_TO_OPERATION[method];
    if (!operationType) return next.handle();

    const resourceType = this.resolveResourceType(request.path);
    if (!resourceType) return next.handle();

    const representation = method !== 'DELETE' ? this.redactBody(request.body) : undefined;

    return next.handle().pipe(
      tap(() => {
        this.eventsService.recordAdminEvent({
          realmId: realm.id,
          adminUserId: adminUser.userId ?? adminUser.id ?? 'api-key',
          operationType,
          resourceType,
          resourcePath: request.path,
          representation,
          ipAddress: request.ip,
        });
      }),
    );
  }

  private resolveResourceType(path: string): ResourceTypeValue | null {
    for (const entry of RESOURCE_TYPE_MAP) {
      if (entry.pattern.test(path)) return entry.type;
    }
    return null;
  }

  private redactBody(body: any): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const redacted = { ...body };
    const sensitiveKeys = ['password', 'clientSecret', 'smtpPassword', 'client_secret', 'currentPassword', 'newPassword'];
    for (const key of sensitiveKeys) {
      if (key in redacted) redacted[key] = '[REDACTED]';
    }
    return redacted;
  }
}
