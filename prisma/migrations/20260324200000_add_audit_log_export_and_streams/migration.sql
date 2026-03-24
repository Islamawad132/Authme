-- AlterTable: add per-realm audit log retention fields
ALTER TABLE "realms"
  ADD COLUMN "login_event_retention_days" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "admin_event_retention_days" INTEGER NOT NULL DEFAULT 90;

-- CreateTable: AuditLogStream
CREATE TABLE "audit_log_streams" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stream_type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "url" TEXT,
    "http_headers" JSONB,
    "syslog_host" TEXT,
    "syslog_port" INTEGER,
    "syslog_protocol" TEXT NOT NULL DEFAULT 'udp',
    "syslog_facility" INTEGER NOT NULL DEFAULT 16,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_log_streams_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_log_streams"
  ADD CONSTRAINT "audit_log_streams_realm_id_fkey"
  FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
