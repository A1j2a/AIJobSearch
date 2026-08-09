import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Star,
  Send,
  Search,
  RefreshCw,
  MapPin,
  Building,
  Target,
  Sparkles,
  Bookmark,
  Play,
  Square,
  Cpu,
  Zap,
  Brain,
  Globe,
  Key,
  FileText,
  ChevronRight
} from 'lucide-react';
import { Job, UserProfile, SearchConfig, AppSettings, JobSourceInfo } from '../../shared/types';
import {
  fetchDashboardStats,
  fetchJobs,
  fetchProfile,
  fetchSearchConfig,
  fetchSettings,
  saveSettings,
  startRealScan,
  stopRealScan,
  fetchScanStatus,
  updateApplicationStatusApi,
  ScanStatusResponse
} from '../api';

interface DashboardProps {
  onNavigateToJobDetail: (jobId: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToJobDetail }) => {
  const [stats, setStats] = useState({
    new_jobs: 0,
    jobs_analyzed: 0,
    strong_matches: 0,
    applications: 0
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Scanner State embedded in Home
  const [selectedModel, setSelectedModel] = useState<string>('best-model');
  const [availableModels] = useState<string[]>(['best-model', 'qwen', 'deepseek', 'llama']);
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<ScanStatusResponse>({
    status: 'IDLE',
    currentStep: 'Ready to scan global job boards',
    jobsFound: 0,
    duplicatesRemoved: 0,
    jobsAnalyzed: 0,
    strongMatches: 0
  });

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [workplaceFilter, setWorkplaceFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [savedJobs, setSavedJobs] = useState<Set<number>>(new Set());

  const loadInitialData = async () => {
    try {
      const [statsData, jobsData, profileData, configData, settingsData] = await Promise.all([
        fetchDashboardStats().catch(() => ({ new_jobs: 0, jobs_analyzed: 0, strong_matches: 0, applications: 0, interviews: 0 })),
        fetchJobs().catch(() => ({ jobs: [], total: 0 })),
        fetchProfile().catch(() => null),
        fetchSearchConfig().catch(() => null),
        fetchSettings().catch(() => null)
      ]);

      setStats(statsData);
      setJobs(jobsData.jobs || []);
      setProfile(profileData);
      setSearchConfig(configData);

      if (settingsData && settingsData.settings) {
        setAppSettings(settingsData.settings);
        setSelectedModel(settingsData.settings.cluster_model || 'best-model');
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Auto Live Polling & Instant Render on scan activity
    const interval = setInterval(async () => {
      try {
        const s = await fetchScanStatus();
        setScanStatus(s);

        if (s.status === 'RUNNING') {
          setScanning(true);
          // Auto refresh live job list as jobs are analyzed
          const latestJobs = await fetchJobs();
          setJobs(latestJobs.jobs || []);
        } else if (scanning && s.status === 'COMPLETED') {
          setScanning(false);
          loadInitialData();
        }
      } catch (e) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [scanning]);

  const handleModelChange = async (model: string) => {
    setSelectedModel(model);
    if (appSettings) {
      const updated = { ...appSettings, cluster_model: model };
      setAppSettings(updated);
      await saveSettings(updated, []).catch(() => null);
    }
  };

  const handleStartScan = async () => {
    if (scanning) {
      await stopRealScan().catch(() => null);
      setScanning(false);
      return;
    }

    setScanning(true);
    try {
      await startRealScan();
    } catch (e: any) {
      alert('Failed to start scan: ' + e.message);
      setScanning(false);
    }
  };

  const handleSaveToggle = async (jobId: number) => {
    setSavedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleQuickApply = async (jobId: number) => {
    try {
      await updateApplicationStatusApi(jobId, 'APPLIED', 'Applied via AI Job Finder');
      setJobs(jobs.map(j => j.id === jobId ? { ...j, application_status: 'APPLIED' } : j));
    } catch (e: any) {
      alert('Status update error: ' + e.message);
    }
  };

  // Filter Jobs
  const filteredJobs = jobs.filter(j => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.location.toLowerCase().includes(q);
    const matchesSource = sourceFilter === 'all' || j.source === sourceFilter;
    const matchesScore = (j.match_score || 0) >= minScoreFilter;
    const matchesWorkplace = workplaceFilter === 'all' || (workplaceFilter === 'remote' ? j.remote : !j.remote);
    const matchesLocation = locationFilter === 'all' || j.location.toLowerCase().includes(locationFilter.toLowerCase());

    return matchesQuery && matchesSource && matchesScore && matchesWorkplace && matchesLocation;
  });

  const modelLabels: Record<string, { label: string; icon: any }> = {
    'best-model': { label: 'Best Model (Auto)', icon: Sparkles },
    'qwen': { label: 'Qwen 2.5 72B', icon: Zap },
    'deepseek': { label: 'DeepSeek R1', icon: Brain },
    'llama': { label: 'Llama 3.3 70B', icon: Cpu }
  };

  return (
    <div className="page-container">
      {/* Search Criteria Pill Bar Header */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}>
            <Target size={15} /> Active Search Scope:
          </span>
          <span className="badge badge-primary">
            <Key size={12} /> Keywords: {(searchConfig?.keywords || profile?.preferred_roles || [profile?.primary_role || 'Software Engineer']).slice(0, 3).join(', ')}
          </span>
          <span className="badge badge-info">
            <Globe size={12} /> Location: {searchConfig?.location || profile?.primary_location || 'Worldwide (Global Remote)'}
          </span>
          <span className="badge badge-secondary">
            <FileText size={12} /> Resume: {profile?.name || 'Active Candidate'} (v1.0)
          </span>
        </div>
      </div>

      {/* Smart Job Scanner Controller Section */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={18} color="var(--accent-primary)" /> Real-Time Smart Job Scanner
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              Collects live openings across 11 global job boards & evaluates compatibility via Cluster Protocol AI Engine
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f8fafc', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Model:</span>
              <select
                className="form-select"
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value)}
                style={{ background: 'transparent', border: 'none', padding: '2px 4px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', cursor: 'pointer' }}
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{modelLabels[m]?.label || m}</option>
                ))}
              </select>
            </div>

            <button
              className={`btn ${scanning ? 'btn-danger' : 'btn-primary'}`}
              onClick={handleStartScan}
              style={{ padding: '8px 18px', fontWeight: 700 }}
            >
              {scanning ? (
                <>
                  <Square size={15} /> Stop Scan
                </>
              ) : (
                <>
                  <Play size={15} /> Start Smart Job Scan
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Progress Banner */}
        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: scanning ? 'var(--status-info-bg)' : '#e2e8f0',
            color: scanning ? 'var(--accent-primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {scanning ? <RefreshCw size={16} className="spin" /> : <Search size={16} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: scanning ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
              {scanning ? 'Scanning 11 Public Job Boards...' : scanStatus.status === 'COMPLETED' ? 'Scan Cycle Completed' : 'Scanner Ready'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              {scanStatus.currentStep}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="stat-value">{stats.new_jobs || jobs.length}</div>
            <div className="stat-label">Discovered Jobs</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="stat-value">{stats.jobs_analyzed || jobs.length}</div>
            <div className="stat-label">AI Analyzed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Star size={20} />
          </div>
          <div>
            <div className="stat-value">{jobs.filter(j => (j.match_score || 0) >= 80).length}</div>
            <div className="stat-label">Strong Matches (≥80%)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
            <Send size={20} />
          </div>
          <div>
            <div className="stat-value">{jobs.filter(j => j.application_status === 'APPLIED').length}</div>
            <div className="stat-label">Applications</div>
          </div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search title, company, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.82rem' }}
            />
          </div>

          <select className="form-select" style={{ width: 'auto', fontSize: '0.82rem' }} value={workplaceFilter} onChange={(e) => setWorkplaceFilter(e.target.value)}>
            <option value="all">All Workplaces</option>
            <option value="remote">Remote Only</option>
            <option value="onsite">On-Site / Hybrid</option>
          </select>

          <select className="form-select" style={{ width: 'auto', fontSize: '0.82rem' }} value={minScoreFilter} onChange={(e) => setMinScoreFilter(Number(e.target.value))}>
            <option value={0}>All Scores (≥0%)</option>
            <option value={80}>Strong Match (≥80%)</option>
            <option value={70}>Good Match (≥70%)</option>
          </select>
        </div>
      </div>

      {/* Discovered Jobs List */}
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Discovered Opportunities ({filteredJobs.length})
        </h3>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Showing {filteredJobs.length} of {jobs.length} jobs
        </span>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '36px 18px' }}>
          <Briefcase size={32} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>No jobs match current filter</h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Click "Start Smart Job Scan" above to fetch live openings across LinkedIn, Remotive, Greenhouse & more!
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleStartScan}>
            <Play size={13} /> Start Smart Scan Now
          </button>
        </div>
      ) : (
        filteredJobs.map((job) => {
          const isSaved = savedJobs.has(job.id);
          const isApplied = job.application_status === 'APPLIED';
          const matchScore = job.match_score || 75;

          return (
            <div key={job.id} className="job-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => onNavigateToJobDetail(job.id)}>
                      {job.title}
                    </h4>
                    {job.remote && <span className="badge badge-info">Remote</span>}
                    <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                      Source: {job.source.replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: 'var(--text-muted)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      <Building size={13} color="var(--accent-primary)" /> {job.company}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} /> {job.location}
                    </span>
                    <span>Posted {job.posted_date || 'Recently'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Match Score Badge */}
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    background: matchScore >= 80 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                    color: matchScore >= 80 ? 'var(--status-success)' : 'var(--status-warning)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    border: `1px solid ${matchScore >= 80 ? '#bbf7d0' : '#fef3c7'}`
                  }}>
                    {matchScore}% {matchScore >= 80 ? 'APPLY' : 'MATCH'}
                  </div>

                  <button
                    className={`btn btn-sm ${isSaved ? 'btn-success' : 'btn-secondary'}`}
                    onClick={() => handleSaveToggle(job.id)}
                  >
                    <Bookmark size={13} /> {isSaved ? 'Saved' : 'Save'}
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onNavigateToJobDetail(job.id)}
                  >
                    Details <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
