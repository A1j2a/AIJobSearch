import React, { useEffect, useState } from 'react';
import { Play, RefreshCw, CheckCircle2, Briefcase, Star, Search, ShieldCheck, UserCheck, Sparkles, Square } from 'lucide-react';
import { ScanStatusResponse, startRealScan, stopRealScan, fetchScanStatus, fetchProfile, fetchSearchConfig } from '../api';
import { UserProfile, SearchConfig } from '../../shared/types';

interface ScannerPageProps {
  onScanCompleted?: () => void;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({ onScanCompleted }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatusResponse & { totalDbJobs?: number; totalDbAnalyzed?: number }>({
    status: 'IDLE',
    currentStep: 'Ready to start scanning real public job boards',
    jobsFound: 0,
    duplicatesRemoved: 0,
    jobsAnalyzed: 0,
    strongMatches: 0,
    totalDbJobs: 0,
    totalDbAnalyzed: 0
  });

  const [scanning, setScanning] = useState<boolean>(false);

  const loadPageData = async () => {
    try {
      const [p, c] = await Promise.all([
        fetchProfile().catch(() => null),
        fetchSearchConfig().catch(() => null)
      ]);
      setProfile(p);
      setSearchConfig(c);
    } catch (e) {
      console.warn('Error loading scanner data:', e);
    }
  };

  useEffect(() => {
    loadPageData();

    let interval: NodeJS.Timeout | null = null;

    const pollStatus = async () => {
      try {
        const res = await fetchScanStatus();
        setScanStatus(res);
        if (res.status === 'RUNNING') {
          setScanning(true);
        } else {
          setScanning(false);
          if (res.status === 'COMPLETED') {
            onScanCompleted?.();
          }
        }
      } catch (e) {
        console.warn('Status poll error:', e);
      }
    };

    pollStatus();

    if (scanning || scanStatus.status === 'RUNNING') {
      interval = setInterval(pollStatus, 1500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [scanning, scanStatus.status]);

  const handleUnifiedSmartScan = async () => {
    setScanning(true);
    await loadPageData(); // Real-time sync of search configuration before starting scan
    try {
      await startRealScan();
    } catch (err: any) {
      alert('Failed to launch smart job scan: ' + err.message);
      setScanning(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await stopRealScan();
      setScanning(false);
    } catch (err: any) {
      alert('Failed to stop job scan: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">Real Job Scanner Engine</h1>
          <p className="page-subtitle">Collect live jobs from supported public sources, normalize, deduplicate, and score with local Ollama AI</p>
        </div>
        {scanning || scanStatus.status === 'RUNNING' ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              disabled
              style={{ padding: '10px 16px', fontSize: '0.95rem', fontWeight: 600 }}
            >
              <RefreshCw size={18} className="spin" />
              <span>Scanning Public Boards...</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleStopScan}
              style={{ padding: '10px 18px', fontSize: '0.95rem', fontWeight: 600, borderColor: 'var(--status-error)', color: 'var(--status-error)' }}
              title="Stop current job scan"
            >
              <Square size={14} fill="currentColor" />
              <span>Stop Scan</span>
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleUnifiedSmartScan}
            style={{ padding: '10px 20px', fontSize: '0.95rem', fontWeight: 600 }}
          >
            <Sparkles size={18} />
            <span>Start Smart Job Scan & AI Analysis</span>
          </button>
        )}
      </div>

      {profile && (
        <div className="card" style={{ marginBottom: '20px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Active Candidate & Search Configuration Guard</span>
              <span className="badge badge-success">0 Wasted AI Tokens</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Candidate: <strong>{profile.name}</strong> ({profile.primary_role})
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Active Search Queries:</strong>
              <div style={{ color: 'var(--accent-primary)', marginTop: '2px', fontWeight: 600 }}>
                {(searchConfig?.keywords || profile.preferred_roles || [profile.primary_role]).slice(0, 4).join(', ')}
              </div>
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Target Location & Remote:</strong>
              <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {searchConfig?.location || profile.primary_location} {searchConfig?.remote_allowed ? '(Remote Included)' : ''}
              </div>
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Experience & Min Threshold:</strong>
              <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {searchConfig?.min_experience || 0}-{searchConfig?.max_experience || 10} yrs • ≥{searchConfig?.min_match_score || 70}% Match
              </div>
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Core Skills Guard:</strong>
              <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                {(profile.core_skills || []).slice(0, 4).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Status Header Banner */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: scanStatus.status === 'RUNNING' ? 'var(--accent-light)' : 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: scanStatus.status === 'RUNNING' ? 'var(--accent-primary)' : scanStatus.status === 'COMPLETED' ? 'var(--status-success-bg)' : 'var(--bg-muted)',
            color: scanStatus.status === 'RUNNING' ? '#fff' : scanStatus.status === 'COMPLETED' ? 'var(--status-success)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {scanStatus.status === 'RUNNING' ? (
              <RefreshCw size={22} className="spin" />
            ) : scanStatus.status === 'COMPLETED' ? (
              <CheckCircle2 size={22} />
            ) : (
              <Search size={22} />
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
              {scanStatus.status === 'RUNNING' ? 'Real Job Scan in Progress' : scanStatus.status === 'COMPLETED' ? 'Scan Cycle Completed' : 'Scanner Idle'}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {scanStatus.currentStep}
            </div>
          </div>
        </div>
      </div>

      {/* Database Totals vs Scan Cycle Stats */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <div className="stat-icon"><Briefcase size={22} /></div>
          <div>
            <div className="stat-value">{scanStatus.totalDbJobs !== undefined ? scanStatus.totalDbJobs : scanStatus.jobsFound}</div>
            <div className="stat-label">Total Jobs in SQLite</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="stat-value">{scanStatus.duplicatesRemoved}</div>
            <div className="stat-label">Duplicates Skipped</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--status-info-bg)', color: 'var(--status-info)' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="stat-value">{scanStatus.totalDbAnalyzed !== undefined ? scanStatus.totalDbAnalyzed : scanStatus.jobsAnalyzed}</div>
            <div className="stat-label">Jobs Analyzed with Local AI</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--status-success-bg)', color: 'var(--status-success)' }}>
            <Star size={22} />
          </div>
          <div>
            <div className="stat-value">{scanStatus.strongMatches}</div>
            <div className="stat-label">Strong Matches (≥80%)</div>
          </div>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--bg-muted)' }}>
        <h4 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '8px' }}>ℹ️ How Job Scanning & Deduplication Works:</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          When you click <strong>"Start Real Job Scan"</strong>, the engine queries live public sources. Any job listing that is <strong>already saved in your SQLite database</strong> is automatically skipped to prevent duplicate job records. All saved jobs remain stored in your database and are viewable anytime under <strong>Dashboard</strong> or <strong>Jobs</strong>.
        </p>
      </div>

      {/* Supported Sources Disclosure */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Supported Public Job Sources</h3>
        <ul style={{ paddingLeft: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li><strong style={{ color: 'var(--accent-color)' }}>LinkedIn Jobs (India & Global)</strong>: Real live public guest search for India & global software engineering positions</li>
          <li><strong style={{ color: 'var(--accent-color)' }}>Naukri & Indeed Public Jobs (India)</strong>: Real live developer job postings across Indian tech hubs</li>
          <li><strong>India & Local Public Jobs</strong>: Live software, mobile, and full-stack positions in India</li>
          <li><strong>We Work Remotely Public RSS</strong>: Real live remote software, mobile, and front-end engineering jobs</li>
          <li><strong>Jobicy Public Engineering API</strong>: Real live public software engineering positions</li>
          <li><strong>Remotive Public Jobs API</strong>: Real live remote software and mobile development postings</li>
          <li><strong>Greenhouse Public Career Boards</strong>: Live job postings from public company career boards</li>
        </ul>
      </div>
    </div>
  );
};
