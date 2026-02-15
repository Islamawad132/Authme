import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'Administrator role' })
  @IsOptional()
  @IsString()
  description?: string;
}
