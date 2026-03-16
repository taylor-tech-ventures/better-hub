/** Returns the current year-month in 'YYYY-MM' format. */
export function currentYearMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Returns the year-month N months offset from the given one. */
export function offsetYearMonth(
  yearMonth: string,
  offsetMonths: number,
): string {
  const [y, m] = yearMonth.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  return d.toISOString().slice(0, 7);
}
