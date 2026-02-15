import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RealmsService } from './realms.service.js';
import { CreateRealmDto } from './dto/create-realm.dto.js';
import { UpdateRealmDto } from './dto/update-realm.dto.js';

@ApiTags('Realms')
@Controller('admin/realms')
export class RealmsController {
  constructor(private readonly realmsService: RealmsService) {}

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
}
