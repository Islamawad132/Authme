-- AlterTable: add client_id to refresh_tokens so that revoke/introspect
-- endpoints can enforce token ownership (security fix #456).
-- Nullable so that existing rows created before this migration are unaffected;
-- new tokens will always populate the column.
ALTER TABLE "refresh_tokens" ADD COLUMN "client_id" TEXT;
