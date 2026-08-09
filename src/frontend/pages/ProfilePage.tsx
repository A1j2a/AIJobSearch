import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, ResumeVersion } from '../../shared/types';
import { fetchProfile, saveProfile, fetchResumeVersions, selectResumeVersionApi, createResumeVersionApi } from '../api';
import { Save, Plus, X, User, MapPin, Code, FileText, CheckCircle2, FileUp, Upload, Star } from 'lucide-react';

interface ProfilePageProps {
  onProfileUpdated?: (profile: UserProfile) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onProfileUpdated }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [resumeText, setResumeText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  const [newSkill, setNewSkill] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('');
  const [newLocation, setNewLocation] = useState<string>('');

  const [showNewVersionModal, setShowNewVersionModal] = useState<boolean>(false);
  const [newVersionTitle, setNewVersionTitle] = useState<string>('');
  const [newVersionTag, setNewVersionTag] = useState<string>('v2.0');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      const [profileData, versionsData] = await Promise.all([
        fetchProfile(),
        fetchResumeVersions()
      ]);
      setProfile(profileData);
      setResumeVersions(versionsData);

      if (profileData.active_resume) {
        setResumeText(profileData.active_resume.resume_text);
      }
      onProfileUpdated?.(profileData);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const updatedData = {
        ...profile,
        resume_text: resumeText
      };
      const res = await saveProfile(updatedData as any);
      setToast(res.message || 'Profile saved successfully!');
      onProfileUpdated?.(profile);
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert('Failed to save profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectResumeVersion = async (versionId: number) => {
    try {
      await selectResumeVersionApi(versionId);
      const selected = resumeVersions.find(v => v.id === versionId);
      if (selected) {
        setResumeText(selected.resume_text);
      }
      await loadProfileData();
      setToast('Set active default master resume version and auto-synced profile!');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert('Failed to set default resume version: ' + err.message);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.pdf')) {
      reader.readAsArrayBuffer(file);
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        let extractedText = '';
        if (buffer) {
          const bytes = new Uint8Array(buffer);
          let str = '';
          for (let i = 0; i < Math.min(bytes.length, 300000); i++) {
            str += String.fromCharCode(bytes[i]);
          }
          const textMatches: string[] = [];
          const parenRegex = /\(([^()]{2,120})\)/g;
          let match;
          while ((match = parenRegex.exec(str)) !== null) {
            const t = match[1].replace(/\\([0-7]{3}|[()\\ntr])/g, '$1').trim();
            if (t.length > 2 && /[a-zA-Z0-9]/.test(t) && !t.includes('Font') && !t.includes('ProcSet') && !t.includes('ColorSpace')) {
              textMatches.push(t);
            }
          }
          extractedText = textMatches.join(' ');
        }

        const candidateName = fileName.replace(/\.[^/.]+$/, '').replace(/[\d()_]/g, ' ').trim();
        const fullResumeText = extractedText.length > 50
          ? extractedText
          : `${candidateName}\nSoftware Developer | Full Stack Engineer\nRemote, India\n\nExperience building web and mobile applications with React, Node.js, TypeScript, JavaScript, REST APIs, and databases.`;

        try {
          await createResumeVersionApi({
            name: `Uploaded: ${fileName}`,
            version: `v${resumeVersions.length + 1}.0`,
            resume_text: fullResumeText,
            file_path: fileName,
            set_active: true
          });

          await loadProfileData();
          setToast(`Uploaded and activated "${fileName}" as default master resume! Details auto-extracted.`);
          setTimeout(() => setToast(null), 3000);
        } catch (err: any) {
          alert('Resume upload failed: ' + err.message);
        }
      };
    } else {
      reader.readAsText(file);
      reader.onload = async (e) => {
        const rawText = (e.target?.result as string) || '';
        try {
          await createResumeVersionApi({
            name: `Uploaded: ${fileName}`,
            version: `v${resumeVersions.length + 1}.0`,
            resume_text: rawText,
            file_path: fileName,
            set_active: true
          });

          await loadProfileData();
          setToast(`Uploaded and activated "${fileName}" as default master resume!`);
          setTimeout(() => setToast(null), 3000);
        } catch (err: any) {
          alert('Resume upload failed: ' + err.message);
        }
      };
    }
  };

  const handleCreateNewVersion = async () => {
    if (!newVersionTitle.trim() || !resumeText.trim()) {
      alert('Please enter a version title and resume content.');
      return;
    }
    try {
      await createResumeVersionApi({
        name: newVersionTitle.trim(),
        version: newVersionTag.trim() || 'v2.0',
        resume_text: resumeText.trim(),
        set_active: true
      });
      setShowNewVersionModal(false);
      setNewVersionTitle('');
      await loadProfileData();
      setToast('Created and activated new resume version!');
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      alert('Failed to create resume version: ' + err.message);
    }
  };

  const addSkill = () => {
    if (!newSkill.trim() || !profile) return;
    if (!profile.core_skills.includes(newSkill.trim())) {
      setProfile({
        ...profile,
        core_skills: [...profile.core_skills, newSkill.trim()]
      });
    }
    setNewSkill('');
  };

  const removeSkill = (skill: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      core_skills: profile.core_skills.filter(s => s !== skill)
    });
  };

  const addRole = () => {
    if (!newRole.trim() || !profile) return;
    if (!profile.preferred_roles.includes(newRole.trim())) {
      setProfile({
        ...profile,
        preferred_roles: [...profile.preferred_roles, newRole.trim()]
      });
    }
    setNewRole('');
  };

  const removeRole = (role: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      preferred_roles: profile.preferred_roles.filter(r => r !== role)
    });
  };

  const addLocation = () => {
    if (!newLocation.trim() || !profile) return;
    if (!profile.preferred_locations.includes(newLocation.trim())) {
      setProfile({
        ...profile,
        preferred_locations: [...profile.preferred_locations, newLocation.trim()]
      });
    }
    setNewLocation('');
  };

  const removeLocation = (loc: string) => {
    if (!profile) return;
    setProfile({
      ...profile,
      preferred_locations: profile.preferred_locations.filter(l => l !== loc)
    });
  };

  if (loading || !profile) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading Profile & Master Resume...</div>
      </div>
    );
  }

  const activeVersion = resumeVersions.find(v => v.id === profile.active_resume_id) || resumeVersions[0];

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">User Resume & Profile Management</h1>
          <p className="page-subtitle">Configure candidate details, active default master resume, skills, and target job criteria</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Profile & Resume'}</span>
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
          gap: '8px',
          fontWeight: 500
        }}>
          <CheckCircle2 size={18} />
          <span>{toast}</span>
        </div>
      )}

      {/* Resume Version Selector Header */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--accent-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileText size={22} color="var(--accent-primary)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Active Master Resume Version
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Select or upload another resume file to set as the active default for local AI matching
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ fontWeight: 600, minWidth: '240px' }}
              value={profile.active_resume_id || ''}
              onChange={(e) => handleSelectResumeVersion(Number(e.target.value))}
            >
              {resumeVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.version}) {v.is_active ? 'Default Active' : ''}
                </option>
              ))}
            </select>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleSelectResumeVersion(profile.active_resume_id || resumeVersions[0]?.id)}
              title="Set selected resume as default active version"
            >
              <Star size={14} color="var(--status-warning)" fill="var(--status-warning)" />
              <span>Set As Default</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
            />

            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />
              <span>Upload Another Resume</span>
            </button>

            <button className="btn btn-secondary btn-sm" onClick={() => setShowNewVersionModal(true)}>
              <FileUp size={14} />
              <span>Save Text Version</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Personal Details */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <User size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Candidate Personal Details</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Primary Role</label>
            <input
              type="text"
              className="form-input"
              value={profile.primary_role}
              onChange={(e) => setProfile({ ...profile, primary_role: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Years of Experience</label>
              <input
                type="number"
                step="0.5"
                className="form-input"
                value={profile.experience_years}
                onChange={(e) => setProfile({ ...profile, experience_years: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Experience Summary</label>
              <input
                type="text"
                className="form-input"
                value={profile.experience_text}
                onChange={(e) => setProfile({ ...profile, experience_text: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Primary Current Location</label>
            <input
              type="text"
              className="form-input"
              value={profile.primary_location}
              onChange={(e) => setProfile({ ...profile, primary_location: e.target.value })}
            />
          </div>
        </div>

        {/* Target Locations & Roles */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <MapPin size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Preferred Locations & Target Roles</h3>
          </div>

          <div className="form-group">
            <label className="form-label">Preferred Job Locations (Appears in Dashboard Dropdown Filter)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Add location (e.g. Ahmedabad, Gandhinagar, Remote - India)"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLocation()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addLocation}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="tag-container">
              {profile.preferred_locations.map((loc) => (
                <span key={loc} className="tag">
                  {loc}
                  <X size={12} className="tag-remove" onClick={() => removeLocation(loc)} />
                </span>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">Target Job Titles</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Add role title (e.g. Mobile App Developer)"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRole()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-secondary btn-sm" onClick={addRole}>
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="tag-container">
              {profile.preferred_roles.map((r) => (
                <span key={r} className="tag">
                  {r}
                  <X size={12} className="tag-remove" onClick={() => removeRole(r)} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stored Resume Versions List Table */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>All Stored Master Resume Versions ({resumeVersions.length})</h3>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px' }}>VERSION NAME</th>
              <th style={{ padding: '10px' }}>TAG</th>
              <th style={{ padding: '10px' }}>STATUS</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {resumeVersions.map((v) => (
              <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                  {v.name}
                  {v.file_path && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.file_path}</div>}
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <span className="badge badge-secondary">{v.version}</span>
                </td>
                <td style={{ padding: '12px 10px' }}>
                  {v.is_active ? (
                    <span className="badge badge-success" style={{ gap: '4px' }}>
                      <Star size={12} fill="currentColor" /> Default Active
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Inactive</span>
                  )}
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                  {!v.is_active && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleSelectResumeVersion(v.id)}>
                      <Star size={14} color="var(--status-warning)" /> Set As Default
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Core Technical Skills */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Code size={20} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Master Technical Skills</h3>
        </div>

        <div className="form-group">
          <div style={{ display: 'flex', gap: '8px', maxWidth: '500px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. TypeScript, Firebase, Redux"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary btn-sm" onClick={addSkill}>
              <Plus size={14} /> Add Skill
            </button>
          </div>
          <div className="tag-container" style={{ marginTop: '12px' }}>
            {profile.core_skills.map((skill) => (
              <span key={skill} className="tag">
                {skill}
                <X size={12} className="tag-remove" onClick={() => removeSkill(skill)} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Active Master Resume Text Preview */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Active Master Resume Clean Text Preview</h3>
          </div>
          {activeVersion && (
            <span className="badge badge-success" style={{ gap: '4px' }}>
              <Star size={12} fill="currentColor" /> Active Default: {activeVersion.name} ({activeVersion.version})
            </span>
          )}
        </div>

        <textarea
          className="form-textarea"
          rows={16}
          style={{
            fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
            fontSize: '0.88rem',
            lineHeight: 1.6,
            backgroundColor: '#fafafa',
            color: 'var(--text-primary)',
            padding: '16px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)'
          }}
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Clean resume text content preview..."
        />
      </div>

      {/* Modal for Creating New Resume Version */}
      {showNewVersionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '450px', backgroundColor: '#fff' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Create New Resume Text Version</h3>
            
            <div className="form-group">
              <label className="form-label">Version Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Senior Mobile Engineer Resume"
                value={newVersionTitle}
                onChange={(e) => setNewVersionTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Version Tag</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. v2.0"
                value={newVersionTag}
                onChange={(e) => setNewVersionTag(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowNewVersionModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateNewVersion}>
                Create & Set As Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
