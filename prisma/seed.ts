import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { generateKeyPair, exportJWK } from 'jose';
import { randomUUID, randomBytes } from 'crypto';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
});
const prisma = new PrismaClient({ adapter });

async function exportKeyToPem(
  key: CryptoKey,
  type: 'public' | 'private',
): Promise<string> {
  const exported = await crypto.subtle.exportKey(
    type === 'public' ? 'spki' : 'pkcs8',
    key,
  );
  const b64 = Buffer.from(exported).toString('base64');
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  const label = type === 'public' ? 'PUBLIC KEY' : 'PRIVATE KEY';
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

async function main() {
  console.log('Seeding database...');

  // Create test realm
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  const publicKeyPem = await exportKeyToPem(publicKey, 'public');
  const privateKeyPem = await exportKeyToPem(privateKey, 'private');
  const kid = randomUUID();

  const realm = await prisma.realm.upsert({
    where: { name: 'test' },
    update: {},
    create: {
      name: 'test',
      displayName: 'Test Realm',
      enabled: true,
      accessTokenLifespan: 300,
      refreshTokenLifespan: 1800,
      signingKeys: {
        create: {
          kid,
          algorithm: 'RS256',
          publicKey: publicKeyPem,
          privateKey: privateKeyPem,
        },
      },
    },
  });

  console.log(`  Realm: ${realm.name} (${realm.id})`);

  // Create test user
  const passwordHash = await argon2.hash('password123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.upsert({
    where: { realmId_username: { realmId: realm.id, username: 'testuser' } },
    update: {},
    create: {
      realmId: realm.id,
      username: 'testuser',
      email: 'test@example.com',
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User',
      enabled: true,
      passwordHash,
    },
  });

  console.log(`  User: ${user.username} (password: password123)`);

  // Create test client
  const rawSecret = randomBytes(32).toString('hex');
  const secretHash = await argon2.hash(rawSecret, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const client = await prisma.client.upsert({
    where: {
      realmId_clientId: { realmId: realm.id, clientId: 'test-client' },
    },
    update: {},
    create: {
      realmId: realm.id,
      clientId: 'test-client',
      clientSecret: secretHash,
      clientType: 'CONFIDENTIAL',
      name: 'Test Client',
      enabled: true,
      redirectUris: ['http://localhost:3000/callback'],
      webOrigins: ['http://localhost:3000'],
      grantTypes: [
        'authorization_code',
        'client_credentials',
        'password',
        'refresh_token',
      ],
    },
  });

  console.log(`  Client: ${client.clientId}`);
  console.log(`  Client Secret: ${rawSecret}`);
  console.log('  (Save this secret — it won\'t be shown again!)');

  // Create test roles (realm-level, no clientId)
  let adminRole = await prisma.role.findFirst({
    where: { realmId: realm.id, clientId: null, name: 'admin' },
  });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        realmId: realm.id,
        name: 'admin',
        description: 'Administrator role',
      },
    });
  }

  let userRole = await prisma.role.findFirst({
    where: { realmId: realm.id, clientId: null, name: 'user' },
  });
  if (!userRole) {
    userRole = await prisma.role.create({
      data: {
        realmId: realm.id,
        name: 'user',
        description: 'Regular user role',
      },
    });
  }

  // Assign roles to user
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: userRole.id } },
    update: {},
    create: { userId: user.id, roleId: userRole.id },
  });

  console.log(`  Roles assigned: admin, user`);
  console.log('\nSeed completed!');
  console.log('\nQuick test:');
  console.log(
    `  curl -X POST http://localhost:3000/realms/test/protocol/openid-connect/token \\`,
  );
  console.log(
    `    -H "Content-Type: application/json" \\`,
  );
  console.log(
    `    -d '{"grant_type":"password","client_id":"test-client","client_secret":"${rawSecret}","username":"testuser","password":"password123"}'`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
