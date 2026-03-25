import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard.js';
import { AuthFlowService } from './auth-flow.service.js';
import {
  CreateAuthFlowDto,
  UpdateAuthFlowDto,
  AssignFlowToClientDto,
} from './auth-flow.dto.js';

@ApiTags('Authentication Flows')
@ApiBearerAuth()
@UseGuards(AdminApiKeyGuard)
@Controller('admin/realms/:realm/auth-flows')
export class AuthFlowController {
  constructor(private readonly authFlowService: AuthFlowService) {}

  // ── Create ───────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new authentication flow for a realm' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiResponse({ status: 201, description: 'Flow created' })
  @ApiResponse({ status: 400, description: 'Bad request — invalid DTO' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  @ApiResponse({ status: 409, description: 'Flow with that name already exists' })
  create(
    @Param('realm') realmId: string,
    @Body() dto: CreateAuthFlowDto,
  ) {
    return this.authFlowService.create(realmId, dto);
  }

  // ── List ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all authentication flows for a realm' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiResponse({ status: 200, description: 'Array of authentication flows' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  findAll(@Param('realm') realmId: string) {
    return this.authFlowService.findAll(realmId);
  }

  // ── Get one ──────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get a single authentication flow by ID' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Authentication flow details' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  findOne(
    @Param('realm') realmId: string,
    @Param('id') id: string,
  ) {
    return this.authFlowService.findOne(realmId, id);
  }

  // ── Update ───────────────────────────────────────────────

  @Put(':id')
  @ApiOperation({ summary: 'Update an authentication flow' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiResponse({ status: 200, description: 'Authentication flow updated' })
  @ApiResponse({ status: 400, description: 'Bad request — invalid DTO' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  update(
    @Param('realm') realmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAuthFlowDto,
  ) {
    return this.authFlowService.update(realmId, id, dto);
  }

  // ── Delete ───────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an authentication flow' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Flow not found' })
  async remove(
    @Param('realm') realmId: string,
    @Param('id') id: string,
  ) {
    await this.authFlowService.remove(realmId, id);
  }

  // ── Assign flow to client ────────────────────────────────

  @Put(':id/assign-client/:clientId')
  @ApiOperation({ summary: 'Assign an authentication flow to a specific client' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiParam({ name: 'id', description: 'Flow ID' })
  @ApiParam({ name: 'clientId', description: 'Client ID (primary key)' })
  @ApiResponse({ status: 200, description: 'Flow assigned to client' })
  @ApiResponse({ status: 400, description: 'Bad request — invalid DTO' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  @ApiResponse({ status: 404, description: 'Client or flow not found' })
  assignToClient(
    @Param('id') _flowId: string,
    @Param('clientId') clientId: string,
    @Body() dto: AssignFlowToClientDto,
  ) {
    // dto.authFlowId may be null to clear the assignment
    return this.authFlowService['prisma'].client.update({
      where: { id: clientId },
      data: { authFlowId: dto.authFlowId ?? null },
      select: { id: true, clientId: true, authFlowId: true },
    });
  }

  // ── Seed defaults ────────────────────────────────────────

  @Post('seed-defaults')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Seed the three built-in default flows for this realm' })
  @ApiParam({ name: 'realm', description: 'Realm ID' })
  @ApiResponse({ status: 204, description: 'Default flows seeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid admin API key' })
  async seedDefaults(@Param('realm') realmId: string) {
    await this.authFlowService.seedDefaultFlows(realmId);
  }
}
