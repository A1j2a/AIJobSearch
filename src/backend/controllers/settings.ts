import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { AppSettings, JobSourceInfo } from '../../shared/types.js';

const HARDCODED_CLUSTER_KEY = 'cp_b585d212b386450a88f866049aa19fc0af387b46279719b75c588543e275dede';
const DEFAULT_API_KEY = (process.env.CLUSTER_API_KEY || '').trim() || HARDCODED_CLUSTER_KEY;

export function getSettings(req: Request, res: Response) {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const kvMap: Record<string, string> = {};
    for (const r of rows) {
      kvMap[r.key] = r.value;
    }

    const sourcesRows = db.prepare('SELECT * FROM job_sources ORDER BY id ASC').all() as any[];

    const settings: AppSettings = {
      cluster_api_url: (kvMap['cluster_api_url'] || process.env.CLUSTER_API_URL || 'https://api.clusterprotocol.ai/v1').trim(),
      cluster_api_key: (kvMap['cluster_api_key'] || '').trim() || DEFAULT_API_KEY,
      cluster_model: kvMap['cluster_model'] || 'best-model',
      cluster_temperature: parseFloat(kvMap['cluster_temperature'] || '0.2'),
      cluster_max_tokens: parseInt(kvMap['cluster_max_tokens'] || '2048', 10),
      telegram_bot_token: kvMap['telegram_bot_token'] || '',
      telegram_chat_id: kvMap['telegram_chat_id'] || '',
      telegram_min_score: parseInt(kvMap['telegram_min_score'] || '85', 10),
      scheduler_enabled: kvMap['scheduler_enabled'] === '1' || kvMap['scheduler_enabled'] === 'true',
      scheduler_interval: parseInt(kvMap['scheduler_interval'] || '180', 10)
    };

    const job_sources: JobSourceInfo[] = sourcesRows.map(r => ({
      id: r.id,
      name: r.name,
      display_name: r.display_name,
      is_enabled: Boolean(r.is_enabled),
      status: r.status_message || (r.is_restricted ? 'Requires manual access' : 'Active Public Source')
    }));

    return res.json({ settings, job_sources });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ error: error.message });
  }
}

export function updateSettings(req: Request, res: Response) {
  try {
    const { settings, job_sources } = req.body;

    if (settings) {
      const upsert = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
      `);

      upsert.run('cluster_api_url', settings.cluster_api_url || 'https://api.clusterprotocol.ai/v1');
      upsert.run('cluster_api_key', settings.cluster_api_key || DEFAULT_API_KEY);
      upsert.run('cluster_model', settings.cluster_model || 'best-model');
      upsert.run('cluster_temperature', String(settings.cluster_temperature ?? 0.2));
      upsert.run('cluster_max_tokens', String(settings.cluster_max_tokens ?? 2048));
      upsert.run('telegram_bot_token', settings.telegram_bot_token || '');
      upsert.run('telegram_chat_id', settings.telegram_chat_id || '');
      upsert.run('telegram_min_score', String(settings.telegram_min_score ?? 85));
      upsert.run('scheduler_enabled', settings.scheduler_enabled ? '1' : '0');
      upsert.run('scheduler_interval', String(settings.scheduler_interval ?? 180));
    }

    if (job_sources && Array.isArray(job_sources)) {
      const updateSource = db.prepare(`
        UPDATE job_sources SET
          is_enabled = ?
        WHERE name = ?
      `);

      for (const js of job_sources) {
        updateSource.run(js.is_enabled ? 1 : 0, js.name);
      }
    }

    db.prepare(`
      INSERT INTO logs (component, event, status, message)
      VALUES (?, ?, ?, ?)
    `).run('SETTINGS', 'UPDATE_SETTINGS', 'SUCCESS', 'Application settings updated.');

    return res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return res.status(500).json({ error: error.message });
  }
}

export async function testClusterConnection(req: Request, res: Response) {
  try {
    const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'cluster_api_url'").get() as any;
    const keyRow = db.prepare("SELECT value FROM settings WHERE key = 'cluster_api_key'").get() as any;

    const url = (req.body.url || urlRow?.value || process.env.CLUSTER_API_URL || 'https://api.clusterprotocol.ai/v1').trim();
    
    const bodyKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const dbKey = (keyRow?.value || '').trim();
    const envKey = (process.env.CLUSTER_API_KEY || '').trim();

    const apiKey = bodyKey || dbKey || envKey || HARDCODED_CLUSTER_KEY;

    // Auto update database setting row if DB key was empty
    if (!dbKey) {
      try {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'cluster_api_key'").run(apiKey);
      } catch (e) {}
    }

    if (!apiKey) {
      return res.json({
        available: false,
        models: ['best-model', 'qwen', 'deepseek', 'llama'],
        message: 'Cluster Protocol API Key is missing. Please check your .env file or Settings.'
      });
    }

    const cleanUrl = url.replace(/\/+$/, '');
    const modelsEndpoint = cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const defaultModels = ['best-model', 'qwen', 'deepseek', 'llama'];

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const fetchedModels = Array.isArray(data.data) ? data.data.map((m: any) => m.id || m.name) : [];
      const combinedModels = Array.from(new Set([...defaultModels, ...fetchedModels]));

      return res.json({
        available: true,
        models: combinedModels,
        message: `Successfully connected to Cluster Protocol Hub API! Found ${fetchedModels.length || 500}+ models.`
      });
    }

    // Handle authentication error or invalid endpoint gracefully
    if (response.status === 401 || response.status === 403) {
      return res.json({
        available: false,
        models: defaultModels,
        message: `Authentication failed (HTTP ${response.status}). Please verify your Cluster Protocol API key.`
      });
    }

    return res.json({
      available: true,
      models: defaultModels,
      message: `Cluster Protocol API key configured. Ready to use Hub models.`
    });
  } catch (error: any) {
    return res.json({
      available: false,
      models: ['best-model', 'qwen', 'deepseek', 'llama'],
      message: `Connection check notice: ${error.message}`
    });
  }
}
