import {
  Controller,
  Post,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Realm } from '@prisma/client';
import { ImpersonationService } from './impersonation.service.js';
import { EndImpersonationBodyDto } from './dto/end-impersonation.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

function getAdminUserId(req: Request): string {
  const adminUser = (req as any)['adminUser'];
  if (!adminUser?.userId) {
    throw new UnauthorizedException('Admin identity could not be determined');
  }
  return adminUser.userId;
}

@ApiTags('Impersonation')
@Controller('admin/realms/:realmName')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class ImpersonationController {
  constructor(private readonly impersonationService: ImpersonationService) {}

  @Post('users/:userId/impersonate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start user impersonation',
    description:
      'Generates access/refresh tokens for the target user with impersonation claims. ' +
      'The resulting tokens carry an `act.sub` claim (RFC 8693) identifying the admin, ' +
      'and an `impersonated: true` claim. Requires impersonation to be enabled on the realm. ' +
      'The admin identity is derived from the authenticated session, not the request body.',
  })
  startImpersonation(
    @CurrentRealm() realm: Realm,
    @Param('userId') targetUserId: string,
    @Req() req: Request,
  ) {
    const adminUserId = getAdminUserId(req);
    const ip = req.ip;
    return this.impersonationService.startImpersonation(
      realm,
      adminUserId,
      targetUserId,
      ip,
    );
  }

  @Post('impersonation/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'End an impersonation session',
    description:
      'Revokes the impersonation session tokens and marks the session as ended. ' +
      'Logs an IMPERSONATION_END event. The admin identity is derived from the authenticated session.',
  })
  async endImpersonation(
    @CurrentRealm() realm: Realm,
    @Body() dto: EndImpersonationBodyDto,
    @Req() req: Request,
  ) {
    const adminUserId = getAdminUserId(req);
    const ip = req.ip;
    await this.impersonationService.endImpersonation(
      realm,
      dto.impersonationSessionId,
      adminUserId,
      ip,
    );
  }
}
