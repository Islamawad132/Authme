-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('CONFIDENTIAL', 'PUBLIC');

-- CreateTable
CREATE TABLE "realms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "access_token_lifespan" INTEGER NOT NULL DEFAULT 300,
    "refresh_token_lifespan" INTEGER NOT NULL DEFAULT 1800,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "realms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "first_name" TEXT,
    "last_name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT,
    "client_type" "ClientType" NOT NULL DEFAULT 'CONFIDENTIAL',
    "name" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "require_consent" BOOLEAN NOT NULL DEFAULT false,
    "redirect_uris" TEXT[],
    "web_origins" TEXT[],
    "grant_types" TEXT[] DEFAULT ARRAY['authorization_code']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "client_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorization_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scope" TEXT,
    "code_challenge" TEXT,
    "code_challenge_method" TEXT,
    "nonce" TEXT,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realm_signing_keys" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'RS256',
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realm_signing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_providers" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "display_name" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "provider_type" TEXT NOT NULL DEFAULT 'oidc',
    "idp_client_id" TEXT NOT NULL,
    "idp_client_secret" TEXT NOT NULL,
    "authorization_url" TEXT NOT NULL,
    "token_url" TEXT NOT NULL,
    "userinfo_url" TEXT,
    "jwks_url" TEXT,
    "issuer" TEXT,
    "default_scopes" TEXT NOT NULL DEFAULT 'openid email profile',
    "trust_email" BOOLEAN NOT NULL DEFAULT false,
    "link_only" BOOLEAN NOT NULL DEFAULT false,
    "sync_user_profile" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federated_identities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "identity_provider_id" TEXT NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "external_username" TEXT,
    "external_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federated_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "realms_name_key" ON "realms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_realm_id_username_key" ON "users"("realm_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_realm_id_email_key" ON "users"("realm_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_realm_id_client_id_key" ON "clients"("realm_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_realm_id_client_id_name_key" ON "roles"("realm_id", "client_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "authorization_codes_code_key" ON "authorization_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "realm_signing_keys_realm_id_kid_key" ON "realm_signing_keys"("realm_id", "kid");

-- CreateIndex
CREATE UNIQUE INDEX "login_sessions_token_hash_key" ON "login_sessions"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_user_id_client_id_key" ON "user_consents"("user_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "identity_providers_realm_id_alias_key" ON "identity_providers"("realm_id", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "federated_identities_identity_provider_id_external_user_id_key" ON "federated_identities"("identity_provider_id", "external_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "federated_identities_user_id_identity_provider_id_key" ON "federated_identities"("user_id", "identity_provider_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorization_codes" ADD CONSTRAINT "authorization_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realm_signing_keys" ADD CONSTRAINT "realm_signing_keys_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federated_identities" ADD CONSTRAINT "federated_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federated_identities" ADD CONSTRAINT "federated_identities_identity_provider_id_fkey" FOREIGN KEY ("identity_provider_id") REFERENCES "identity_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
