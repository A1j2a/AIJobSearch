export interface ResumeVersion {
  id: number;
  name: string;
  version: string;
  resume_text: string;
  file_path?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id?: number;
  name: string;
  primary_role: string;
  experience_years: number;
  experience_text: string;
  primary_location: string;
  preferred_locations: string[];
  preferred_roles: string[];
  core_skills: string[];
  active_resume_id?: number | null;
  active_resume?: ResumeVersion;
  created_at?: string;
  updated_at?: string;
}

export interface SearchConfig {
  id?: number;
  keywords: string[];
  location: string;
  location_scope?: 'WORLDWIDE' | 'COUNTRY' | 'CITY';
  min_experience: number;
  max_experience: number;
  remote_allowed: boolean;
  job_type: string;
  posted_within: string;
  min_match_score: number;
  created_at?: string;
}

export interface AppSettings {
  cluster_api_url: string;
  cluster_api_key: string;
  cluster_model: string;
  cluster_temperature: number;
  cluster_max_tokens: number;
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_min_score: number;
  scheduler_enabled: boolean;
  scheduler_interval: number;
}

export interface Job {
  id: number;
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  experience_min?: number | null;
  experience_max?: number | null;
  employment_type?: string;
  description: string;
  job_url: string;
  company_url?: string;
  contact_email?: string;
  posted_date?: string;
  collected_at?: string;
  last_seen_at?: string;
  created_at?: string;
  is_demo?: boolean;

  match_score?: number;
  recommendation?: 'APPLY' | 'MAYBE' | 'SKIP';
  matching_skills?: string[];
  missing_skills?: string[];
  ai_summary?: string;
  application_status?: string;
}

export interface JobAnalysis {
  id?: number;
  job_id: number;
  match_score: number;
  role_score?: number;
  skills_score?: number;
  experience_score?: number;
  location_score?: number;
  employment_type_score?: number;
  salary_score?: number;
  seniority_score?: number;
  other_score?: number;
  matching_skills: string[];
  missing_skills: string[];
  required_skills: string[];
  nice_to_have_skills: string[];
  ai_summary: string;
  recommendation: 'APPLY' | 'MAYBE' | 'SKIP';
  analyzed_at?: string;
}

export interface JobApplication {
  id?: number;
  job_id: number;
  status: 'Saved' | 'Applied' | 'Recruiter Contacted' | 'Interview' | 'Technical Round' | 'HR Round' | 'Offer' | 'Rejected' | 'Withdrawn';
  applied_at?: string;
  resume_version?: string;
  recruiter_name?: string;
  recruiter_url?: string;
  notes?: string;
  follow_up_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface JobSourceInfo {
  id: number;
  name: string;
  display_name: string;
  is_enabled: boolean;
  status: string;
  created_at?: string;
}

export interface LogEntry {
  id: number;
  component: string;
  event: string;
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  timestamp: string;
}

export interface DashboardStats {
  new_jobs: number;
  jobs_analyzed: number;
  strong_matches: number;
  applications: number;
  interviews: number;
}
