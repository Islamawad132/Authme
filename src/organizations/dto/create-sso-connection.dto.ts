import {
  IsString,
  IsIn,
  IsBoolean,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSsoConnectionDto {
  @ApiProperty({ enum: ['oidc', 'saml'] })
  @IsString()
  @IsIn(['oidc', 'saml'])
  type!: string;

  @ApiProperty({ example: 'Corporate OIDC' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiProperty({ description: 'Provider-specific configuration object' })
  @IsObject()
  config!: Record<string, unknown>;
}
