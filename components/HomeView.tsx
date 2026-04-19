
import React, { useRef } from 'react';
import { KnowledgeReport } from '../types';

interface Props {
  pastReports: KnowledgeReport[];
  onFileUpload: (file: File) => void;
  onViewReport: (report: KnowledgeReport) => void;
  onStartNewSession: () => void;
}

const SESSION_EMOJIS = ['📘', '📗', '📙', '📕', '📓', '📔'];

function scoreLabel(report: KnowledgeReport): { text: string; cls: string } {
  const strong = report.topics.filter(t => t.status === 'strong').length;
  const weak = report.topics.filter(t => t.status === 'weak' || t.status === 'revisit').length;
  if (weak === 0) return { text: `${strong} strong`, cls: 'strong' };
  if (strong === 0) return { text: `${weak} weak`, cls: 'weak' };
  return { text: `${strong} strong · ${weak} weak`, cls: 'mixed' };
}

function pillStyle(cls: string): React.CSSProperties {
  if (cls === 'strong') return { background: '#EAF3DE', color: '#3B6D11' };
  if (cls === 'weak') return { background: '#FAEEDA', color: '#633806' };
  return { background: '#E6F1FB', color: '#0C447C' };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

export function HomeView({ pastReports, onFileUpload, onViewReport, onStartNewSession }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSessions = pastReports.length;
  const avgStrong = totalSessions === 0 ? 0 : Math.round(
    pastReports.reduce((acc, r) => {
      const pct = r.topics.length > 0
        ? (r.topics.filter(t => t.status === 'strong').length / r.topics.length) * 100
        : 0;
      return acc + pct;
    }, 0) / totalSessions
  );
  const totalWeak = pastReports.reduce((acc, r) => acc + r.topics.filter(t => t.status === 'weak' || t.status === 'revisit').length, 0);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileUpload(file);
  };

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
      {/* Hero */}
      <div style={{
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: '28px 28px 24px',
        marginBottom: 20,
        background: 'var(--color-background-secondary)'
      }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', marginBottom: 10 }}>
          Knowledge Audit Tool
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: 8 }}>
          You studied. Now prove it.
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 420, marginBottom: 20 }}>
          Upload the same notes you just studied. Cross Check runs you through a conversational audit and tells you exactly what stuck and what didn't.
        </div>

        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{
            border: '0.5px dashed var(--color-border-primary)',
            borderRadius: 'var(--border-radius-lg)',
            padding: 28,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-primary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: 36, height: 36,
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 10px',
            background: 'var(--color-background-primary)'
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 11V5M5 8l3-3 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>Upload your notes to begin</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>PDF or text file · Max 50MB</div>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])} />

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          {[
            { label: 'Sessions completed', val: totalSessions, sub: 'all time' },
            { label: 'Avg. strong topics', val: totalSessions > 0 ? `${avgStrong}%` : '—', sub: 'across all sessions' },
            { label: 'Weak areas flagged', val: totalWeak, sub: 'need revisit' }
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              padding: '14px 16px'
            }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      {pastReports.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 12, letterSpacing: '0.02em' }}>
            Recent sessions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...pastReports].reverse().slice(0, 5).map((r, i) => {
              const pill = scoreLabel(r);
              return (
                <div
                  key={r.sessionId}
                  onClick={() => onViewReport(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 'var(--border-radius-md)',
                    background: 'var(--color-background-primary)',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-background-primary)')}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                    background: 'var(--color-background-secondary)'
                  }}>
                    {SESSION_EMOJIS[i % SESSION_EMOJIS.length]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.uploadTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {formatDate(r.date)} · {r.actualDurationMinutes} min · {r.topics.length} topics
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 500,
                    padding: '3px 8px', borderRadius: 4, ...pillStyle(pill.cls)
                  }}>
                    {pill.text}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
