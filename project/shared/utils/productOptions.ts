/** Read option price delta from DB/UI JSON (camelCase or snake_case). */
export function optionPriceModifier(
  opt: { priceModifier?: number; price_modifier?: number } | null | undefined,
): number {
  if (!opt) return 0;
  const raw = opt.priceModifier ?? opt.price_modifier ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
