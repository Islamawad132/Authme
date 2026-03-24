-- AlterTable
ALTER TABLE "users" ADD COLUMN "password_algorithm" TEXT NOT NULL DEFAULT 'argon2';
