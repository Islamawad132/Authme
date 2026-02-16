import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientScopeDto {
  @ApiProperty({ example: 'custom-scope' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'My custom scope' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'openid-connect' })
  @IsOptional()
  @IsString()
  protocol?: string;
}
