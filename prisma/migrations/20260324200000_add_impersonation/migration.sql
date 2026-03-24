-- AddColumn: impersonation settings to realms
ALTER TABLE "realms" ADD COLUMN "impersonation_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "impersonation_max_duration" INTEGER NOT NULL DEFAULT 1800;

-- CreateTable: impersonation_sessions
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonation_sessions_realm_id_admin_user_id_idx" ON "impersonation_sessions"("realm_id", "admin_user_id");

-- CreateIndex
CREATE INDEX "impersonation_sessions_realm_id_target_user_id_idx" ON "impersonation_sessions"("realm_id", "target_user_id");

-- CreateIndex
CREATE INDEX "impersonation_sessions_session_id_idx" ON "impersonation_sessions"("session_id");

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
