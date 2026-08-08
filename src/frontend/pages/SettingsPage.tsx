import React, { useEffect, useState } from 'react';
import { AppSettings, JobSourceInfo } from '../../shared/types';
import { fetchSettings, saveSettings, testOllama } from '../api';
import { Save, RefreshCw, Cpu, Send, Globe, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sources, setSources] = useState<JobSourceInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testingOllama, setTestingOllama] = useState<boolean>(false);

  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[]; message: string }>({
    available: false,
    models: [],
    message: 'Checking Ollama...'
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
      await checkOllama(data.settings.ollama_url);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkOllama = async (url?: string) => {
    setTestingOllama(true);
    try {
      const res = await testOllama(url || settings?.ollama_url);
      setOllamaStatus(res);
      if (res.models.length > 0 && settings && !res.models.includes(settings.ollama_model)) {
        setSettings({ ...settings, ollama_model: res.models[0] });
      }
    } catch (e: any) {
      setOllamaStatus({ available: false, models: [], message: e.message });
    } finally {
      setTestingOllama(false);
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
          <p className="page-subtitle">Configure Local AI (Ollama), Telegram notifications, Job Sources, and Scheduler</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Ollama Local AI Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={20} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Local AI Engine (Ollama)</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => checkOllama()} disabled={testingOllama}>
              <RefreshCw size={14} className={testingOllama ? 'spin' : ''} /> Discover Models
            </button>
          </div>

          <div style={{
            backgroundColor: ollamaStatus.available ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            color: ollamaStatus.available ? 'var(--status-success)' : 'var(--status-danger)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {ollamaStatus.available ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{ollamaStatus.message}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Ollama Host URL</label>
            <input
              type="text"
              className="form-input"
              value={settings.ollama_url}
              onChange={(e) => setSettings({ ...settings, ollama_url: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Installed Ollama Model</label>
            {ollamaStatus.models.length > 0 ? (
              <select
                className="form-select"
                style={{ width: '100%', fontWeight: 600 }}
                value={settings.ollama_model}
                onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
              >
                {ollamaStatus.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="form-input"
                placeholder="e.g. qwen2.5:1.5b or llama3:latest"
                value={settings.ollama_model}
                onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
              />
            )}

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Active local model: <code>{settings.ollama_model || 'None selected'}</code>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                className="form-input"
                value={settings.ollama_temperature}
                onChange={(e) => setSettings({ ...settings, ollama_temperature: parseFloat(e.target.value) || 0.2 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Tokens</label>
              <input
                type="number"
                className="form-input"
                value={settings.ollama_max_tokens}
                onChange={(e) => setSettings({ ...settings, ollama_max_tokens: parseInt(e.target.value, 10) || 2048 })}
              />
            </div>
          </div>
        </div>

        {/* Telegram Notifications Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Send size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Telegram Notifications (Optional)</h3>
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

          <div className="form-group">
            <label className="form-label">Min Match Score for Telegram Alert ({settings.telegram_min_score}%)</label>
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

      {/* Modular Job Sources Architecture */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Globe size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Modular Job Sources Architecture</h3>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Enable or disable supported public job sources. Restricted platforms requiring login or CAPTCHA display status disclosures.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {sources.map((s) => (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                backgroundColor: s.is_enabled ? 'var(--bg-surface)' : 'var(--bg-muted)'
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.display_name}</div>
                <div style={{ fontSize: '0.8rem', color: s.status.includes('Active') ? 'var(--status-success)' : 'var(--status-warning)', marginTop: '4px' }}>
                  {s.status}
                </div>
              </div>

              <input
                type="checkbox"
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                checked={s.is_enabled}
                onChange={() => toggleSource(s.id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Local Background Scheduler */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Local Background Scheduler</h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
            <input
              type="checkbox"
              style={{ width: '18px', height: '18px' }}
              checked={settings.scheduler_enabled}
              onChange={(e) => setSettings({ ...settings, scheduler_enabled: e.target.checked })}
            />
            Enable Background Scanning
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Scan Interval:</span>
            <select
              className="form-select"
              value={settings.scheduler_interval}
              onChange={(e) => setSettings({ ...settings, scheduler_interval: parseInt(e.target.value, 10) })}
            >
              <option value={1}>Every 1 hour</option>
              <option value={3}>Every 3 hours</option>
              <option value={6}>Every 6 hours</option>
              <option value={12}>Every 12 hours</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
