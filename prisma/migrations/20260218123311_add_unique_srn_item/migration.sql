/*
  Warnings:

  - A unique constraint covering the columns `[SERIAL_NO]` on the table `items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `items_SERIAL_NO_key` ON `items`(`SERIAL_NO`);
