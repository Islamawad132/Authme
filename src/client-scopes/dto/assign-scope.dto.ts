import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignScopeDto {
  @ApiProperty({ example: 'scope-uuid' })
  @IsString()
  clientScopeId!: string;
}
