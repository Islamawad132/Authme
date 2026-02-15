import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateRealmDto } from './create-realm.dto.js';

export class UpdateRealmDto extends PartialType(
  OmitType(CreateRealmDto, ['name'] as const),
) {}
