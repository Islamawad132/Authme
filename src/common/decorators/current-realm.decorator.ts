import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Realm } from '@prisma/client';

export const CurrentRealm = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Realm => {
    const request = ctx.switchToHttp().getRequest();
    return request.realm;
  },
);
