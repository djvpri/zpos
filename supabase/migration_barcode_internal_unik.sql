-- ZPos: kunci duplikat barcode_internal (8 digit internal label 25mm).
-- generateProductBarcode(id) unik per id, tapi kunci DB mengamankan terhadap
-- bug generate / input manual / backfill di masa depan.
-- Partial unique per-toko (konsisten dgn produk_toko_barcode_unik utk kolom barcode).
CREATE UNIQUE INDEX IF NOT EXISTS produk_toko_barcode_internal_unik
  ON public.produk (toko_id, barcode_internal)
  WHERE (barcode_internal IS NOT NULL AND barcode_internal <> '');
