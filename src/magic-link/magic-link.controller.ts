import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Realm } from '@prisma/client';
import { MagicLinkService } from './magic-link.service.js';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto.js';
import { MagicLinkVerifyDto } from './dto/magic-link-verify.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { RateLimitGuard, RateLimitByIp } from '../rate-limit/rate-limit.guard.js';
import { resolveClientIp } from '../common/utils/proxy-ip.util.js';

@ApiTags('Magic Link')
@Controller('realms/:realmName/magic-link')
@UseGuards(RealmGuard)
@Public()
export class MagicLinkController {
  constructor(private readonly magicLinkService: MagicLinkService) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a magic link to be sent to the user\'s email' })
  @ApiResponse({ status: 200, description: 'Magic link sent successfully or rate limited' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @SkipThrottle()
  @UseGuards(RateLimitGuard)
  @RateLimitByIp()
  async requestMagicLink(
    @CurrentRealm() realm: Realm,
    @Body() dto: MagicLinkRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = resolveClientIp(req);
    const userAgent = req.headers['user-agent'];

    const result = await this.magicLinkService.requestMagicLink(
      dto.email,
      realm.id,
      ipAddress,
      userAgent,
      dto.magicLinkUrl,
    );

    if (!result.success && result.rateLimit) {
      res.set('Retry-After', String(result.rateLimit.retryAfter ?? 60));
      res.set('X-RateLimit-Limit', String(result.rateLimit.limit));
      res.set('X-RateLimit-Remaining', String(result.rateLimit.remaining));
      res.set('X-RateLimit-Reset', String(result.rateLimit.resetAt));
    }

    return result;
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify a magic link token and complete authentication' })
  @ApiResponse({ status: 200, description: 'Token valid, returns user info' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyMagicLink(
    @CurrentRealm() realm: Realm,
    @Query() query: MagicLinkVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.magicLinkService.validateMagicLink(
      query.token,
      realm.name,
    );

    return result;
  }
}
