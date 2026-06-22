-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Offer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "couponAmount" TEXT,
    "couponCode" TEXT,
    "couponExpiresAt" DATETIME,
    "originalPrice" REAL NOT NULL,
    "salePrice" REAL NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "productUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT NOT NULL,
    "category" TEXT,
    "rating" REAL,
    "aiScore" INTEGER,
    "suggestedHighlight" TEXT,
    "telegramMessage" TEXT,
    "whatsappMessage" TEXT,
    "source" TEXT NOT NULL DEFAULT 'offers-page',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Offer" ("affiliateUrl", "aiScore", "category", "couponAmount", "couponCode", "couponExpiresAt", "createdAt", "discountPct", "externalId", "id", "imageUrl", "originalPrice", "productUrl", "provider", "rating", "salePrice", "source", "suggestedHighlight", "telegramMessage", "title", "whatsappMessage") SELECT "affiliateUrl", "aiScore", "category", "couponAmount", "couponCode", "couponExpiresAt", "createdAt", "discountPct", "externalId", "id", "imageUrl", "originalPrice", "productUrl", "provider", "rating", "salePrice", "source", "suggestedHighlight", "telegramMessage", "title", "whatsappMessage" FROM "Offer";
DROP TABLE "Offer";
ALTER TABLE "new_Offer" RENAME TO "Offer";
CREATE UNIQUE INDEX "Offer_externalId_key" ON "Offer"("externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
