-- CreateTable
CREATE TABLE "Offer" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discount" TEXT NOT NULL,
    "minValue" REAL,
    "category" TEXT,
    "expiresAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "whatsappMessage" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repostedAt" DATETIME,
    "success" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Post_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_externalId_key" ON "Offer"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_provider_key" ON "Coupon"("code", "provider");
