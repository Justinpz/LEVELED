-- Sixth body part: Shoulders (deltoid work gets its own XP track + gear slot).
ALTER TYPE "BodyPart" ADD VALUE IF NOT EXISTS 'Shoulders';
ALTER TYPE "GearSlot" ADD VALUE IF NOT EXISTS 'shoulders';
