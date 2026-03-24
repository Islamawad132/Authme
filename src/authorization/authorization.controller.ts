import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { AuthorizationService } from './authorization.service.js';
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  EvaluatePolicyDto,
  TestPolicyDto,
} from './authorization.dto.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';

@ApiTags('Authorization (ABAC Policies)')
@Controller('admin/realms/:realmName/policies')
@UseGuards(RealmGuard)
@ApiSecurity('admin-api-key')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  // ─── CRUD ─────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create an ABAC policy in a realm' })
  create(@CurrentRealm() realm: Realm, @Body() dto: CreatePolicyDto) {
    return this.authorizationService.createPolicy(realm, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all ABAC policies in a realm' })
  findAll(@CurrentRealm() realm: Realm) {
    return this.authorizationService.findAllPolicies(realm);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single ABAC policy by ID' })
  findOne(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.authorizationService.findPolicyById(realm, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an ABAC policy' })
  update(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.authorizationService.updatePolicy(realm, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an ABAC policy' })
  remove(@CurrentRealm() realm: Realm, @Param('id') id: string) {
    return this.authorizationService.deletePolicy(realm, id);
  }

  // ─── Evaluation ────────────────────────────────────────────

  @Post('evaluate')
  @ApiOperation({
    summary: 'Evaluate all realm policies for a given request',
    description:
      'Evaluates all enabled policies in the realm and returns a final ALLOW/DENY ' +
      'decision together with reasoning (which policies matched and why).',
  })
  evaluate(@CurrentRealm() realm: Realm, @Body() dto: EvaluatePolicyDto) {
    return this.authorizationService.evaluate(realm, dto);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Test a single policy against a request',
    description:
      'Evaluates only the specified policy and returns detailed condition results. ' +
      'Useful for debugging policy logic without considering other realm policies.',
  })
  test(
    @CurrentRealm() realm: Realm,
    @Param('id') id: string,
    @Body() dto: TestPolicyDto,
  ) {
    return this.authorizationService.testPolicy(realm, id, dto);
  }
}
