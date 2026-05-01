// Search Console requires absolute YYYY-MM-DD dates — there are no relative-date keywords
// in the API. We accept gacli-style shorthand and resolve it locally.
//
// Note: GSC data has a freshness lag of 2-3 days for `final` data state; clients targeting
// the latest data should pass `--data-state all` or accept partial coverage near `today`.
export function resolveDate(input: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return input;
  }

  const today = new Date();

  if (input === 'today') return formatDate(today);

  if (input === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }

  const daysAgoMatch = input.match(/^(\d+)daysAgo$/);
  if (daysAgoMatch) {
    const d = new Date(today);
    d.setDate(d.getDate() - Number.parseInt(daysAgoMatch[1], 10));
    return formatDate(d);
  }

  // Unknown format — pass through; the API will reject it with 400 if invalid.
  return input;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
