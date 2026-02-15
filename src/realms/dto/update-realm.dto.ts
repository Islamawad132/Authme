import { PartialType } from '@nestjs/swagger';
import { CreateRealmDto } from './create-realm.dto.js';

export class UpdateRealmDto extends PartialType(CreateRealmDto) {}
