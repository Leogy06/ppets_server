/*
  Warnings:

  - Made the column `ID_NUMBER` on table `employee` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `employee` MODIFY `ID_NUMBER` INTEGER NOT NULL;
