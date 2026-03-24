import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetUserAttributesDto {
  @ApiProperty({
    description: 'Map of attribute name to value',
    example: { phone_number: '+1234567890', department: 'Engineering' },
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  attributes!: Record<string, string>;
}
