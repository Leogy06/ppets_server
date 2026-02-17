/*
  Warnings:

  - Made the column `FIRSTNAME` on table `employee` required. This step will fail if there are existing NULL values in that column.
  - Made the column `LASTNAME` on table `employee` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `originalQuantity` to the `items` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `employee` MODIFY `FIRSTNAME` VARCHAR(255) NOT NULL,
    MODIFY `LASTNAME` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `items` ADD COLUMN `originalQuantity` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `TransactionConcerns` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `intentStatus` ENUM('APPROVED', 'PENDING', 'REJECTED', 'CANCEL') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TransactionConcerns` ADD CONSTRAINT `TransactionConcerns_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
