-- Weekly branch operating windows (1=Mon ... 7=Sun).
CREATE TABLE "BranchOperatingHour" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchOperatingHour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchOperatingHour_branchId_dayOfWeek_key" ON "BranchOperatingHour"("branchId", "dayOfWeek");
CREATE INDEX "BranchOperatingHour_branchId_idx" ON "BranchOperatingHour"("branchId");

ALTER TABLE "BranchOperatingHour" ADD CONSTRAINT "BranchOperatingHour_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Effective counted start for attendance (opening-time grace, etc.).
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "countedCheckInAt" TIMESTAMP(3);
