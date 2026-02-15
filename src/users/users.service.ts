import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import type { Realm } from '@prisma/client';

const USER_SELECT = {
  id: true,
  realmId: true,
  username: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async create(realm: Realm, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: realm.id, username: dto.username } },
    });
    if (existing) {
      throw new ConflictException(`User '${dto.username}' already exists in realm '${realm.name}'`);
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await this.crypto.hashPassword(dto.password);
    }

    return this.prisma.user.create({
      data: {
        realmId: realm.id,
        username: dto.username,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        enabled: dto.enabled,
        passwordHash,
      },
      select: USER_SELECT,
    });
  }

  async findAll(realm: Realm, skip: number, take: number) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { realmId: realm.id },
        select: USER_SELECT,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count({ where: { realmId: realm.id } }),
    ]);
    return { users, total };
  }

  async findById(realm: Realm, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, realmId: realm.id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User not found`);
    }
    return user;
  }

  async update(realm: Realm, userId: string, dto: UpdateUserDto) {
    await this.findById(realm, userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        enabled: dto.enabled,
        emailVerified: dto.emailVerified,
      },
      select: USER_SELECT,
    });
  }

  async remove(realm: Realm, userId: string) {
    await this.findById(realm, userId);
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async setPassword(realm: Realm, userId: string, password: string) {
    await this.findById(realm, userId);
    const passwordHash = await this.crypto.hashPassword(password);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
