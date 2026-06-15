/** Minimal RFC 4180 CSV serializer with formula-injection mitigation. */
export function toCsv(
  rows: Record<string, unknown>[],
  columns?: string[]
): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "string" ? v : String(v);
    // CSV-injection defense: any cell starting with =, +, -, @, tab, or CR
    // is prefixed with a single quote so spreadsheet apps treat it as text.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(",")];
  for (const row of rows) {
    lines.push(cols.map((c) => escape(row[c])).join(","));
  }
  return lines.join("\r\n");
}
