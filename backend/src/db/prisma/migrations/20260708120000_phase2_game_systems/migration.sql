-- CreateEnum
CREATE TYPE "CharClass" AS ENUM ('warrior', 'mage', 'beast');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('Arms', 'Legs', 'Chest', 'Back', 'Core');

-- CreateEnum
CREATE TYPE "GearTier" AS ENUM ('iron', 'mythic', 'celestial', 'abyssal', 'ascendant');

-- CreateEnum
CREATE TYPE "GearSlot" AS ENUM ('arms', 'legs', 'chest', 'back', 'core');

-- CreateEnum
CREATE TYPE "ChallengeKind" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "ChallengeDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "char_class" "CharClass" NOT NULL DEFAULT 'warrior',
ADD COLUMN     "current_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_workout_date" DATE;

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "movement_pattern" TEXT,
ADD COLUMN     "primary_body_parts" TEXT[],
ADD COLUMN     "secondary_body_parts" TEXT[],
ADD COLUMN     "secondary_muscles" TEXT[];

-- CreateTable
CREATE TABLE "body_part_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body_part" "BodyPart" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lifetime_xp" INTEGER NOT NULL DEFAULT 0,
    "spendable_points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "body_part_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gear_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" "GearTier" NOT NULL,
    "slot" "GearSlot" NOT NULL,
    "class_compatibility" TEXT NOT NULL,
    "cost_pts" INTEGER NOT NULL,
    "level_gate" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "flavor_text" TEXT NOT NULL,
    "visual_notes" TEXT,
    "glow_color" TEXT,
    "particles" TEXT,
    "image_asset_path" TEXT,
    "image_source_sheet" TEXT,

    CONSTRAINT "gear_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_gear" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gear_item_id" TEXT NOT NULL,
    "owned" BOOLEAN NOT NULL DEFAULT true,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_gear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_weeks" INTEGER NOT NULL,
    "days_per_week" INTEGER NOT NULL,
    "cover_image" TEXT,
    "designed_by" TEXT,
    "is_starter" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_days" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_rest" BOOLEAN NOT NULL DEFAULT false,
    "body_parts" TEXT[],

    CONSTRAINT "program_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_exercises" (
    "id" UUID NOT NULL,
    "program_day_id" UUID NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "order_in_series" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" TEXT NOT NULL,
    "rest_seconds" INTEGER NOT NULL,
    "rpe" DOUBLE PRECISION,
    "superset_group" TEXT,
    "notes" TEXT,

    CONSTRAINT "program_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "program_day_id" UUID,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logged_sets" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "rpe" DOUBLE PRECISION,
    "notes" TEXT,
    "xp_awarded" JSONB,
    "logged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logged_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "kind" "ChallengeKind" NOT NULL,
    "difficulty" "ChallengeDifficulty" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reward_pts" INTEGER NOT NULL,
    "body_part_targets" TEXT[],
    "criteria" JSONB,
    "active_on" DATE,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "titles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_titles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title_id" TEXT NOT NULL,
    "earned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "cardio_minutes_required" INTEGER NOT NULL,
    "theme" TEXT,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_vehicles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "body_part_progress_user_id_body_part_key" ON "body_part_progress"("user_id", "body_part");

-- CreateIndex
CREATE INDEX "gear_items_tier_slot_idx" ON "gear_items"("tier", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "user_gear_user_id_gear_item_id_key" ON "user_gear"("user_id", "gear_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_days_program_id_day_number_key" ON "program_days"("program_id", "day_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_challenges_user_id_challenge_id_key" ON "user_challenges"("user_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_titles_user_id_title_id_key" ON "user_titles"("user_id", "title_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_vehicles_user_id_vehicle_id_key" ON "user_vehicles"("user_id", "vehicle_id");

-- AddForeignKey
ALTER TABLE "body_part_progress" ADD CONSTRAINT "body_part_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gear" ADD CONSTRAINT "user_gear_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_gear" ADD CONSTRAINT "user_gear_gear_item_id_fkey" FOREIGN KEY ("gear_item_id") REFERENCES "gear_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_days" ADD CONSTRAINT "program_days_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_exercises" ADD CONSTRAINT "program_exercises_program_day_id_fkey" FOREIGN KEY ("program_day_id") REFERENCES "program_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_exercises" ADD CONSTRAINT "program_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logged_sets" ADD CONSTRAINT "logged_sets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logged_sets" ADD CONSTRAINT "logged_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vehicles" ADD CONSTRAINT "user_vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vehicles" ADD CONSTRAINT "user_vehicles_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

