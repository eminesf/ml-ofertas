-- Preço/cupom no momento do post e preço anunciado pela fonte: detectar promoção nova do mesmo produto
ALTER TABLE "Offer" ADD COLUMN "sourcePrice" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "price" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "couponCode" TEXT;
