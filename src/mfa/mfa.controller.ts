import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { MfaService } from './mfa.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('MFA')
@Controller('admin/realms/:realmName/users/:userId/mfa')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class MfaController {
  constructor(
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verify that userId belongs to the given realm.
   * Throws NotFoundException (404) for both "user not found" and "user in wrong
   * realm" cases — a uniform response avoids leaking realm membership info.
   */
  private async assertUserInRealm(userId: string, realm: Realm): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.realmId !== realm.id) {
      throw new NotFoundException(`User '${userId}' not found in realm '${realm.name}'`);
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if user has MFA enabled' })
  async getMfaStatus(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    await this.assertUserInRealm(userId, realm);
    const enabled = await this.mfaService.isMfaEnabled(userId);
    return { enabled };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset/disable MFA for a user' })
  async resetMfa(
    @CurrentRealm() realm: Realm,
    @Param('userId') userId: string,
  ) {
    await this.assertUserInRealm(userId, realm);
    await this.mfaService.disableTotp(userId);
  }
}
