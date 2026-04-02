-- AlterTable (idempotent for databases already synced via db push)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Branch' AND column_name = 'publicKioskToken'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "publicKioskToken" TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Branch' AND column_name = 'publicKioskExpiresAt'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "publicKioskExpiresAt" TIMESTAMP(3);
  END IF;
END $$;
