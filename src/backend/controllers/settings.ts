import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { AppSettings, JobSourceInfo } from '../../shared/types.js';

export function getSettings(req: Request, res: Response) {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const kvMap: Record<string, string> = {};
    for (const r of rows) {
      kvMap[r.key] = r.value;
    }

    const sourcesRows = db.prepare('SELECT * FROM job_sources ORDER BY id ASC').all() as any[];

    const settings: AppSettings = {
      ollama_url: kvMap['ollama_url'] || 'http://localhost:11434',
      ollama_model: kvMap['ollama_model'] || 'qwen2.5:1.5b',
      ollama_temperature: parseFloat(kvMap['ollama_temperature'] || '0.2'),
      ollama_max_tokens: parseInt(kvMap['ollama_max_tokens'] || '2048', 10),
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

      upsert.run('ollama_url', settings.ollama_url || 'http://localhost:11434');
      upsert.run('ollama_model', settings.ollama_model || 'qwen2.5:1.5b');
      upsert.run('ollama_temperature', String(settings.ollama_temperature ?? 0.2));
      upsert.run('ollama_max_tokens', String(settings.ollama_max_tokens ?? 2048));
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

export async function testOllamaConnection(req: Request, res: Response) {
  try {
    const url = req.body.url || 'http://localhost:11434';
    const response = await fetch(`${url}/api/tags`);

    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map((m: any) => m.name || m.model);

      if (models.length > 0) {
        db.prepare(`
          INSERT INTO settings (key, value, updated_at)
          VALUES ('ollama_model', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `).run(models[0]);
      }

      return res.json({
        available: true,
        models,
        message: `Connected to Ollama. Found ${models.length} installed model(s) (${models.join(', ')}).`
      });
    }

    return res.json({
      available: false,
      models: [],
      message: `Failed to connect to Ollama: HTTP status ${response.status}`
    });
  } catch (error: any) {
    return res.json({
      available: false,
      models: [],
      message: `Ollama connection failed: ${error.message}`
    });
  }
}
