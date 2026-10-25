-- Additive authentication/session and asset-return support.
ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;
ALTER TABLE `transactions`
  ADD COLUMN `returnedAt` DATETIME(3) NULL,
  MODIFY `status` ENUM('APPROVED', 'PENDING', 'REJECTED', 'CANCEL', 'RETURNED') NOT NULL DEFAULT 'PENDING';
-- The shared Prisma status enum also backs transaction concern intentStatus.
ALTER TABLE `transactionConcerns`
  MODIFY `intentStatus` ENUM('APPROVED', 'PENDING', 'REJECTED', 'CANCEL', 'RETURNED') NOT NULL;

CREATE TABLE `AuthSession` (
  `tokenHash` VARCHAR(64) NOT NULL,
  `userId` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuthSession_userId_idx` (`userId`),
  INDEX `AuthSession_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`tokenHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuthToken` (
  `tokenHash` VARCHAR(64) NOT NULL,
  `userId` INTEGER NOT NULL,
  `purpose` ENUM('VERIFY_EMAIL', 'RESET_PASSWORD') NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuthToken_userId_idx` (`userId`),
  INDEX `AuthToken_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`tokenHash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
