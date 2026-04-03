-- Branch shift templates (start/end local time).
CREATE TABLE "BranchShift" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BranchShift_branchId_idx" ON "BranchShift"("branchId");

ALTER TABLE "BranchShift" ADD CONSTRAINT "BranchShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
