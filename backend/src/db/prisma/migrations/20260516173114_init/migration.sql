-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whoop_connections" (
    "user_id" UUID NOT NULL,
    "access_token" BYTEA NOT NULL,
    "access_token_iv" BYTEA NOT NULL,
    "refresh_token" BYTEA NOT NULL,
    "refresh_token_iv" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "scopes" TEXT NOT NULL,
    "whoop_user_id" INTEGER NOT NULL,
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMPTZ(6),

    CONSTRAINT "whoop_connections_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "force" TEXT,
    "mechanic" TEXT,
    "equipment" TEXT,
    "category" TEXT,
    "primary_muscles" TEXT[],
    "body_parts" TEXT[],
    "instructions" TEXT[],
    "images" TEXT[],

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "exercises_body_parts_idx" ON "exercises" USING GIN ("body_parts");

-- AddForeignKey
ALTER TABLE "whoop_connections" ADD CONSTRAINT "whoop_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
