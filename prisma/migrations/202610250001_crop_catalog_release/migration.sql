-- T011 reviewed additive catalog release, approved in D-P03-012.
-- Stable IDs; existing catalog entries and historical crop-name snapshots are preserved.
BEGIN;
LOCK TABLE "CropCatalog" IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO "CropCatalog" (id, name) VALUES
('f4030011-0000-4000-8000-000000000001', 'Beans'),
('f4030011-0000-4000-8000-000000000002', 'Bananas (matooke)'),
('f4030011-0000-4000-8000-000000000003', 'Cassava'),
('f4030011-0000-4000-8000-000000000004', 'Sweet potatoes'),
('f4030011-0000-4000-8000-000000000005', 'Irish potatoes'),
('f4030011-0000-4000-8000-000000000006', 'Groundnuts'),
('f4030011-0000-4000-8000-000000000007', 'Sorghum'),
('f4030011-0000-4000-8000-000000000008', 'Millet'),
('f4030011-0000-4000-8000-000000000009', 'Sunflower'),
('f4030011-0000-4000-8000-000000000010', 'Tea'),
('f4030011-0000-4000-8000-000000000011', 'Tomatoes'),
('f4030011-0000-4000-8000-000000000012', 'Cabbage');

-- Fail atomically if an existing entry (including an inactive one) collides under
-- the reviewed case/whitespace identity rule. Do not silently skip conflicting IDs/names.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "CropCatalog"
    GROUP BY lower(regexp_replace(normalize(btrim(name), NFC), '\s+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Catalog release conflicts with existing names' USING ERRCODE = '23505';
  END IF;
END $$;
COMMIT;
