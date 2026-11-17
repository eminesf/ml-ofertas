-- CreateTable
CREATE TABLE "FeedPrice" (
    "externalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedPrice_pkey" PRIMARY KEY ("externalId")
);

-- CreateIndex
CREATE INDEX "FeedPrice_provider_idx" ON "FeedPrice"("provider");
