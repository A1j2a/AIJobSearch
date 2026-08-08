import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface.js';
import { normalizeUrl } from '../utils/normalization.js';

export class PublicRemotiveSource implements JobSource {
  public readonly name = 'remotive';
  public readonly displayName = 'Remotive Public Jobs';
  public readonly isRestricted = false;

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('https://remotive.com/api/remote-jobs?limit=1');
      if (res.ok) {
        return { ok: true, message: 'Remotive public jobs API available.' };
      }
      return { ok: false, message: `HTTP status ${res.status}` };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const searchTerms = params.keywords.length > 0
      ? Array.from(new Set(params.keywords.flatMap(k => [k, k.split(' ')[0], k.replace(/Senior|Lead|Junior/gi, '').trim()]))).filter(Boolean)
      : ['Software Engineer', 'Backend', 'Developer'];

    // Limit to top keywords to avoid rate limits
    const topKeywords = searchTerms.slice(0, 4);

    for (const keyword of topKeywords) {
      try {
        console.log(`[JOB_SOURCE] Remotive searching keyword: "${keyword}"...`);
        const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(keyword)}&limit=15`;
        
        const response = await fetch(url);
        if (!response.ok) continue;

        const data = await response.json();
        if (data && Array.isArray(data.jobs)) {
          for (const item of data.jobs) {
            rawJobs.push({
              source: this.name,
              externalId: String(item.id),
              title: item.title || 'Mobile Developer',
              company: item.company_name || 'Technology Company',
              location: item.candidate_required_location || 'Remote',
              remote: true,
              salaryMin: item.salary ? this.parseSalaryMin(item.salary) : undefined,
              salaryMax: item.salary ? this.parseSalaryMax(item.salary) : undefined,
              salaryCurrency: 'USD',
              employmentType: item.job_type || 'Full Time',
              description: this.stripHtml(item.description || ''),
              jobUrl: item.url || '',
              companyUrl: item.company_logo_url || '',
              postedDate: item.publication_date ? new Date(item.publication_date).toLocaleDateString() : 'Recently'
            });
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_SOURCE] Remotive search error for "${keyword}":`, err.message);
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
      salary_min: raw.salaryMin || null,
      salary_max: raw.salaryMax || null,
      salary_currency: raw.salaryCurrency || 'USD',
      experience_min: raw.experienceMin || null,
      experience_max: raw.experienceMax || null,
      employment_type: raw.employmentType || 'Full Time',
      description: raw.description,
      job_url: normalizeUrl(raw.jobUrl),
      company_url: raw.companyUrl,
      posted_date: raw.postedDate,
      collected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
  }

  private parseSalaryMin(salaryStr: string): number | undefined {
    const nums = salaryStr.match(/\d+/g);
    if (nums && nums.length > 0) {
      return parseInt(nums[0], 10) * (salaryStr.toLowerCase().includes('k') ? 1000 : 1);
    }
    return undefined;
  }

  private parseSalaryMax(salaryStr: string): number | undefined {
    const nums = salaryStr.match(/\d+/g);
    if (nums && nums.length > 1) {
      return parseInt(nums[1], 10) * (salaryStr.toLowerCase().includes('k') ? 1000 : 1);
    }
    return undefined;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}
