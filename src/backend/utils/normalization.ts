export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove UTM tracking parameters
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('utm_term');
    parsed.searchParams.delete('utm_content');
    parsed.searchParams.delete('ref');
    
    // Normalize trailing slashes
    let clean = parsed.toString();
    if (clean.endsWith('/') && parsed.pathname !== '/') {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch (e) {
    return url.trim();
  }
}

export function generateJobDedupeKey(source: string, externalId: string, jobUrl: string): string {
  const cleanUrl = normalizeUrl(jobUrl);
  return `${source.toLowerCase()}:${externalId.toLowerCase()}:${cleanUrl.toLowerCase()}`;
}
