-- Per-company logo on public QR page (alongside global WAQT logo).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "qrCompanyLogoUrl" TEXT;
