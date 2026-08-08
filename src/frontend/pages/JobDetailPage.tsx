import React, { useEffect, useState } from 'react';
import { Job } from '../../shared/types';
import { fetchJobById, analyzeJobApi, fetchProfile } from '../api';
import { ArrowLeft, ExternalLink, Mail, CheckCircle2, AlertTriangle, Cpu, RefreshCw, Copy, Check, Sparkles, Building, MapPin, Calendar, DollarSign } from 'lucide-react';

interface JobDetailPageProps {
  jobId: number;
  onBack: () => void;
}

export const JobDetailPage: React.FC<JobDetailPageProps> = ({ jobId, onBack }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Email Template State
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    loadJobDetails();
  }, [jobId]);

  const loadJobDetails = async () => {
    setLoading(true);
    try {
      const [data, profile] = await Promise.all([
        fetchJobById(jobId),
        fetchProfile().catch(() => null)
      ]);
      setJob(data);

      if (data) {
        const candidateName = profile?.name || 'Candidate';
        const candidateRole = profile?.primary_role || 'Software Engineer';
        const candidateExp = profile?.experience_text || `${profile?.experience_years || 3}+ years experience`;
        const candidateLoc = profile?.primary_location || 'India';
        const skillsStr = (profile?.core_skills || []).slice(0, 6).join(', ');

        setEmailSubject(`Application for ${data.title} - ${candidateName} (${candidateRole})`);
        setEmailBody(
`Hi Hiring Team at ${data.company},

I am writing to express my strong interest in the ${data.title} role. With ${candidateExp} in ${candidateRole} and building scalable systems, I am confident in delivering immediate value to your team.

Key Highlights of my technical background:
• Hands-on expertise: ${skillsStr || 'Software Engineering & System Architecture'}.
• Location: ${candidateLoc}.
• Track record of delivering production-grade applications and robust integrations.

I have attached my active master resume for your review and would welcome the opportunity to discuss how my background aligns with ${data.company}'s goals.

Best regards,
${candidateName}
${candidateRole}
${candidateLoc}`
        );
      }
    } catch (err) {
      console.error('Error loading job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!job) return;
    setAnalyzing(true);
    try {
      await analyzeJobApi(job.id);
      await loadJobDetails();
    } catch (err: any) {
      alert('Analysis error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopyEmail = () => {
    const fullText = `Subject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading || !job) {
    return (
      <div className="page-container">
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading Job Details...</div>
      </div>
    );
  }

  const detectedEmail = job.contact_email || (job.description.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0];

  return (
    <div className="page-container">
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '20px' }}>
        <ArrowLeft size={16} /> Back to Job Opportunities
      </button>

      {/* Main Job Header */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{job.title}</h1>
              {job.remote && <span className="badge badge-info">Remote</span>}
              <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                Source: {job.source.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building size={16} color="var(--accent-primary)" />
                <strong>{job.company}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} />
                <span>{job.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} />
                <span>Posted: {job.posted_date || 'Recently'}</span>
              </div>
              {job.salary_min && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={16} />
                  <span>Salary: {job.salary_currency} {job.salary_min} - {job.salary_max}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Apply Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <span>Apply via Web Source</span>
              <ExternalLink size={16} />
            </a>

            {detectedEmail && (
              <a
                href={`mailto:${detectedEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                className="btn btn-success"
                style={{ textDecoration: 'none', backgroundColor: 'var(--status-success)', color: '#fff' }}
              >
                <Mail size={16} />
                <span>Email Recruiter ({detectedEmail})</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* AI Match Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Ollama AI Match Score
          </div>
          <div style={{
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            backgroundColor: (job.match_score || 0) >= 80 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
            color: (job.match_score || 0) >= 80 ? 'var(--status-success)' : 'var(--status-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.8rem',
            marginBottom: '12px'
          }}>
            {job.match_score || 0}%
          </div>

          <span className={`badge ${
            job.recommendation === 'APPLY' ? 'badge-success' : job.recommendation === 'MAYBE' ? 'badge-warning' : 'badge-info'
          }`} style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
            Recommendation: {job.recommendation || 'APPLY'}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReanalyze}
            disabled={analyzing}
            style={{ marginTop: '16px' }}
          >
            <RefreshCw size={14} className={analyzing ? 'spin' : ''} />
            <span>Re-Analyze with Local AI</span>
          </button>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>AI Match Breakdown & Summary</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
            {job.ai_summary || 'Local Ollama AI evaluates skills, experience level, location, and master resume alignment.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--status-success)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={16} /> Matching Skills
              </div>
              <div className="tag-container">
                {(job.matching_skills || []).length > 0 ? (
                  job.matching_skills!.map((s, idx) => (
                    <span key={idx} className="badge badge-success">{s}</span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None extracted</span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--status-warning)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> Missing / Gap Skills
              </div>
              <div className="tag-container">
                {(job.missing_skills || []).length > 0 ? (
                  job.missing_skills!.map((s, idx) => (
                    <span key={idx} className="badge badge-warning">{s}</span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--status-success)' }}>Zero Skill Gaps! (Direct Match)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Email & Cover Letter Generator Card */}
      <div className="card" style={{ marginBottom: '24px', backgroundColor: 'var(--accent-light)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Direct Recruiter Email Application Generator</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyEmail}>
            {copied ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Email Content'}</span>
          </button>
        </div>

        {detectedEmail && (
          <div style={{ fontSize: '0.85rem', color: 'var(--status-success)', marginBottom: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mail size={16} /> Contact Email Detected: <code>{detectedEmail}</code>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email Subject Line</label>
          <input
            type="text"
            className="form-input"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Tailored Cold Email Cover Letter</label>
          <textarea
            className="form-textarea"
            rows={8}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
          />
        </div>
      </div>

      {/* Original Full Job Description */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Full Job Description</h3>
        <div style={{
          fontSize: '0.9rem',
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-line',
          backgroundColor: 'var(--bg-surface)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          {job.description}
        </div>
      </div>
    </div>
  );
};
