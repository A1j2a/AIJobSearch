import React, { useEffect, useState } from 'react';
import { Briefcase, CheckCircle2, Star, Send, UserCheck, Search, RefreshCw, Filter, ArrowRight, Play, MapPin, Globe, Building, Target, FileText, Check, Calendar, Clock, Sparkles, ChevronRight, ShieldCheck } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { DashboardStats, Job, UserProfile, SearchConfig } from '../../shared/types';
import { fetchDashboardStats, fetchJobs, fetchProfile, fetchSearchConfig } from '../api';

interface DashboardProps {
  onNavigateToScanner: () => void;
  onNavigateToJobDetail: (jobId: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigateToScanner, onNavigateToJobDetail }) => {
  const [stats, setStats] = useState<DashboardStats>({
    new_jobs: 0,
    jobs_analyzed: 0,
    strong_matches: 0,
    applications: 0,
    interviews: 0
  });

  const [jobs, setJobs] = useState<Job[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [workplaceFilter, setWorkplaceFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [postedDurationFilter, setPostedDurationFilter] = useState<string>('all');
  const [resumeMatchMode, setResumeMatchMode] = useState<'matched' | 'all'>('matched');

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, jobsData, profileData, configData] = await Promise.all([
        fetchDashboardStats(),
        fetchJobs(),
        fetchProfile(),
        fetchSearchConfig()
      ]);
      setStats(statsData);
      setJobs(jobsData.jobs.filter(j => !j.is_demo));
      setProfile(profileData);
      setSearchConfig(configData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const targetRolesLower = (profile?.preferred_roles && profile.preferred_roles.length > 0
    ? profile.preferred_roles
    : profile?.primary_role ? [profile.primary_role] : []
  ).map(r => r.toLowerCase());

  const coreSkillsLower = (profile?.core_skills && profile.core_skills.length > 0
    ? profile.core_skills
    : []
  ).map(s => s.toLowerCase());

  const configKeywordsLower = (searchConfig?.keywords && searchConfig.keywords.length > 0
    ? searchConfig.keywords
    : profile?.primary_role ? [profile.primary_role] : []
  ).map(k => k.toLowerCase());

  const filteredJobs = jobs.filter(j => {
    const titleLower = j.title.toLowerCase();
    const descLower = (j.description || '').toLowerCase();

    // 1. Search Query Filter
    const matchesSearch =
      titleLower.includes(searchQuery.toLowerCase()) ||
      j.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.location.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Source Filter
    const matchesSource = sourceFilter === 'all' || j.source === sourceFilter;

    // 3. AI Score Filter
    const effectiveMinScore = minScoreFilter > 0 ? minScoreFilter : (searchConfig?.min_match_score || 0);
    const matchesScore = (j.match_score || 0) >= effectiveMinScore;

    // 4. Workplace Type Filter
    let matchesWorkplace = true;
    const locLower = j.location.toLowerCase();
    const isRemote = j.remote || locLower.includes('remote') || locLower.includes('anywhere');
    const isHybrid = locLower.includes('hybrid');

    if (workplaceFilter === 'remote') {
      matchesWorkplace = isRemote;
    } else if (workplaceFilter === 'onsite') {
      matchesWorkplace = !isRemote && !isHybrid;
    } else if (workplaceFilter === 'hybrid') {
      matchesWorkplace = isHybrid;
    }

    // 5. Target Location Filter
    let matchesLocation = true;
    if (locationFilter !== 'all') {
      matchesLocation = locLower.includes(locationFilter.toLowerCase());
    }

    // 6. Posted Duration Filter
    let matchesPostedDuration = true;
    if (postedDurationFilter !== 'all') {
      const now = new Date();
      const collectedTime = j.collected_at ? new Date(j.collected_at).getTime() : now.getTime();
      const diffHours = (now.getTime() - collectedTime) / (1000 * 3600);
      const postedText = (j.posted_date || '').toLowerCase();

      if (postedDurationFilter === '24h') {
        matchesPostedDuration = diffHours <= 24 || postedText.includes('today') || postedText.includes('1 day') || postedText.includes('recently') || postedText.includes('yesterday');
      } else if (postedDurationFilter === '7d') {
        matchesPostedDuration = diffHours <= 168 || postedText.includes('day') || postedText.includes('1 week') || postedText.includes('recently');
      } else if (postedDurationFilter === '30d') {
        matchesPostedDuration = diffHours <= 720 || postedText.includes('day') || postedText.includes('week') || postedText.includes('month');
      }
    }

    // 7. Strict Candidate Role & Skill Alignment Filter
    let matchesCandidateRole = true;
    const primaryRoleLower = (profile?.primary_role || '').toLowerCase();
    const isMobileCandidate = primaryRoleLower.includes('react native') || primaryRoleLower.includes('mobile') || targetRolesLower.some(r => r.includes('react native') || r.includes('mobile'));
    const isBackendCandidate = primaryRoleLower.includes('backend') || targetRolesLower.some(r => r.includes('backend'));

    if (isMobileCandidate) {
      const isMobileTitle = titleLower.includes('react native') || titleLower.includes('mobile') || titleLower.includes('ios') || titleLower.includes('android') || titleLower.includes('flutter') || titleLower.includes('app developer') || (titleLower.includes('react') && titleLower.includes('developer'));
      const isIrrelevant = titleLower.includes('golang') || titleLower.includes('rust') || titleLower.includes('c++') || titleLower.includes('finance automation') || titleLower.includes('director') || titleLower.includes('graph engine') || titleLower.includes('data layer') || titleLower.includes('legal automation');
      matchesCandidateRole = isMobileTitle && !isIrrelevant;
    } else if (isBackendCandidate) {
      const isBackendTitle = titleLower.includes('backend') || titleLower.includes('node') || titleLower.includes('python') || titleLower.includes('go') || titleLower.includes('microservices') || titleLower.includes('api') || titleLower.includes('server');
      const isIrrelevant = titleLower.includes('react native') || titleLower.includes('flutter') || titleLower.includes('ios') || titleLower.includes('android') || titleLower.includes('design') || titleLower.includes('copywriter');
      matchesCandidateRole = isBackendTitle && !isIrrelevant;
    } else {
      matchesCandidateRole = targetRolesLower.some(r => titleLower.includes(r));
    }

    return matchesSearch && matchesSource && matchesScore && matchesWorkplace && matchesLocation && matchesPostedDuration && matchesCandidateRole;
  });

  const preferredLocations = profile?.preferred_locations || ['Ahmedabad', 'Gandhinagar', 'Remote - India'];
  const activeResumeName = profile?.active_resume?.name || 'Ajay Patidar Master Resume (PDF)';

  const formatPostedTime = (job: Job) => {
    if (job.posted_date && job.posted_date.trim().length > 0) {
      return job.posted_date;
    }
    if (job.collected_at) {
      const date = new Date(job.collected_at);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return 'Recently';
  };

  return (
    <div className="page-container">
      {/* Compact Page Title Section */}
      <div className="page-title-section">
        <div>
          <h1 className="page-title">AI Job Finder</h1>
          <p className="page-subtitle">Real Live Job Matching & Search Criteria Alignment</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary btn-sm" onClick={onNavigateToScanner}>
            <Play size={14} />
            <span>Run Scanner</span>
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadDashboardData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Compact Banner: Search Config & Resume Info */}
      <div className="card" style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: 'var(--accent-light)', borderColor: 'var(--accent-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Target size={15} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              Keywords: {(searchConfig?.keywords || ['React Native Developer', 'React Native Engineer']).slice(0, 3).join(', ')}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Active Resume: <strong>{activeResumeName}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', backgroundColor: '#ffffff', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
            <button
              className={`btn btn-sm ${resumeMatchMode === 'matched' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '3px 8px', fontSize: '0.75rem' }}
              onClick={() => setResumeMatchMode('matched')}
            >
              <Target size={12} />
              <span>Matched</span>
            </button>

            <button
              className={`btn btn-sm ${resumeMatchMode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ border: 'none', padding: '3px 8px', fontSize: '0.75rem' }}
              onClick={() => setResumeMatchMode('all')}
            >
              <Globe size={12} />
              <span>All ({jobs.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact Metrics Grid */}
      <div className="stats-grid">
        <StatCard label="Discovered" value={stats.new_jobs} icon={<Briefcase size={16} />} />
        <StatCard label="AI Analyzed" value={stats.jobs_analyzed} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Strong (≥80%)" value={stats.strong_matches} icon={<Star size={16} />} />
        <StatCard label="Applications" value={stats.applications} icon={<Send size={16} />} />
        <StatCard label="Interviews" value={stats.interviews} icon={<UserCheck size={16} />} />
      </div>

      {/* Fixed Single-Row Filter Container */}
      <div className="card" style={{ marginBottom: '10px', padding: '8px 12px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1.8fr) repeat(5, minmax(110px, 1fr))',
          gap: '8px',
          alignItems: 'center'
        }}>
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="form-input"
              style={{ padding: '5px 8px', fontSize: '0.78rem', height: '32px' }}
              placeholder="Search title, company, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter 1: Resume Match Mode */}
          <select
            className="form-select"
            value={resumeMatchMode}
            onChange={(e) => setResumeMatchMode(e.target.value as any)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px', fontWeight: 600 }}
          >
            <option value="matched">Target Skills</option>
            <option value="all">All Jobs ({jobs.length})</option>
          </select>

          {/* Filter 2: Location */}
          <select
            className="form-select"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px', fontWeight: 600 }}
          >
            <option value="all">All Locations</option>
            {preferredLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Filter 3: Workplace */}
          <select
            className="form-select"
            value={workplaceFilter}
            onChange={(e) => setWorkplaceFilter(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px', fontWeight: 600 }}
          >
            <option value="all">Workplace</option>
            <option value="remote">Remote</option>
            <option value="onsite">On-Site</option>
            <option value="hybrid">Hybrid</option>
          </select>

          {/* Filter 4: Posted Duration */}
          <select
            className="form-select"
            value={postedDurationFilter}
            onChange={(e) => setPostedDurationFilter(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px', fontWeight: 600 }}
          >
            <option value="all">Anytime</option>
            <option value="24h">Past 24h</option>
            <option value="7d">Past 7d</option>
            <option value="30d">Past 30d</option>
          </select>

          {/* Filter 5: Source */}
          <select
            className="form-select"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px' }}
          >
            <option value="all">All Sources</option>
            <option value="india_local_jobs">India / Ahmedabad</option>
            <option value="remotive">Remotive</option>
            <option value="remoteok">RemoteOK</option>
            <option value="weworkremotely">WeWorkRemotely</option>
            <option value="jobicy">Jobicy</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
          </select>
        </div>
      </div>

      {/* Main Jobs Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target size={14} color="var(--accent-primary)" />
          <span>{resumeMatchMode === 'matched' ? 'Jobs Aligned to Search Configuration' : 'All Discovered Jobs'}</span>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing {filteredJobs.length} of {jobs.length} job(s)
        </span>
      </div>

      {/* Sleek Compact Card Rows */}
      {filteredJobs.length === 0 ? (
        <div className="card empty-state" style={{ padding: '20px' }}>
          <Briefcase size={32} className="empty-state-icon" />
          <div className="empty-state-title">No Jobs Match Filters</div>
          <p style={{ fontSize: '0.8rem', marginBottom: '10px', color: 'var(--text-muted)' }}>
            Try adjusting your search box or selecting "All Locations".
          </p>

          <button className="btn btn-primary btn-sm" onClick={() => setResumeMatchMode('all')}>
            <Globe size={12} /> View All Jobs ({jobs.length})
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredJobs.map((job) => {
            const locLower = job.location.toLowerCase();
            const isRemote = job.remote || locLower.includes('remote') || locLower.includes('anywhere');
            const isHybrid = locLower.includes('hybrid');
            const postedDateStr = formatPostedTime(job);
            const score = job.match_score || 0;

            return (
              <div
                key={job.id}
                className="card card-hover"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 12px',
                  gap: '10px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)'
                }}
                onClick={() => onNavigateToJobDetail(job.id)}
              >
                {/* Left Info Column */}
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.title}
                    </span>

                    {isRemote ? (
                      <span className="badge badge-info" style={{ padding: '1px 5px', fontSize: '0.68rem', gap: '2px', flexShrink: 0 }}>
                        <Globe size={9} /> Remote
                      </span>
                    ) : isHybrid ? (
                      <span className="badge badge-warning" style={{ padding: '1px 5px', fontSize: '0.68rem', gap: '2px', flexShrink: 0 }}>
                        <Building size={9} /> Hybrid
                      </span>
                    ) : (
                      <span className="badge badge-secondary" style={{ padding: '1px 5px', fontSize: '0.68rem', gap: '2px', flexShrink: 0 }}>
                        <MapPin size={9} /> On-Site
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    <span style={{ fontWeight: 600 }}>{job.company}</span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <MapPin size={11} color="var(--text-muted)" />
                      {job.location}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }}>
                      <Calendar size={11} /> {postedDateStr}
                    </span>
                  </div>
                </div>

                {/* Right Metadata & Action Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                    {job.source.replace('_', ' ')}
                  </span>

                  {/* AI Match Score Badge */}
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: score >= 80 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                    color: score >= 80 ? 'var(--status-success)' : 'var(--status-warning)',
                    border: `1px solid ${score >= 80 ? 'var(--status-success)' : 'var(--status-warning)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.75rem'
                  }}>
                    {score}%
                  </div>

                  {job.recommendation && (
                    <span className={`badge ${
                      job.recommendation === 'APPLY' ? 'badge-success' : job.recommendation === 'MAYBE' ? 'badge-warning' : 'badge-info'
                    }`} style={{ padding: '2px 6px', fontSize: '0.7rem' }}>
                      {job.recommendation}
                    </span>
                  )}

                  <button className="btn btn-secondary btn-sm" style={{ padding: '3px 6px', fontSize: '0.73rem', gap: '2px' }}>
                    <span>Details</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
