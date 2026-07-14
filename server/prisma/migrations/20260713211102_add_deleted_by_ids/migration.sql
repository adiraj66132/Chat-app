-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deleted_by_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
