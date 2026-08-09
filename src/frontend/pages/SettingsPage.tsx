import React, { useEffect, useState } from 'react';
import { AppSettings, JobSourceInfo } from '../../shared/types';
import { fetchSettings, saveSettings, testClusterConnection } from '../api';
import { Save, RefreshCw, Cpu, Send, Globe, Clock, CheckCircle2, AlertTriangle, Eye, EyeOff, Sparkles, ExternalLink, Zap, Brain, Shield } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sources, setSources] = useState<JobSourceInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingCluster, setTestingCluster] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const [clusterStatus, setClusterStatus] = useState<{ available: boolean; models: string[]; message: string }>({
    available: false,
    models: [],
    message: 'Checking Cluster Protocol connection...'
  });

  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      const data = await fetchSettings();
      setSettings(data.settings);
      setSources(data.job_sources);
      await checkCluster(data.settings.cluster_api_url, data.settings.cluster_api_key);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkCluster = async (url?: string, apiKey?: string) => {
    setTestingCluster(true);
    try {
      const res = await testClusterConnection(url || settings?.cluster_api_url, apiKey !== undefined ? apiKey : settings?.cluster_api_key);
      setClusterStatus(res);
    } catch (e: any) {
      setClusterStatus({ available: false, models: [], message: e.message });
    } finally {
      setTestingCluster(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await saveSettings(settings, sources);
      setToast(res.message || 'Settings saved successfully!');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSource = (id: number) => {
    setSources(sources.map(s => s.id === id ? { ...s, is_enabled: !s.is_enabled } : s));
  };

  const modelPresets = [
    {
      id: 'best-model',
      name: 'Best Model (Auto)',
      tagline: 'Smart Auto-Routing',
      description: 'Automatically chooses optimal reasoning engine (DeepSeek R1 / Qwen 2.5)',
      icon: Sparkles,
      color: '#f59e0b'
    },
    {
      id: 'qwen',
      name: 'Qwen',
      tagline: 'Qwen 2.5 72B / Coder',
      description: 'High-speed reasoning & accurate technical code analysis',
      icon: Zap,
      color: '#3b82f6'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      tagline: 'DeepSeek R1 / Chat',
      description: 'State-of-the-art multi-step reasoning for skill extraction',
      icon: Brain,
      color: '#10b981'
    },
    {
      id: 'llama',
      name: 'Llama',
      tagline: 'Llama 3.3 70B',
      description: 'Meta open-weight model with strong general intelligence',
      icon: Cpu,
      color: '#8b5cf6'
    }
  ];

  if (loading || !settings) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading Application Settings...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">Application Settings</h1>
          <p className="page-subtitle">Configure Cluster Protocol AI Engine, Telegram notifications, Job Sources, and Scheduler</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {toast && (
        <div style={{
          backgroundColor: 'var(--status-success-bg)',
          color: 'var(--status-success)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>
        {/* Cluster Protocol AI Engine Card */}
        <div className="card" style={{ border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={22} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Cluster Protocol AI Engine</h3>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                500+ Open-Source AI Models via <a href="https://hub.clusterprotocol.ai/models" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>hub.clusterprotocol.ai <ExternalLink size={10} /></a>
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => checkCluster()} disabled={testingCluster}>
              <RefreshCw size={14} className={testingCluster ? 'spin' : ''} /> Test Connection
            </button>
          </div>

          <div style={{
            backgroundColor: clusterStatus.available ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
            color: clusterStatus.available ? 'var(--status-success)' : 'var(--status-warning)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            {clusterStatus.available ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{clusterStatus.message}</span>
          </div>

          {/* API Key Field */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Cluster Protocol API Key</label>
              <a
                href="https://hub.clusterprotocol.ai"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none' }}
              >
                Get API Key →
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className="form-input"
                placeholder="sk-cluster-..."
                style={{ paddingRight: '40px', fontFamily: 'monospace' }}
                value={settings.cluster_api_key || ''}
                onChange={(e) => setSettings({ ...settings, cluster_api_key: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Endpoint URL */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>API Base Endpoint</label>
            <input
              type="text"
              className="form-input"
              value={settings.cluster_api_url || 'https://api.clusterprotocol.ai/v1'}
              onChange={(e) => setSettings({ ...settings, cluster_api_url: e.target.value })}
            />
          </div>

          {/* Model Family Selection Grid */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
              Select Active AI Model Architecture
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {modelPresets.map((preset) => {
                const IconComponent = preset.icon;
                const isSelected = (settings.cluster_model || 'best-model').toLowerCase() === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSettings({ ...settings, cluster_model: preset.id })}
                    style={{
                      border: isSelected ? `2px solid ${preset.color}` : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <IconComponent size={18} color={preset.color} />
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? preset.color : 'inherit' }}>
                        {preset.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>
                      {preset.tagline}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      {preset.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Model Override input */}
          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Custom Hub Model Slug (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. qwen/qwen-2.5-coder-32b-instruct or deepseek/deepseek-r1"
              value={['best-model', 'qwen', 'deepseek', 'llama'].includes(settings.cluster_model) ? '' : settings.cluster_model}
              onChange={(e) => {
                if (e.target.value.trim()) {
                  setSettings({ ...settings, cluster_model: e.target.value.trim() });
                }
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Currently selected: <code style={{ backgroundColor: 'var(--bg-page)', padding: '2px 6px', borderRadius: '4px' }}>{settings.cluster_model || 'best-model'}</code>
            </div>
          </div>
        </div>

        {/* Right Column: Telegram Notifications & Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Temperature & Token Settings Card */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>Inference Hyperparameters</h3>
            <div className="form-group">
              <label className="form-label">Temperature ({settings.cluster_temperature ?? 0.2})</label>
              <input
                type="range"
                step="0.05"
                min="0"
                max="1"
                style={{ width: '100%' }}
                value={settings.cluster_temperature ?? 0.2}
                onChange={(e) => setSettings({ ...settings, cluster_temperature: parseFloat(e.target.value) })}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Max Output Tokens</label>
              <input
                type="number"
                className="form-input"
                value={settings.cluster_max_tokens ?? 2048}
                onChange={(e) => setSettings({ ...settings, cluster_max_tokens: parseInt(e.target.value, 10) || 2048 })}
              />
            </div>
          </div>

          {/* Telegram Notifications Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Send size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Telegram Notifications</h3>
            </div>

            <div className="form-group">
              <label className="form-label">Telegram Bot Token</label>
              <input
                type="text"
                className="form-input"
                placeholder="123456789:ABCdefGhIJKlmNoPQRSTUvwxyz"
                value={settings.telegram_bot_token}
                onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Telegram Chat ID</label>
              <input
                type="text"
                className="form-input"
                placeholder="-100123456789 or @channel"
                value={settings.telegram_chat_id}
                onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Min Score for Alert ({settings.telegram_min_score}%)</label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                style={{ width: '100%' }}
                value={settings.telegram_min_score}
                onChange={(e) => setSettings({ ...settings, telegram_min_score: parseInt(e.target.value, 10) })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modular Job Sources Architecture */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Globe size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Modular Job Sources Architecture</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {sources.map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-page)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.display_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.status}</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px' }}>
                <input
                  type="checkbox"
                  checked={s.is_enabled}
                  onChange={() => toggleSource(s.id)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: s.is_enabled ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  borderRadius: '22px',
                  transition: '0.3s'
                }} />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
