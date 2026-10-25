-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "reviewFromId" TEXT;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_reviewFromId_fkey" FOREIGN KEY ("reviewFromId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
