-- CreateTable
CREATE TABLE "Ambassador" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "zipCode" TEXT NOT NULL,
    "radius" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "role" TEXT NOT NULL DEFAULT 'ambassador',
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ambassador_zipCode_fkey" FOREIGN KEY ("zipCode") REFERENCES "ZipCode" ("zip") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommunityPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zipCode" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT NOT NULL,
    "postType" TEXT NOT NULL DEFAULT 'community',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "flags" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "ambassadorId" TEXT,
    "fingerprintHash" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityPost_zipCode_fkey" FOREIGN KEY ("zipCode") REFERENCES "ZipCode" ("zip") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommunityPost_ambassadorId_fkey" FOREIGN KEY ("ambassadorId") REFERENCES "Ambassador" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CommunityPost" ("body", "category", "createdAt", "fingerprintHash", "flags", "id", "status", "upvotes", "zipCode") SELECT "body", "category", "createdAt", "fingerprintHash", "flags", "id", "status", "upvotes", "zipCode" FROM "CommunityPost";
DROP TABLE "CommunityPost";
ALTER TABLE "new_CommunityPost" RENAME TO "CommunityPost";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Ambassador_email_key" ON "Ambassador"("email");
