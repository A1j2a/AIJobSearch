import { UserProfile, SearchConfig, AppSettings, DashboardStats, Job, JobSourceInfo, LogEntry, ResumeVersion } from '../shared/types';

export interface ScanStatusResponse {
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  currentStep: string;
  jobsFound: number;
  duplicatesRemoved: number;
  jobsAnalyzed: number;
  strongMatches: number;
  error?: string;
}

export async function fetchProfile(): Promise<UserProfile> {
  const res = await fetch('/api/profile');
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function saveProfile(profile: UserProfile): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile)
  });
  if (!res.ok) throw new Error('Failed to save profile');
  return res.json();
}

export async function fetchResumeVersions(): Promise<ResumeVersion[]> {
  const res = await fetch('/api/resumes');
  if (!res.ok) throw new Error('Failed to fetch resume versions');
  return res.json();
}

export async function selectResumeVersionApi(id: number): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/resumes/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Failed to select active resume');
  return res.json();
}

export async function createResumeVersionApi(data: { name: string; version?: string; resume_text: string; file_path?: string; set_active?: boolean }): Promise<{ success: boolean; id: number; message: string }> {
  const res = await fetch('/api/resumes/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create resume version');
  return res.json();
}

export async function fetchSearchConfig(): Promise<SearchConfig> {
  const res = await fetch('/api/search-config');
  if (!res.ok) throw new Error('Failed to fetch search config');
  return res.json();
}

export async function saveSearchConfig(config: SearchConfig): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/search-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to save search config');
  return res.json();
}

export async function fetchSettings(): Promise<{ settings: AppSettings; job_sources: JobSourceInfo[] }> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function saveSettings(settings: AppSettings, job_sources: JobSourceInfo[]): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, job_sources })
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

export async function testOllama(url?: string): Promise<{ available: boolean; models: string[]; message: string }> {
  const res = await fetch('/api/settings/test-ollama', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function fetchJobs(): Promise<{ jobs: Job[]; count: number }> {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export async function fetchJobById(id: number): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}`);
  if (!res.ok) throw new Error('Failed to fetch job details');
  return res.json();
}

export async function seedDemoJobs(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/jobs/seed-demo', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to seed demo jobs');
  return res.json();
}

export async function analyzeJobApi(id: number): Promise<{ success: boolean; analysis: any }> {
  const res = await fetch(`/api/jobs/${id}/analyze`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to analyze job');
  return res.json();
}

export async function startRealScan(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/scanner/start', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start scanner');
  return res.json();
}

export async function stopRealScan(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/scanner/stop', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to stop scanner');
  return res.json();
}

export async function reanalyzeAllJobsApi(): Promise<{ success: boolean; reanalyzedCount: number }> {
  const res = await fetch('/api/scanner/reanalyze', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reanalyze jobs');
  return res.json();
}

export async function fetchScanStatus(): Promise<ScanStatusResponse> {
  const res = await fetch('/api/scanner/status');
  if (!res.ok) throw new Error('Failed to fetch scanner status');
  return res.json();
}

export async function fetchLogs(): Promise<LogEntry[]> {
  const res = await fetch('/api/logs');
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function clearLogs(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/logs', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear logs');
  return res.json();
}
