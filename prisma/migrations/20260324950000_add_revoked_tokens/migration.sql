-- CreateTable
CREATE TABLE "revoked_tokens" (
    "jti" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_tokens_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "revoked_tokens_expires_at_idx" ON "revoked_tokens"("expires_at");
