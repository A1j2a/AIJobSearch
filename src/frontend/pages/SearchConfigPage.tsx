import React, { useEffect, useState } from 'react';
import { SearchConfig, UserProfile } from '../../shared/types';
import { fetchSearchConfig, saveSearchConfig, fetchProfile } from '../api';
import { Save, Plus, X, Search, Sliders, CheckCircle2, Sparkles, UserCheck } from 'lucide-react';

export const SearchConfigPage: React.FC = () => {
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const [newKeyword, setNewKeyword] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configData, profileData] = await Promise.all([
        fetchSearchConfig(),
        fetchProfile().catch(() => null)
      ]);
      setConfig(configData);
      setProfile(profileData);
    } catch (err) {
      console.error('Error loading search config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWithProfile = () => {
    if (!profile || !config) return;
    const prefRoles = Array.isArray(profile.preferred_roles) ? profile.preferred_roles : JSON.parse((profile.preferred_roles as any) || '[]');
    const newKeywords = Array.from(new Set([
      ...prefRoles,
      profile.primary_role,
      `${profile.primary_role} ${profile.core_skills?.[0] || ''}`.trim()
    ])).filter(Boolean);

    setConfig({
      ...config,
      keywords: newKeywords,
      location: profile.primary_location ? profile.primary_location.split(',')[0].trim() : config.location
    });

    setToast(`Auto-synced search keywords & criteria with candidate ${profile.name}!`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await saveSearchConfig(config);
      setToast(res.message || 'Search configuration saved successfully!');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert('Failed to save search config: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim() || !config) return;
    if (!config.keywords.includes(newKeyword.trim())) {
      setConfig({
        ...config,
        keywords: [...config.keywords, newKeyword.trim()]
      });
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    if (!config) return;
    setConfig({
      ...config,
      keywords: config.keywords.filter(k => k !== kw)
    });
  };

  if (loading || !config) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading Search Configuration...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">Job Search Configuration</h1>
          <p className="page-subtitle">Configure search queries, experience range filters, and minimum AI match threshold</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {profile && (
            <button className="btn btn-secondary" onClick={handleSyncWithProfile} title="Auto-sync keywords with active candidate resume">
              <Sparkles size={16} color="var(--accent-primary)" />
              <span>Sync with Candidate Resume</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {profile && (
        <div className="card" style={{ marginBottom: '20px', backgroundColor: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
          <UserCheck size={20} color="var(--accent-primary)" />
          <div style={{ fontSize: '0.9rem' }}>
            Active Candidate: <strong>{profile.name}</strong> ({profile.primary_role} • {profile.primary_location})
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          backgroundColor: 'var(--status-success-bg)',
          color: 'var(--status-success)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 500
        }}>
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}

      {/* Dynamic Multi-Keyword Query Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Search size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Multi-Keyword Search Queries</h3>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
          The job scanner automatically searches for all added titles across supported public job sources rather than restricting to just one query.
        </p>

        <div style={{ display: 'flex', gap: '8px', maxWidth: '600px', marginBottom: '12px' }}>
          <input
            type="text"
            className="form-input"
            placeholder={`Add keyword variation (e.g. ${profile?.primary_role || 'Senior Backend Engineer'})`}
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={addKeyword}>
            <Plus size={14} /> Add Keyword
          </button>
        </div>

        <div className="tag-container">
          {config.keywords.map((kw) => (
            <span key={kw} className="tag" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              {kw}
              <X size={14} className="tag-remove" onClick={() => removeKeyword(kw)} />
            </span>
          ))}
        </div>
      </div>

      {/* Filter Parameters */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Sliders size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Search Criteria & Filters</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Primary Location</label>
            <input
              type="text"
              className="form-input"
              value={config.location}
              onChange={(e) => setConfig({ ...config, location: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Job Type</label>
            <select
              className="form-select"
              value={config.job_type}
              onChange={(e) => setConfig({ ...config, job_type: e.target.value })}
            >
              <option value="Full Time">Full Time</option>
              <option value="Contract">Contract</option>
              <option value="Part Time">Part Time</option>
              <option value="Remote">Remote Only</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '16px' }}>
          <div className="form-group">
            <label className="form-label">Minimum Experience (Years)</label>
            <input
              type="number"
              className="form-input"
              value={config.min_experience}
              onChange={(e) => setConfig({ ...config, min_experience: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Maximum Experience (Years)</label>
            <input
              type="number"
              className="form-input"
              value={config.max_experience}
              onChange={(e) => setConfig({ ...config, max_experience: parseFloat(e.target.value) || 0 })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Posted Within</label>
            <select
              className="form-select"
              value={config.posted_within}
              onChange={(e) => setConfig({ ...config, posted_within: e.target.value })}
            >
              <option value="24 hours">24 hours</option>
              <option value="3 days">3 days</option>
              <option value="7 days">7 days</option>
              <option value="14 days">14 days</option>
              <option value="30 days">30 days</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '16px', alignItems: 'center' }}>
          <div className="form-group">
            <label className="form-label">Allow Remote Opportunities</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.remote_allowed}
                onChange={(e) => setConfig({ ...config, remote_allowed: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '0.9rem' }}>Include Remote - India / Remote jobs</span>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Minimum AI Match Threshold ({config.min_match_score}%)</label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={config.min_match_score}
              onChange={(e) => setConfig({ ...config, min_match_score: parseInt(e.target.value, 10) })}
              style={{ marginTop: '8px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
