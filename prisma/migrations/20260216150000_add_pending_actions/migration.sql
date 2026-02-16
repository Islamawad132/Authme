-- CreateTable
CREATE TABLE "pending_actions" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_actions_token_hash_key" ON "pending_actions"("token_hash");

-- CreateIndex
CREATE INDEX "pending_actions_expires_at_idx" ON "pending_actions"("expires_at");
