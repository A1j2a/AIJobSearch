import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  BookmarkCheck,
  Kanban,
  FileText,
  Search,
  BarChart3,
  Terminal,
  Settings,
  Sparkles,
  X
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'jobs'
  | 'saved'
  | 'applications'
  | 'resume'
  | 'search'
  | 'analytics'
  | 'logs'
  | 'settings';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  isOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onSelectPage, isOpen, onCloseMobile }) => {
  const menuItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard & Scan', icon: <LayoutDashboard size={18} /> },
    { id: 'jobs', label: 'Discovered Jobs', icon: <Briefcase size={18} /> },
    { id: 'saved', label: 'Saved Jobs', icon: <BookmarkCheck size={18} /> },
    { id: 'applications', label: 'Applications', icon: <Kanban size={18} /> },
    { id: 'resume', label: 'Resume & Profile', icon: <FileText size={18} /> },
    { id: 'search', label: 'Search Criteria', icon: <Search size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'logs', label: 'System Logs', icon: <Terminal size={18} /> },
    { id: 'settings', label: 'Settings & AI', icon: <Settings size={18} /> },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      <div
        className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onCloseMobile}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-logo-badge">
            <Sparkles size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="sidebar-brand-title">
              Job Finder
              <span className="brand-pro-tag">AI PRO</span>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="btn btn-secondary btn-sm"
              style={{ display: 'none', padding: '4px' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => {
                onSelectPage(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Cluster AI Engine v2.0</div>
          <div>Desktop Enterprise Edition</div>
        </div>
      </aside>
    </>
  );
};
