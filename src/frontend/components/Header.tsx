import React from 'react';
import { Database, Cpu, Menu } from 'lucide-react';
import { UserProfile } from '../../shared/types';

interface HeaderProps {
  profile: UserProfile | null;
  aiStatus: boolean;
  onToggleMobileDrawer?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, aiStatus, onToggleMobileDrawer }) => {
  return (
    <header className="top-header">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {onToggleMobileDrawer && (
          <button className="mobile-menu-btn" onClick={onToggleMobileDrawer} title="Toggle Drawer Menu">
            <Menu size={18} />
          </button>
        )}

        <div className="header-status-group">
          <div className="status-indicator" title="Local SQLite Database status">
            <Database size={14} color="var(--accent-cyan)" />
            <span className="status-dot active"></span>
            <span>SQLite DB</span>
          </div>

          <div className="status-indicator" title="Cluster Protocol AI Connection Status">
            <Cpu size={14} color="var(--accent-secondary)" />
            <span className={`status-dot ${aiStatus ? 'active' : 'warning'}`}></span>
            <span>Cluster Protocol AI {aiStatus ? 'Active' : 'Key Missing'}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div className="user-avatar-badge">
          {profile?.name ? profile.name.charAt(0).toUpperCase() : 'A'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {profile?.name || 'Ajay Patidar'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {profile?.primary_role || 'React Native Developer'}
          </div>
        </div>
      </div>
    </header>
  );
};
