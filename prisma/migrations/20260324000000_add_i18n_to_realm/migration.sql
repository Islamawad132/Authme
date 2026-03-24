-- AlterTable: add i18n fields to realms
ALTER TABLE "realms"
  ADD COLUMN "default_locale" VARCHAR(10) NOT NULL DEFAULT 'en',
  ADD COLUMN "supported_locales" TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[];
