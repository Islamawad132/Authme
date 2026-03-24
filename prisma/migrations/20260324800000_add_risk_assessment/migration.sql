-- Migration: add_risk_assessment
-- Feature 25: AI-Powered Adaptive Authentication & Threat Detection

-- ─── Realm: adaptive auth columns ────────────────────────────────────────────

ALTER TABLE "realms"
  ADD COLUMN "adaptive_auth_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "risk_threshold_step_up" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "risk_threshold_block"   INTEGER NOT NULL DEFAULT 80;

-- ─── LoginRiskAssessment ──────────────────────────────────────────────────────

CREATE TABLE "login_risk_assessments" (
  "id"                   TEXT        NOT NULL,
  "login_event_id"       TEXT,
  "user_id"              TEXT        NOT NULL,
  "realm_id"             TEXT        NOT NULL,
  "risk_score"           INTEGER     NOT NULL,
  "risk_level"           TEXT        NOT NULL,
  "signals"              JSONB       NOT NULL,
  "action"               TEXT        NOT NULL,
  "ip_address"           TEXT,
  "user_agent"           TEXT,
  "geo_location"         TEXT,
  "device_fingerprint"   TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "login_risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "login_risk_assessments_user_id_created_at_idx"
  ON "login_risk_assessments"("user_id", "created_at");

CREATE INDEX "login_risk_assessments_realm_id_created_at_idx"
  ON "login_risk_assessments"("realm_id", "created_at");

CREATE INDEX "login_risk_assessments_risk_level_idx"
  ON "login_risk_assessments"("risk_level");

ALTER TABLE "login_risk_assessments"
  ADD CONSTRAINT "login_risk_assessments_realm_id_fkey"
  FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── UserLoginProfile ────────────────────────────────────────────────────────

CREATE TABLE "user_login_profiles" (
  "id"                    TEXT         NOT NULL,
  "user_id"               TEXT         NOT NULL,
  "realm_id"              TEXT         NOT NULL,
  "known_ips"             JSONB        NOT NULL DEFAULT '[]',
  "known_devices"         JSONB        NOT NULL DEFAULT '[]',
  "login_times"           JSONB        NOT NULL DEFAULT '[]',
  "last_locations"        JSONB        NOT NULL DEFAULT '[]',
  "avg_login_frequency"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updated_at"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_login_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_login_profiles_user_id_key"
  ON "user_login_profiles"("user_id");

CREATE INDEX "user_login_profiles_realm_id_idx"
  ON "user_login_profiles"("realm_id");

ALTER TABLE "user_login_profiles"
  ADD CONSTRAINT "user_login_profiles_realm_id_fkey"
  FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
