-- Global QR page branding (two logos), editable by master admin.
CREATE TABLE "GlobalSettings" (
    "id" TEXT NOT NULL,
    "qrLogoLeftUrl" TEXT,
    "qrLogoRightUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "GlobalSettings" ("id", "qrLogoLeftUrl", "qrLogoRightUrl", "updatedAt")
VALUES ('singleton', NULL, NULL, CURRENT_TIMESTAMP);
