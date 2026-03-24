-- AlterTable: Add new registration-related columns to realms
ALTER TABLE "realms" ADD COLUMN "registration_approval_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "allowed_email_domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "realms" ADD COLUMN "terms_of_service_url" TEXT;

-- CreateTable: custom_attributes
CREATE TABLE "custom_attributes" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "show_on_registration" BOOLEAN NOT NULL DEFAULT false,
    "show_on_profile" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "map_to_oidc_claim" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_attributes
CREATE TABLE "user_attributes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "attribute_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique realm+name for custom_attributes
CREATE UNIQUE INDEX "custom_attributes_realm_id_name_key" ON "custom_attributes"("realm_id", "name");

-- CreateIndex: unique user+attribute for user_attributes
CREATE UNIQUE INDEX "user_attributes_user_id_attribute_id_key" ON "user_attributes"("user_id", "attribute_id");

-- CreateIndex: index user_id for user_attributes
CREATE INDEX "user_attributes_user_id_idx" ON "user_attributes"("user_id");

-- AddForeignKey: custom_attributes.realm_id -> realms.id
ALTER TABLE "custom_attributes" ADD CONSTRAINT "custom_attributes_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_attributes.user_id -> users.id
ALTER TABLE "user_attributes" ADD CONSTRAINT "user_attributes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: user_attributes.attribute_id -> custom_attributes.id
ALTER TABLE "user_attributes" ADD CONSTRAINT "user_attributes_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "custom_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
