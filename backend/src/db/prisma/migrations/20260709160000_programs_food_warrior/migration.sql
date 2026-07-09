-- AlterEnum
ALTER TYPE "ChallengeKind" ADD VALUE 'warrior';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active_program_id" UUID,
ADD COLUMN     "calorie_goal" INTEGER NOT NULL DEFAULT 2200,
ADD COLUMN     "protein_goal" INTEGER NOT NULL DEFAULT 150;

-- CreateTable
CREATE TABLE "food_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" INTEGER NOT NULL DEFAULT 0,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL,

    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "food_logs_user_id_date_idx" ON "food_logs"("user_id", "date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_active_program_id_fkey" FOREIGN KEY ("active_program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

