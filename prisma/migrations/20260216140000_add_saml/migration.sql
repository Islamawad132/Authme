-- AlterTable
ALTER TABLE "identity_providers" ADD COLUMN "saml_config" JSONB;

-- CreateTable
CREATE TABLE "saml_service_providers" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "acs_url" TEXT NOT NULL,
    "slo_url" TEXT,
    "certificate" TEXT,
    "name_id_format" TEXT NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    "sign_assertions" BOOLEAN NOT NULL DEFAULT true,
    "sign_responses" BOOLEAN NOT NULL DEFAULT true,
    "attribute_statements" JSONB NOT NULL DEFAULT '{}',
    "valid_redirect_uris" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saml_service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saml_service_providers_realm_id_entity_id_key" ON "saml_service_providers"("realm_id", "entity_id");

-- AddForeignKey
ALTER TABLE "saml_service_providers" ADD CONSTRAINT "saml_service_providers_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
