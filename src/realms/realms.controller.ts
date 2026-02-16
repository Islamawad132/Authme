import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RealmsService } from './realms.service.js';
import { RealmExportService } from './realm-export.service.js';
import { RealmImportService } from './realm-import.service.js';
import { EmailService } from '../email/email.service.js';
import { ThemeService } from '../theme/theme.service.js';
import { ThemeEmailService } from '../theme/theme-email.service.js';
import { CreateRealmDto } from './dto/create-realm.dto.js';
import { UpdateRealmDto } from './dto/update-realm.dto.js';

@ApiTags('Realms')
@Controller('admin/realms')
export class RealmsController {
  constructor(
    private readonly realmsService: RealmsService,
    private readonly exportService: RealmExportService,
    private readonly importService: RealmImportService,
    private readonly emailService: EmailService,
    private readonly themeService: ThemeService,
    private readonly themeEmail: ThemeEmailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new realm' })
  create(@Body() dto: CreateRealmDto) {
    return this.realmsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all realms' })
  findAll() {
    return this.realmsService.findAll();
  }

  @Get('themes')
  @ApiOperation({ summary: 'List available themes' })
  getThemes() {
    return this.themeService.getAvailableThemes();
  }

  @Get(':realmName')
  @ApiOperation({ summary: 'Get a realm by name' })
  findOne(@Param('realmName') realmName: string) {
    return this.realmsService.findByName(realmName);
  }

  @Put(':realmName')
  @ApiOperation({ summary: 'Update a realm' })
  update(
    @Param('realmName') realmName: string,
    @Body() dto: UpdateRealmDto,
  ) {
    return this.realmsService.update(realmName, dto);
  }

  @Delete(':realmName')
  @ApiOperation({ summary: 'Delete a realm' })
  remove(@Param('realmName') realmName: string) {
    return this.realmsService.remove(realmName);
  }

  @Get(':realmName/export')
  @ApiOperation({ summary: 'Export a realm to JSON' })
  exportRealm(
    @Param('realmName') realmName: string,
    @Query('includeUsers') includeUsers?: string,
    @Query('includeSecrets') includeSecrets?: string,
  ) {
    return this.exportService.exportRealm(realmName, {
      includeUsers: includeUsers === 'true',
      includeSecrets: includeSecrets === 'true',
    });
  }

  @Post('import')
  @ApiOperation({ summary: 'Import a realm from JSON' })
  importRealm(
    @Body() body: Record<string, unknown>,
    @Query('overwrite') overwrite?: string,
  ) {
    return this.importService.importRealm(body, {
      overwrite: overwrite === 'true',
    });
  }

  @Post(':realmName/email/test')
  @ApiOperation({ summary: 'Send a test email' })
  async sendTestEmail(
    @Param('realmName') realmName: string,
    @Body('to') to: string,
  ) {
    if (!to) {
      throw new BadRequestException('Missing "to" email address');
    }
    const configured = await this.emailService.isConfigured(realmName);
    if (!configured) {
      throw new BadRequestException('SMTP is not configured for this realm');
    }
    const realm = await this.realmsService.findByName(realmName);
    const subject = this.themeEmail.getSubject(realm, 'testEmailSubject');
    const html = this.themeEmail.renderEmail(realm, 'test-email', {});
    await this.emailService.sendEmail(realmName, to, subject, html);
    return { message: 'Test email sent successfully' };
  }
}
