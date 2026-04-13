/**
 * Format a numeric amount as a currency string using the business's currency.
 * Falls back to USD if currency is not provided.
 *
 * Examples:
 *   formatCurrency(49.5, 'USD')  → "$49.50"
 *   formatCurrency(49.5, 'CAD')  → "CA$49.50"
 *   formatCurrency(49.5, 'AUD')  → "A$49.50"
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format without cents (for large summary numbers like totals/earnings).
 */
export function formatCurrencyRounded(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
