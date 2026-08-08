export interface SearchQueryParams {
  keywords: string[];
  location: string;
  minExperience?: number;
  maxExperience?: number;
  remoteAllowed?: boolean;
  jobType?: string;
  postedWithin?: string;
}

export interface RawJobData {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  experienceMin?: number;
  experienceMax?: number;
  employmentType?: string;
  description: string;
  jobUrl: string;
  companyUrl?: string;
  contactEmail?: string;
  postedDate?: string;
  rawData?: any;
}

export interface NormalizedJobData {
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency: string;
  experience_min?: number | null;
  experience_max?: number | null;
  employment_type?: string;
  description: string;
  job_url: string;
  company_url?: string;
  posted_date?: string;
  collected_at: string;
  last_seen_at: string;
}

export interface JobSource {
  readonly name: string;
  readonly displayName: string;
  readonly isRestricted: boolean;

  healthCheck(): Promise<{ ok: boolean; message: string }>;
  searchJobs(params: SearchQueryParams): Promise<RawJobData[]>;
  getJobDetails(externalId: string): Promise<RawJobData | null>;
  normalizeJob(raw: RawJobData): NormalizedJobData;
}
