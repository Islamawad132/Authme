-- Add file_hash column to installed_plugins for integrity verification
ALTER TABLE "installed_plugins" ADD COLUMN "file_hash" TEXT;
