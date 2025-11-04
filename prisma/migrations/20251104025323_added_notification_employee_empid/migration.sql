/*
  Warnings:

  - Added the required column `empId` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `notification` ADD COLUMN `empId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_empId_fkey` FOREIGN KEY (`empId`) REFERENCES `employee`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
