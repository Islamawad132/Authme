-- AlterTable: add step-up authentication fields to clients
ALTER TABLE "clients" ADD COLUMN "required_acr" TEXT;
ALTER TABLE "clients" ADD COLUMN "step_up_cache_duration" INTEGER NOT NULL DEFAULT 900;

-- AlterTable: store acr_values in authorization codes
ALTER TABLE "authorization_codes" ADD COLUMN "acr_values" TEXT;

-- CreateTable: step-up records (tracks completed step-ups per session)
CREATE TABLE "step_up_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "acr_level" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "step_up_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "step_up_records_session_id_idx" ON "step_up_records"("session_id");
CREATE INDEX "step_up_records_expires_at_idx" ON "step_up_records"("expires_at");
