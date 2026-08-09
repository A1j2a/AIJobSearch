import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class WeWorkRemotelyPublicSource implements JobSource {
  public readonly name = 'weworkremotely';
  public readonly displayName = 'We Work Remotely Public';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss');
      if (res.ok) {
        return { ok: true, message: 'WeWorkRemotely public RSS feed available.' };
      }
      return { ok: false, message: `HTTP status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywordsLower = params.keywords.map(k => k.toLowerCase());
    const searchTokens = params.keywords.flatMap(k => k.toLowerCase().split(/\s+/)).filter(t => t.length > 2);

    const feeds = [
      'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
      'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
      'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
      'https://weworkremotely.com/remote-jobs.rss'
    ];

    for (const feedUrl of feeds) {
      try {
        console.log(`[JOB_SOURCE] WeWorkRemotely fetching RSS feed...`);
        const response = await fetch(feedUrl);
        if (!response.ok) continue;

        const xmlText = await response.text();
        const items = this.parseRssItems(xmlText);

        for (const item of items) {
          const titleLower = item.title.toLowerCase();
          const descLower = item.description.toLowerCase();

          // Dynamically match against active search keywords or tokens
          const isMatch = keywordsLower.some(k => titleLower.includes(k) || descLower.includes(k)) ||
                          searchTokens.some(t => titleLower.includes(t) || descLower.includes(t));

          if (isMatch) {
            rawJobs.push({
              source: this.name,
              externalId: this.hashString(item.link),
              title: item.title,
              company: item.company || 'Tech Company',
              location: item.location || 'Remote',
              remote: true,
              employmentType: 'Full Time',
              description: item.description,
              jobUrl: item.link,
              postedDate: item.pubDate ? new Date(item.pubDate).toLocaleDateString() : 'Recently'
            });
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_SOURCE] WeWorkRemotely RSS search error:`, err.message);
      }
    }

    return rawJobs;
  }

  public async getJobDetails(externalId: string): Promise<RawJobData | null> {
    return null;
  }

  public normalizeJob(raw: RawJobData): NormalizedJobData {
    return {
      source: raw.source,
      external_id: raw.externalId,
      title: raw.title.trim(),
      company: raw.company.trim(),
      location: raw.location.trim(),
      remote: true,
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      experience_min: null,
      experience_max: null,
      employment_type: raw.employmentType || 'Full Time',
      description: raw.description,
      job_url: normalizeUrl(raw.jobUrl),
      company_url: raw.companyUrl,
      posted_date: raw.postedDate,
      collected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
  }

  private parseRssItems(xmlText: string): Array<{ title: string; company?: string; location?: string; description: string; link: string; pubDate?: string }> {
    const items: Array<{ title: string; company?: string; location?: string; description: string; link: string; pubDate?: string }> = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const itemContent = match[1];

      const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/i);
      const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/i);
      const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

      if (titleMatch && linkMatch) {
        const rawTitle = this.stripCdata(titleMatch[1]).trim();
        const parts = rawTitle.split(':');

        let company: string | undefined = undefined;
        let title = rawTitle;

        if (parts.length >= 2) {
          company = parts[0].trim();
          title = parts.slice(1).join(':').trim();
        }

        const rawDesc = descMatch ? this.stripCdata(descMatch[1]) : '';
        const cleanDesc = this.stripHtml(rawDesc);

        items.push({
          title,
          company,
          location: 'Remote',
          description: cleanDesc,
          link: this.stripCdata(linkMatch[1]).trim(),
          pubDate: pubDateMatch ? this.stripCdata(pubDateMatch[1]).trim() : undefined
        });
      }
    }

    return items;
  }

  private stripCdata(str: string): string {
    return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}
