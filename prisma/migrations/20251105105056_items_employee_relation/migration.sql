/*
  Warnings:

  - Made the column `ADDED_BY` on table `items` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `items` MODIFY `ADDED_BY` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `items` ADD CONSTRAINT `items_ADDED_BY_fkey` FOREIGN KEY (`ADDED_BY`) REFERENCES `employee`(`ID`) ON DELETE RESTRICT ON UPDATE CASCADE;
