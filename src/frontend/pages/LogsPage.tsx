import React, { useEffect, useState } from 'react';
import { LogEntry } from '../../shared/types';
import { fetchLogs, clearLogs as apiClearLogs } from '../api';
import { Terminal, Trash2, RefreshCw } from 'lucide-react';

export const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all system logs?')) return;
    try {
      await apiClearLogs();
      loadLogs();
    } catch (err: any) {
      alert('Failed to clear logs: ' + err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">System Event Logs</h1>
          <p className="page-subtitle">Real-time local event audit trail for database, AI model, scrapers, and background tasks</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-secondary" onClick={handleClearLogs}>
            <Trash2 size={16} color="var(--status-error)" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px' }}>Loading system logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Terminal size={40} className="empty-state-icon" />
            <div className="empty-state-title">No Logs Found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>TIMESTAMP</th>
                  <th style={{ padding: '10px 14px' }}>COMPONENT</th>
                  <th style={{ padding: '10px 14px' }}>EVENT</th>
                  <th style={{ padding: '10px 14px' }}>STATUS</th>
                  <th style={{ padding: '10px 14px' }}>MESSAGE</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'monospace' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{log.component}</td>
                    <td style={{ padding: '10px 14px' }}>{log.event}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className={`badge ${
                        log.status === 'SUCCESS' ? 'badge-success' : log.status === 'ERROR' ? 'badge-warning' : 'badge-info'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
