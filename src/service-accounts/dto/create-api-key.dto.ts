import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiPropertyOptional({ example: 'ci-pipeline-key' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: ['read:users', 'write:tokens'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
