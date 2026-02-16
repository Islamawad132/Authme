import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'my-frontend' })
  @IsString()
  @MinLength(2)
  clientId!: string;

  @ApiPropertyOptional({ example: 'My Frontend App' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['CONFIDENTIAL', 'PUBLIC'], default: 'CONFIDENTIAL' })
  @IsOptional()
  @IsEnum({ CONFIDENTIAL: 'CONFIDENTIAL', PUBLIC: 'PUBLIC' })
  clientType?: 'CONFIDENTIAL' | 'PUBLIC';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: ['http://localhost:3000/callback'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  redirectUris?: string[];

  @ApiPropertyOptional({ example: ['http://localhost:3000'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  webOrigins?: string[];

  @ApiPropertyOptional({ example: ['authorization_code', 'client_credentials'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grantTypes?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requireConsent?: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/backchannel-logout' })
  @IsOptional()
  @IsString()
  backchannelLogoutUri?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  backchannelLogoutSessionRequired?: boolean;
}
