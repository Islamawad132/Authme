-- CreateTable: webhook_events (persistent outbox queue, Issue #338)
CREATE TABLE "webhook_events" (
    "id"           TEXT NOT NULL,
    "realm_id"     TEXT NOT NULL,
    "event_type"   TEXT NOT NULL,
    "payload"      JSONB NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'PENDING',
    "attempts"     INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 4,
    "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_status_next_retry_at_idx" ON "webhook_events"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "webhook_events_realm_id_created_at_idx" ON "webhook_events"("realm_id", "created_at");
