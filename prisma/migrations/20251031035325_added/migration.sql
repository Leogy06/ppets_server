-- CreateTable
CREATE TABLE `Account_request` (
    `id` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `employeeId` INTEGER NOT NULL,
    `approve` ENUM('NO', 'YES') NOT NULL DEFAULT 'NO',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
