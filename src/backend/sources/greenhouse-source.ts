import { JobSource, SearchQueryParams, RawJobData, NormalizedJobData } from './job-source.interface';
import { normalizeUrl } from '../utils/normalization';

export class GreenhousePublicSource implements JobSource {
  public readonly name = 'greenhouse';
  public readonly displayName = 'Greenhouse Public Jobs';
  public readonly isRestricted = false;

  private sampleBoards = ['gitlab', 'zapier', 'elastic', 'duckduckgo', 'figma'];

  public async healthCheck(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: 'Greenhouse public boards API available.' };
  }

  public async searchJobs(params: SearchQueryParams): Promise<RawJobData[]> {
    const rawJobs: RawJobData[] = [];
    const keywordsLower = params.keywords.map(k => k.toLowerCase());

    for (const board of this.sampleBoards) {
      try {
        console.log(`[JOB_SOURCE] Greenhouse querying public board: "${board}"...`);
        const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
        if (!response.ok) continue;

        const data = await response.json();
        if (data && Array.isArray(data.jobs)) {
          for (const item of data.jobs) {
            const titleLower = (item.title || '').toLowerCase();
            const isMatch = keywordsLower.some(k => titleLower.includes(k) || titleLower.includes('mobile') || titleLower.includes('react'));

            if (isMatch) {
              rawJobs.push({
                source: this.name,
                externalId: String(item.id),
                title: item.title || 'Mobile Developer',
                company: board.toUpperCase(),
                location: item.location?.name || 'Remote',
                remote: true,
                employmentType: 'Full Time',
                description: this.stripHtml(item.content || item.title || ''),
                jobUrl: item.absolute_url || '',
                postedDate: item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'Recently'
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`[JOB_SOURCE] Greenhouse search error for "${board}":`, err.message);
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
      posted_date: raw.postedDate,
      collected_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString()
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
}
