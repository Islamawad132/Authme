import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignRolesDto {
  @ApiProperty({ example: ['admin', 'user'] })
  @IsArray()
  @IsString({ each: true })
  roleNames!: string[];
}
