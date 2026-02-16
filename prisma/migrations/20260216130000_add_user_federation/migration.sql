-- AlterTable
ALTER TABLE "users" ADD COLUMN "federation_link" TEXT;

-- CreateTable
CREATE TABLE "user_federations" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL DEFAULT 'ldap',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "connection_url" TEXT NOT NULL,
    "bind_dn" TEXT NOT NULL,
    "bind_credential" TEXT NOT NULL,
    "start_tls" BOOLEAN NOT NULL DEFAULT false,
    "connection_timeout" INTEGER NOT NULL DEFAULT 5000,
    "users_dn" TEXT NOT NULL,
    "user_object_class" TEXT NOT NULL DEFAULT 'inetOrgPerson',
    "username_ldap_attr" TEXT NOT NULL DEFAULT 'uid',
    "rdn_ldap_attr" TEXT NOT NULL DEFAULT 'uid',
    "uuid_ldap_attr" TEXT NOT NULL DEFAULT 'entryUUID',
    "search_filter" TEXT,
    "sync_mode" TEXT NOT NULL DEFAULT 'on_demand',
    "sync_period" INTEGER NOT NULL DEFAULT 3600,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "import_enabled" BOOLEAN NOT NULL DEFAULT true,
    "edit_mode" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_federations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_federation_mappers" (
    "id" TEXT NOT NULL,
    "federation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mapper_type" TEXT NOT NULL,
    "ldap_attribute" TEXT NOT NULL,
    "user_attribute" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_federation_mappers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_federations_realm_id_name_key" ON "user_federations"("realm_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_federation_mappers_federation_id_name_key" ON "user_federation_mappers"("federation_id", "name");

-- AddForeignKey
ALTER TABLE "user_federations" ADD CONSTRAINT "user_federations_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_federation_mappers" ADD CONSTRAINT "user_federation_mappers_federation_id_fkey" FOREIGN KEY ("federation_id") REFERENCES "user_federations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
