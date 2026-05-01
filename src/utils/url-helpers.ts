// Search Console identifies a property by `siteUrl`, which has two distinct shapes:
//   - URL-prefix property:    "https://example.com/" (trailing slash, scheme required)
//   - Domain property:        "sc-domain:example.com" (no scheme, no path)
//
// Most user mistakes ("example.com", "https://example.com" without slash) silently mismatch
// the registered property and produce a 403. Normalise on entry.

export function normalizeSiteUrl(input: string): string {
  if (!input) return input;
  const trimmed = input.trim();

  // Already a domain property — return as-is.
  if (trimmed.startsWith('sc-domain:')) return trimmed;

  // URL-prefix property: must have scheme and a trailing slash.
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  // No scheme: ambiguous. We do NOT silently coerce to https:// because that may mismatch
  // the registered property. Surface the issue at the call site instead.
  return trimmed;
}

export function isDomainProperty(siteUrl: string): boolean {
  return siteUrl.startsWith('sc-domain:');
}

// Many Search Console endpoints (sitemaps, urlInspection) take siteUrl as a query string.
// googleapis handles encoding for us, but normalisation must run first or we'll send
// "https://example.com" when the property is registered as "https://example.com/".
export function ensureValidSiteUrl(input: string): string {
  const normalised = normalizeSiteUrl(input);
  if (!normalised) {
    throw new Error('Site URL is required. Use -s <url> or set via: gsccli config set site <url>');
  }
  if (!normalised.startsWith('sc-domain:') && !/^https?:\/\//i.test(normalised)) {
    throw new Error(
      `Invalid site URL: "${input}". Use either "https://example.com/" or "sc-domain:example.com".`,
    );
  }
  return normalised;
}
