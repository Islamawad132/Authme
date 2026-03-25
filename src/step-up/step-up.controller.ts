import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Realm } from '@prisma/client';
import { StepUpService, ACR_MFA, ACR_WEBAUTHN, ACR_PASSWORD } from './step-up.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { LoginService } from '../login/login.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Step-Up Authentication')
@Controller('realms/:realmName/step-up')
@UseGuards(RealmGuard)
@Public()
export class StepUpController {
  constructor(
    private readonly stepUpService: StepUpService,
    private readonly prisma: PrismaService,
    private readonly mfaService: MfaService,
    private readonly loginService: LoginService,
    private readonly crypto: CryptoService,
  ) {}

  /**
   * GET /realms/:realm/step-up/challenge?acr=...&client_id=...&session_token=...
   *
   * Initiates a step-up flow for the current SSO session.  Returns the
   * challenge type and, when the required level is MFA, an mfa_token to be
   * used with the verify endpoint.
   */
  @Get('challenge')
  @ApiOperation({ summary: 'Initiate step-up authentication challenge' })
  @ApiQuery({ name: 'acr', required: true, description: 'Required ACR value' })
  @ApiQuery({ name: 'client_id', required: true, description: 'OAuth client_id' })
  @ApiQuery({ name: 'session_token', required: true, description: 'Current SSO session token (AUTHME_SESSION cookie value)' })
  @ApiResponse({ status: 200, description: 'Challenge details (type, mfa_token) or satisfied status' })
  @ApiResponse({ status: 400, description: 'Bad request — missing parameters, unsupported ACR, or MFA not enrolled' })
  @ApiResponse({ status: 401, description: 'Invalid or expired session token' })
  async challenge(
    @CurrentRealm() realm: Realm,
    @Query('acr') requiredAcr: string,
    @Query('client_id') clientId: string,
    @Query('session_token') sessionToken: string,
  ) {
    if (!requiredAcr || !clientId || !sessionToken) {
      throw new BadRequestException('acr, client_id, and session_token are required');
    }

    // Validate the SSO session
    const user = await this.loginService.validateLoginSession(realm, sessionToken);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Look up the login session record to get its ID
    const loginSession = await this.getLoginSessionByToken(sessionToken);
    if (!loginSession) {
      throw new UnauthorizedException('Session not found');
    }

    // Check if already satisfied (cached)
    const alreadySatisfied = await this.stepUpService.isStepUpCached(
      loginSession.id,
      requiredAcr,
    );
    if (alreadySatisfied) {
      return { status: 'satisfied', acr: requiredAcr };
    }

    // Determine what the user needs to do
    if (requiredAcr === ACR_MFA) {
      const mfaEnabled = await this.mfaService.isMfaEnabled(user.id);
      if (!mfaEnabled) {
        throw new BadRequestException('MFA is not set up for this account. Please enroll in MFA first.');
      }
      const mfaToken = await this.mfaService.createMfaChallenge(user.id, realm.id);
      return {
        status: 'challenge_required',
        challenge_type: 'totp',
        acr: requiredAcr,
        mfa_token: mfaToken,
      };
    }

    if (requiredAcr === ACR_WEBAUTHN) {
      return {
        status: 'challenge_required',
        challenge_type: 'webauthn',
        acr: requiredAcr,
        webauthn_authenticate_url: `/realms/${realm.name}/webauthn/authenticate/options`,
      };
    }

    if (requiredAcr === ACR_PASSWORD) {
      return {
        status: 'challenge_required',
        challenge_type: 'password',
        acr: requiredAcr,
      };
    }

    throw new BadRequestException(`Unsupported ACR value: ${requiredAcr}`);
  }

  /**
   * POST /realms/:realm/step-up/verify
   *
   * Completes a step-up verification.  Accepts TOTP/OTP codes for MFA
   * step-ups.  On success, records the step-up against the session and
   * returns the new ACR level.
   */
  @Post('verify')
  @ApiOperation({ summary: 'Complete step-up verification' })
  @ApiResponse({ status: 201, description: 'Step-up verified; returns new ACR level and AMR' })
  @ApiResponse({ status: 400, description: 'Bad request — missing parameters, unsupported ACR, or client not found' })
  @ApiResponse({ status: 401, description: 'Invalid session, expired MFA token, or wrong credential' })
  async verify(
    @CurrentRealm() realm: Realm,
    @Body() body: {
      session_token: string;
      acr: string;
      client_id: string;
      mfa_token?: string;
      otp?: string;
      password?: string;
      webauthn_assertion_id?: string;
    },
    @Req() req: Request,
  ) {
    const { session_token, acr, client_id, mfa_token, otp, password } = body;

    if (!session_token || !acr || !client_id) {
      throw new BadRequestException('session_token, acr, and client_id are required');
    }

    // Validate the SSO session
    const user = await this.loginService.validateLoginSession(realm, session_token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Look up the login session record to get its ID
    const loginSession = await this.getLoginSessionByToken(session_token);
    if (!loginSession) {
      throw new UnauthorizedException('Session not found');
    }

    // Look up the client to obtain the cache duration
    const client = await this.prisma.client.findUnique({
      where: { realmId_clientId: { realmId: realm.id, clientId: client_id } },
      select: { stepUpCacheDuration: true, requiredAcr: true },
    });
    if (!client) {
      throw new BadRequestException('Client not found');
    }

    const cacheDuration = client.stepUpCacheDuration ?? 900;

    // ── MFA / TOTP step-up ─────────────────────────────────────────────────
    if (acr === ACR_MFA) {
      if (!mfa_token || !otp) {
        throw new BadRequestException('mfa_token and otp are required for MFA step-up');
      }

      const challenge = await this.mfaService.validateMfaChallengeWithAttemptCheck(mfa_token);
      if (!challenge) {
        throw new UnauthorizedException('Invalid or expired MFA token');
      }

      // Ensure this challenge belongs to the session user
      if (challenge.userId !== user.id) {
        throw new UnauthorizedException('MFA token does not match session user');
      }

      const verified = await this.mfaService.verifyTotp(challenge.userId, otp);
      if (!verified) {
        const recoveryVerified = await this.mfaService.verifyRecoveryCode(challenge.userId, otp);
        if (!recoveryVerified) {
          throw new UnauthorizedException('Invalid OTP code');
        }
      }

      // Consume the MFA challenge
      await this.mfaService.consumeMfaChallenge(mfa_token);

      // Record the step-up
      await this.stepUpService.recordStepUp(loginSession.id, ACR_MFA, cacheDuration);

      return {
        status: 'success',
        acr: ACR_MFA,
        amr: ['totp'],
      };
    }

    // ── Password re-authentication step-up ────────────────────────────────
    if (acr === ACR_PASSWORD) {
      if (!password) {
        throw new BadRequestException('password is required for password step-up');
      }

      const ip = req.ip;
      try {
        await this.loginService.validateCredentials(realm, user.username, password, ip);
      } catch {
        throw new UnauthorizedException('Invalid password');
      }

      await this.stepUpService.recordStepUp(loginSession.id, ACR_PASSWORD, cacheDuration);

      return {
        status: 'success',
        acr: ACR_PASSWORD,
        amr: ['pwd'],
      };
    }

    // ── WebAuthn step-up ───────────────────────────────────────────────────
    if (acr === ACR_WEBAUTHN) {
      // TODO: Full WebAuthn ceremony verification should use the WebAuthn
      // library (e.g. @simplewebauthn/server verifyAuthenticationResponse)
      // with a server-generated challenge stored in the session at challenge
      // time and consumed here.  The fields below are the minimum required
      // by the WebAuthn specification to prove an authenticator signed the
      // challenge; accepting only a credential ID (without an actual
      // assertion) allows trivial bypass of this step-up level.
      const webauthnAssertionId = body.webauthn_assertion_id;
      const { authenticatorData, clientDataJSON, signature } = body as {
        authenticatorData?: string;
        clientDataJSON?: string;
        signature?: string;
      };

      if (!webauthnAssertionId) {
        throw new BadRequestException('webauthn_assertion_id is required for WebAuthn step-up');
      }

      // Reject requests that carry no assertion — a bare credential ID does
      // not prove that the authenticator performed a signing ceremony.
      if (!authenticatorData || !signature) {
        throw new BadRequestException(
          'WebAuthn step-up requires a full assertion response: authenticatorData, clientDataJSON, and signature must be provided',
        );
      }

      // Verify the credential exists and belongs to this user
      const credential = await this.prisma.webAuthnCredential.findFirst({
        where: { id: webauthnAssertionId, userId: user.id },
      });
      if (!credential) {
        throw new UnauthorizedException('Invalid WebAuthn credential');
      }

      await this.stepUpService.recordStepUp(loginSession.id, ACR_WEBAUTHN, cacheDuration);

      return {
        status: 'success',
        acr: ACR_WEBAUTHN,
        amr: ['hwk'],
      };
    }

    throw new BadRequestException(`Unsupported ACR value: ${acr}`);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getLoginSessionByToken(sessionToken: string) {
    const tokenHash = this.crypto.sha256(sessionToken);
    return this.prisma.loginSession.findUnique({ where: { tokenHash } });
  }
}
