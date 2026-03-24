-- AlterTable: add max_sessions_per_user to realms (Issue #333)
ALTER TABLE "realms" ADD COLUMN "max_sessions_per_user" INTEGER NOT NULL DEFAULT 10;
