-- Add per-client, per-user, and per-IP rate limiting configuration to realms

ALTER TABLE "realms" ADD COLUMN "rate_limit_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "client_rate_limit_per_minute" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "realms" ADD COLUMN "client_rate_limit_per_hour" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "realms" ADD COLUMN "user_rate_limit_per_minute" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "realms" ADD COLUMN "user_rate_limit_per_hour" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "realms" ADD COLUMN "ip_rate_limit_per_minute" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "realms" ADD COLUMN "ip_rate_limit_per_hour" INTEGER NOT NULL DEFAULT 200;
