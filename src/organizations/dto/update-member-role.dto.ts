import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['owner', 'admin', 'member'] })
  @IsString()
  @IsIn(['owner', 'admin', 'member'])
  role!: string;
}
