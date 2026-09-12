-- CreateEnum
CREATE TYPE "ManagerCommissionMode" AS ENUM ('NONE', 'TEAM_SUM', 'CUSTOM');

-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "managerCommissionMode" "ManagerCommissionMode" NOT NULL DEFAULT 'TEAM_SUM',
ADD COLUMN     "managerCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 100;
