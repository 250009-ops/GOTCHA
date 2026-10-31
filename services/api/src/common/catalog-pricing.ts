/**
 * final-5: catalog base price in soʻm. Prod stores it under the legacy key basePriceUsd (value 49000 = soʻm, set by DevOps).
 * basePriceSom is the name going forward. A legacy value below 1000 is the old USD default ($4.99) and is never read as soʻm.
 * Kai: flat 49,000 soʻm, per-page surcharge 0. The Plus discount is applied at checkout, never stored here.
 */
export const CATALOG_BASE_SOM_DEFAULT = 49000;

export function catalogBaseSom(value: unknown): number {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const som = Number(v.basePriceSom);
  if (Number.isInteger(som) && som > 0) return som;
  const legacy = Number(v.basePriceUsd);
  if (Number.isFinite(legacy) && legacy >= 1000) return Math.round(legacy);
  return CATALOG_BASE_SOM_DEFAULT;
}

type SettingsDb = {
  platformSetting: {
    findUnique(args: { where: { key: string } }): Promise<{ value: unknown } | null>;
    update(args: { where: { key: string }; data: { value: any } }): Promise<unknown>;
  };
};

/**
 * Non-destructive, idempotent copy basePriceUsd (legacy name, soʻm) -> basePriceSom. Run from prisma/seed.ts, not a migration
 * (Kai's guard: no migration UPDATEs platform_settings). Only ADDS basePriceSom/perPageSurchargeSom/currency when basePriceSom
 * is absent; never deletes the legacy key, never overwrites an existing basePriceSom, never creates the row. Returns true if it wrote.
 */
export async function copyCatalogBaseSom(db: SettingsDb): Promise<boolean> {
  const row = await db.platformSetting.findUnique({ where: { key: 'catalogPricingRules' } });
  if (!row?.value || typeof row.value !== 'object' || Array.isArray(row.value)) return false;
  const v = row.value as Record<string, unknown>;
  if (v.basePriceSom !== undefined) return false;
  await db.platformSetting.update({
    where: { key: 'catalogPricingRules' },
    data: { value: { ...v, basePriceSom: catalogBaseSom(v), perPageSurchargeSom: 0, currency: 'UZS' } },
  });
  return true;
}
