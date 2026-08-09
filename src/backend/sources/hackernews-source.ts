import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface.js';

export class HackerNewsJobsSource implements JobSource {
  public readonly name = 'hackernews';
  public readonly displayName = 'HackerNews Tech & Startup Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://hacker-news.firebaseio.com/v0/jobstories.json');
      if (res.ok) {
        return { ok: true, message: 'HackerNews Firebase API operational.' };
      }
      return { ok: false, message: `HN status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: `HN error: ${e.message}` };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    console.log(`[JOB_SOURCE] HackerNews fetching latest job stories...`);
    const results: RawJobData[] = [];

    try {
      const res = await fetch('https://hacker-news.firebaseio.com/v0/jobstories.json');
      if (!res.ok) return [];

      const storyIds: number[] = (await res.json()) || [];
      const topIds = storyIds.slice(0, 20); // Top 20 job postings

      for (const id of topIds) {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!itemRes.ok) continue;
          const item = await itemRes.json();
          if (!item || !item.title) continue;

          const fullText = `${item.title} ${item.text || ''}`.toLowerCase();
          const matchesKeyword = params.keywords.some(kw => fullText.includes(kw.toLowerCase()));
          if (!matchesKeyword) continue;

          // Extract company and title if formatted as "Company is hiring Title"
          let title = item.title;
          let company = 'YC / HackerNews Startup';
          if (title.includes('is hiring')) {
            const parts = title.split('is hiring');
            company = parts[0].trim();
            title = parts[1].trim();
          }

          results.push({
            source: this.name,
            externalId: `hn-${item.id}`,
            title,
            company,
            location: 'Remote / Global',
            remote: true,
            description: item.text || item.title,
            jobUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
            postedDate: item.time ? new Date(item.time * 1000).toISOString() : new Date().toISOString(),
            rawData: item
          });
        } catch (e) {}
      }
    } catch (err: any) {
      console.warn('[JOB_SOURCE] HackerNews fetch warning:', err.message);
    }

    return results;
  }

  public async getJobDetails(externalId: string): Promise<RawJobData | null> {
    return null;
  }

  public normalizeJob(raw: RawJobData): NormalizedJobData {
    const now = new Date().toISOString();
    return {
      source: this.name,
      external_id: raw.externalId,
      title: raw.title,
      company: raw.company,
      location: raw.location || 'Remote',
      remote: true,
      salary_min: null,
      salary_max: null,
      salary_currency: 'USD',
      experience_min: null,
      experience_max: null,
      employment_type: 'Full Time',
      description: raw.description,
      job_url: raw.jobUrl,
      posted_date: raw.postedDate || now,
      collected_at: now,
      last_seen_at: now
    };
  }
}
