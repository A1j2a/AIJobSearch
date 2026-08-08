import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface.js';
import { normalizeUrl } from '../utils/normalization.js';

export class LinkedInPublicSource implements JobSource {
  public readonly name = 'linkedin';
  public readonly displayName = 'LinkedIn Jobs (India & Global)';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=React%20Native&location=India&start=0', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (res.ok) {
        return { ok: true, message: 'LinkedIn Public Jobs API available.' };
      }
      return { ok: false, message: `HTTP status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywords = params.keywords.length > 0 ? params.keywords.slice(0, 3) : ['React Native Developer', 'Software Engineer'];
    const locationStr = params.location && params.location.trim().length > 0 ? params.location : 'India';

    for (const keyword of keywords) {
      try {
        console.log(`[JOB_SOURCE] LinkedIn Guest API searching for "${keyword}" in "${locationStr}"...`);
        const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(locationStr)}&start=0`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (!response.ok) continue;

        const html = await response.text();
        const cardRegex = /<li[\s\S]*?<\/li>/gi;
        let match;

        while ((match = cardRegex.exec(html)) !== null) {
          const cardHtml = match[0];
          const titleM = cardHtml.match(/<h3 class=\"base-search-card__title\">([\s\S]*?)<\/h3>/i);
          const compM = cardHtml.match(/<h4 class=\"base-search-card__subtitle\">([\s\S]*?)<\/h4>/i);
          const locM = cardHtml.match(/<span class=\"job-search-card__location\">([\s\S]*?)<\/span>/i);
          const linkM = cardHtml.match(/<a class=\"base-card__full-link[^\"]*\" href=\"([^\"]+)\"/i);
          const dateM = cardHtml.match(/<time[^\"]*datetime=\"([^\"]+)\"[^>]*>([\s\S]*?)<\/time>/i);

          if (titleM && compM) {
            const title = titleM[1].replace(/<[^>]*>?/g, '').trim();
            const company = compM[1].replace(/<[^>]*>?/g, '').trim();
            const location = locM ? locM[1].replace(/<[^>]*>?/g, '').trim() : locationStr;
            const jobUrl = linkM ? linkM[1].split('?')[0] : 'https://www.linkedin.com/jobs';
            const postedDate = dateM ? dateM[2].replace(/<[^>]*>?/g, '').trim() : 'Recently';

            const externalId = `linkedin-${jobUrl.split('-').slice(-1)[0] || Math.random().toString(36).substring(2, 9)}`;

            rawJobs.push({
              source: this.name,
              externalId,
              title,
              company,
              location,
              remote: location.toLowerCase().includes('remote') || location.toLowerCase().includes('anywhere'),
              employmentType: 'Full Time',
              description: `LinkedIn Live Job Posting: ${title} position at ${company} located in ${location}. Apply directly on LinkedIn via official job link.`,
              jobUrl,
              companyUrl: `https://www.linkedin.com/company/${encodeURIComponent(company.toLowerCase().replace(/\s+/g, '-'))}`,
              postedDate
            });
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_SOURCE] LinkedIn search error for keyword "${keyword}":`, err.message);
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
      remote: Boolean(raw.remote),
      salary_min: null,
      salary_max: null,
      salary_currency: 'INR',
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
}
