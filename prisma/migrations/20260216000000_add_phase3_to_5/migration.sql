-- Phase 3: Password policies on realms
ALTER TABLE "realms" ADD COLUMN "password_min_length" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "realms" ADD COLUMN "password_require_uppercase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "password_require_lowercase" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "password_require_digits" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "password_require_special_chars" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "password_history_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "realms" ADD COLUMN "password_max_age_days" INTEGER NOT NULL DEFAULT 0;

-- Phase 3: Brute force on realms
ALTER TABLE "realms" ADD COLUMN "brute_force_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "max_login_failures" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "realms" ADD COLUMN "lockout_duration" INTEGER NOT NULL DEFAULT 900;
ALTER TABLE "realms" ADD COLUMN "failure_reset_time" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "realms" ADD COLUMN "permanent_lockout_after" INTEGER NOT NULL DEFAULT 0;

-- Phase 3: MFA on realms
ALTER TABLE "realms" ADD COLUMN "mfa_required" BOOLEAN NOT NULL DEFAULT false;

-- Phase 4: Offline tokens on realms
ALTER TABLE "realms" ADD COLUMN "offline_token_lifespan" INTEGER NOT NULL DEFAULT 2592000;

-- Phase 5: Events on realms
ALTER TABLE "realms" ADD COLUMN "events_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "realms" ADD COLUMN "events_expiration" INTEGER NOT NULL DEFAULT 604800;
ALTER TABLE "realms" ADD COLUMN "admin_events_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Phase 3: User columns
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);

-- Phase 3: Client columns (backchannel logout)
ALTER TABLE "clients" ADD COLUMN "backchannel_logout_uri" TEXT;
ALTER TABLE "clients" ADD COLUMN "backchannel_logout_session_required" BOOLEAN NOT NULL DEFAULT true;

-- Phase 4: Service account on clients
ALTER TABLE "clients" ADD COLUMN "service_account_user_id" TEXT;

-- Phase 4: Offline flag on refresh tokens
ALTER TABLE "refresh_tokens" ADD COLUMN "is_offline" BOOLEAN NOT NULL DEFAULT false;

-- Phase 3: Password history
CREATE TABLE "password_histories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_histories_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "password_histories" ADD CONSTRAINT "password_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "password_histories" ADD CONSTRAINT "password_histories_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 3: Login failures (brute force)
CREATE TABLE "login_failures" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "user_id" TEXT,
    "ip_address" TEXT,
    "failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_failures_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_failures_realm_id_user_id_failed_at_idx" ON "login_failures"("realm_id", "user_id", "failed_at");
ALTER TABLE "login_failures" ADD CONSTRAINT "login_failures_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "login_failures" ADD CONSTRAINT "login_failures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 3: MFA credentials (TOTP)
CREATE TABLE "user_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'totp',
    "secret_key" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA1',
    "digits" INTEGER NOT NULL DEFAULT 6,
    "period" INTEGER NOT NULL DEFAULT 30,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_credentials_user_id_type_key" ON "user_credentials"("user_id", "type");
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 3: Recovery codes
CREATE TABLE "recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_codes_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4: Client scopes
CREATE TABLE "client_scopes" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'openid-connect',
    "built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "client_scopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_scopes_realm_id_name_key" ON "client_scopes"("realm_id", "name");
ALTER TABLE "client_scopes" ADD CONSTRAINT "client_scopes_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4: Protocol mappers
CREATE TABLE "protocol_mappers" (
    "id" TEXT NOT NULL,
    "client_scope_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'openid-connect',
    "mapper_type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "protocol_mappers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "protocol_mappers_client_scope_id_name_key" ON "protocol_mappers"("client_scope_id", "name");
ALTER TABLE "protocol_mappers" ADD CONSTRAINT "protocol_mappers_client_scope_id_fkey" FOREIGN KEY ("client_scope_id") REFERENCES "client_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4: Client default scopes
CREATE TABLE "client_default_scopes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_scope_id" TEXT NOT NULL,
    CONSTRAINT "client_default_scopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_default_scopes_client_id_client_scope_id_key" ON "client_default_scopes"("client_id", "client_scope_id");
ALTER TABLE "client_default_scopes" ADD CONSTRAINT "client_default_scopes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_default_scopes" ADD CONSTRAINT "client_default_scopes_client_scope_id_fkey" FOREIGN KEY ("client_scope_id") REFERENCES "client_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4: Client optional scopes
CREATE TABLE "client_optional_scopes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_scope_id" TEXT NOT NULL,
    CONSTRAINT "client_optional_scopes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_optional_scopes_client_id_client_scope_id_key" ON "client_optional_scopes"("client_id", "client_scope_id");
ALTER TABLE "client_optional_scopes" ADD CONSTRAINT "client_optional_scopes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_optional_scopes" ADD CONSTRAINT "client_optional_scopes_client_scope_id_fkey" FOREIGN KEY ("client_scope_id") REFERENCES "client_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 4: Device codes
CREATE TABLE "device_codes" (
    "id" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "user_code" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "scope" TEXT,
    "user_id" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "denied" BOOLEAN NOT NULL DEFAULT false,
    "interval" INTEGER NOT NULL DEFAULT 5,
    "last_polled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "device_codes_device_code_key" ON "device_codes"("device_code");
CREATE UNIQUE INDEX "device_codes_user_code_key" ON "device_codes"("user_code");

-- Phase 5: Login events
CREATE TABLE "login_events" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "type" TEXT NOT NULL,
    "client_id" TEXT,
    "ip_address" TEXT,
    "error" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_events_realm_id_created_at_idx" ON "login_events"("realm_id", "created_at");
CREATE INDEX "login_events_realm_id_type_idx" ON "login_events"("realm_id", "type");
CREATE INDEX "login_events_realm_id_user_id_idx" ON "login_events"("realm_id", "user_id");
ALTER TABLE "login_events" ADD CONSTRAINT "login_events_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 5: Admin events
CREATE TABLE "admin_events" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_path" TEXT NOT NULL,
    "representation" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_events_realm_id_created_at_idx" ON "admin_events"("realm_id", "created_at");
CREATE INDEX "admin_events_realm_id_resource_type_idx" ON "admin_events"("realm_id", "resource_type");
ALTER TABLE "admin_events" ADD CONSTRAINT "admin_events_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
