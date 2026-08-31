-- CreateEnum
CREATE TYPE "TournamentMetric" AS ENUM ('AVG_ACHIEVEMENT', 'TOTAL_COMMISSION');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prizeDescription" TEXT NOT NULL,
    "metric" "TournamentMetric" NOT NULL DEFAULT 'AVG_ACHIEVEMENT',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_networkId_endAt_idx" ON "Tournament"("networkId", "endAt");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
