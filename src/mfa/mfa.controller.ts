import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { MfaService } from './mfa.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';

@ApiTags('MFA')
@Controller('admin/realms/:realmName/users/:userId/mfa')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if user has MFA enabled' })
  async getMfaStatus(@Param('userId') userId: string) {
    const enabled = await this.mfaService.isMfaEnabled(userId);
    return { enabled };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset/disable MFA for a user' })
  async resetMfa(@Param('userId') userId: string) {
    await this.mfaService.disableTotp(userId);
  }
}
