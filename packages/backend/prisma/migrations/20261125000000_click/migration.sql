-- CreateTable
CREATE TABLE "Click" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "src" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Click_at_idx" ON "Click"("at");

-- CreateIndex
CREATE INDEX "Click_offerId_idx" ON "Click"("offerId");
