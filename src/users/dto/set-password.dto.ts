import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
