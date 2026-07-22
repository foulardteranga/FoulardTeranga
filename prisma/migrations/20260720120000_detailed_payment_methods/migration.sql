-- Portefeuilles Mobile Money ivoiriens détaillés. `mm` reste pour l'historique.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'orange_money';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'wave';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'moov_money';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'mtn_momo';
