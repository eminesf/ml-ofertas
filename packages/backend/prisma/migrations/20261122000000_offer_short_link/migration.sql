-- Link curto (/r/{shortCode} no site) e contador de cliques
ALTER TABLE "Offer" ADD COLUMN "shortCode" TEXT;
ALTER TABLE "Offer" ADD COLUMN "clicks" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Offer_shortCode_key" ON "Offer"("shortCode");
