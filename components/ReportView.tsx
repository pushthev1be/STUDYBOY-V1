
import React, { useState } from 'react';
import { KnowledgeReport, TopicStatus } from '../types';

interface Props {
  report: KnowledgeReport;
  onNewSession: () => void;
  onStudyAgain?: () => void;
}

const DOT_CLS: Record<TopicStatus, string> = {
  strong: '#3B6D11',
  weak: '#BA7517',
  revisit: '#185FA5',
  untested: 'var(--color-border-secondary)'
};

const BADGE: Record<TopicStatus, { bg: string; color: string; label: string }> = {
  strong:  { bg: '#EAF3DE', color: '#3B6D11', label: 'Strong' },
  weak:    { bg: '#FAEEDA', color: '#633806', label: 'Weak' },
  revisit: { bg: '#E6F1FB', color: '#0C447C', label: 'Revisit' },
  untested:{ bg: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', label: 'Not covered' }
};

const SCORE_COLOR: Record<string, string> = {
  strong: '#3B6D11',
  weak: '#BA7517',
  revisit: '#0C447C'
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ReportView({ report, onNewSession, onStudyAgain }: Props) {
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const strong  = report.topics.filter(t => t.status === 'strong').length;
  const weak    = report.topics.filter(t => t.status === 'weak').length;
  const revisit = report.topics.filter(t => t.status === 'revisit').length;

  const toggleTopic = (id: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Report header */}
      <div style={{ padding: '20px 24px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 4 }}>
          {report.uploadTitle}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
          Session completed · {report.actualDurationMinutes} min · {report.topics.length} topics audited · {formatDate(report.date)}
          {report.overtimeUsed && ' · Overtime used'}
        </div>
      </div>

      {/* Report body */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Score summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {([['strong', 'Strong topics', strong], ['weak', 'Weak topics', weak], ['revisit', 'Needs revisit', revisit]] as const).map(([key, label, val]) => (
            <div key={key} style={{
              padding: 14,
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: 'var(--border-radius-md)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: SCORE_COLOR[key] }}>{val}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Topic breakdown */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Topic breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {report.topics.map(t => {
              const status = t.status as TopicStatus;
              const badge = BADGE[status];
              const isWeak = status === 'weak' || status === 'revisit';
              const expanded = expandedTopics.has(t.topicId);
              const concepts: string[] = (t as any).concepts || [];

              return (
                <div key={t.topicId} style={{
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'var(--color-background-primary)',
                  overflow: 'hidden'
                }}>
                  <div
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', cursor: isWeak ? 'pointer' : 'default' }}
                    onClick={() => isWeak && toggleTopic(t.topicId)}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: DOT_CLS[status] }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 3 }}>{t.topicName}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{t.evidence}</div>
                      {t.noteSection && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 3 }}>→ {t.noteSection}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                        background: badge.bg, color: badge.color
                      }}>
                        {badge.label}
                      </span>
                      {isWeak && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          {expanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandable concepts for weak/revisit */}
                  {isWeak && expanded && (
                    <div style={{
                      borderTop: '0.5px solid var(--color-border-tertiary)',
                      padding: '12px 14px 14px 32px',
                      background: 'var(--color-background-secondary)'
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Review these concepts
                      </div>
                      {concepts.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {concepts.map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)', alignItems: 'flex-start' }}>
                              <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, marginTop: 1 }}>·</span>
                              <span>{c}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>No specific concepts recorded for this topic.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Revisit list */}
        {report.revisitList.length > 0 && (
          <div style={{
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '14px 16px'
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 10 }}>Revisit list</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {report.revisitList.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>—</span>
                  <span>
                    {item.concept}
                    {item.noteSection && <span style={{ color: 'var(--color-text-tertiary)' }}> ({item.topicName}, {item.noteSection})</span>}
                    {!item.noteSection && <span style={{ color: 'var(--color-text-tertiary)' }}> ({item.topicName})</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {onStudyAgain && (
            <button
              onClick={onStudyAgain}
              style={{
                padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '0.5px solid var(--color-border-secondary)',
                fontFamily: 'var(--font-sans)'
              }}
            >
              Study again
            </button>
          )}
          <button
            onClick={onNewSession}
            style={{
              padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
              background: 'var(--color-text-primary)',
              color: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-text-primary)',
              fontFamily: 'var(--font-sans)'
            }}
          >
            New session →
          </button>
        </div>
      </div>
    </div>
  );
}
