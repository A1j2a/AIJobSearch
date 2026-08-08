import React, { useEffect, useState } from 'react';
import { Job } from '../../shared/types';
import { fetchJobs, updateApplicationStatusApi } from '../api';
import { Briefcase, ExternalLink, Star, Search, Filter, Calendar, MapPin, Globe, Building, Clock, Bookmark } from 'lucide-react';

export const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [workplaceFilter, setWorkplaceFilter] = useState<string>('all');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [postedDurationFilter, setPostedDurationFilter] = useState<string>('all');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await fetchJobs();
      setJobs(data.jobs.filter(j => !j.is_demo));
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredJobs = jobs.filter(j => {
    const matchesSearch =
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSource = sourceFilter === 'all' || j.source === sourceFilter;
    const matchesScore = (j.match_score || 0) >= minScoreFilter;

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

    return matchesSearch && matchesSource && matchesScore && matchesWorkplace && matchesPostedDuration;
  });

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">Collected Jobs & Opportunities</h1>
          <p className="page-subtitle">View and filter normalized jobs collected from all supported public sources</p>
        </div>
      </div>

      {/* Fixed Single-Row Filter Container */}
      <div className="card" style={{ marginBottom: '10px', padding: '8px 12px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 2fr) repeat(4, minmax(110px, 1fr))',
          gap: '8px',
          alignItems: 'center'
        }}>
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

          <select
            className="form-select"
            value={workplaceFilter}
            onChange={(e) => setWorkplaceFilter(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px', fontWeight: 600 }}
          >
            <option value="all">All Workplaces</option>
            <option value="remote">Remote Only</option>
            <option value="onsite">On-Site / Local</option>
            <option value="hybrid">Hybrid Only</option>
          </select>

          <select
            className="form-select"
            value={postedDurationFilter}
            onChange={(e) => setPostedDurationFilter(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px', fontWeight: 600 }}
          >
            <option value="all">Anytime Posted</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>

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
            <option value="weworkremotely">We Work Remotely</option>
            <option value="jobicy">Jobicy</option>
            <option value="greenhouse">Greenhouse</option>
            <option value="lever">Lever</option>
          </select>

          <select
            className="form-select"
            value={minScoreFilter}
            onChange={(e) => setMinScoreFilter(parseInt(e.target.value, 10))}
            style={{ padding: '4px 6px', fontSize: '0.78rem', height: '32px' }}
          >
            <option value="0">All Match Scores</option>
            <option value="80">Match Score ≥ 80%</option>
            <option value="90">Match Score ≥ 90%</option>
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading jobs...</div>
        ) : filteredJobs.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={36} className="empty-state-icon" />
            <div className="empty-state-title">No Jobs Found Matching Filters</div>
            <p style={{ fontSize: '0.8rem' }}>Try switching to "All Workplaces" or clearing the search box.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredJobs.map((job) => {
              const locLower = job.location.toLowerCase();
              const isRemote = job.remote || locLower.includes('remote') || locLower.includes('anywhere');
              const isHybrid = locLower.includes('hybrid');
              const postedDateStr = formatPostedTime(job);

              return (
                <div key={job.id} style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{job.title}</h4>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span>{job.company} • {job.location}</span>
                      {isRemote ? (
                        <span className="badge badge-info" style={{ padding: '1px 5px', fontSize: '0.68rem', gap: '2px' }}>
                          <Globe size={9} /> Remote
                        </span>
                      ) : isHybrid ? (
                        <span className="badge badge-warning" style={{ padding: '1px 5px', fontSize: '0.68rem', gap: '2px' }}>
                          <Building size={9} /> Hybrid
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ padding: '1px 5px', fontSize: '0.68rem', gap: '2px' }}>
                          <MapPin size={9} /> On-Site
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }}>
                        <Calendar size={11} /> Posted / Scanned: {postedDateStr}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {job.match_score !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.8rem' }}>
                        <Star size={14} fill="currentColor" />
                        <span>{job.match_score}%</span>
                      </div>
                    )}
                    <button
                      className={`btn btn-sm ${job.application_status ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', gap: '3px' }}
                      onClick={async () => {
                        try {
                          await updateApplicationStatusApi(job.id, 'Saved');
                          loadJobs();
                        } catch (err: any) {
                          alert('Failed to save job: ' + err.message);
                        }
                      }}
                    >
                      <Bookmark size={12} />
                      <span>{job.application_status || 'Save'}</span>
                    </button>

                    <a href={job.job_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>
                      <ExternalLink size={12} /> Open Link
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
