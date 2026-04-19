
import React, { useRef } from 'react';
import { AppState, ExtractedTopic, SessionDuration } from '../types';

interface Props {
  appState: AppState;
  uploadedFile: File | null;
  noteTitle: string;
  extractedTopics: ExtractedTopic[];
  selectedDuration: SessionDuration;
  onDurationChange: (d: SessionDuration) => void;
  onFileUpload: (file: File) => void;
  onBeginSession: () => void;
}

const DURATIONS: { value: SessionDuration; label: string; desc: string }[] = [
  { value: 15, label: '15', desc: 'Surface audit' },
  { value: 30, label: '30', desc: 'Standard' },
  { value: 45, label: '45', desc: 'Deep dive' },
  { value: 60, label: '60', desc: 'Full audit' },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: '0.5px solid var(--color-border-tertiary)',
      borderRadius: 'var(--border-radius-lg)',
      padding: 20,
      marginBottom: 16
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

export function SetupView({ appState, uploadedFile, noteTitle, extractedTopics, selectedDuration, onDurationChange, onFileUpload, onBeginSession }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = appState === AppState.UPLOADING || appState === AppState.PROCESSING;
  const isReady = appState === AppState.SESSION_SETUP;

  if (isLoading) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
        <div style={{
          width: 32, height: 32, border: '2px solid var(--color-border-tertiary)',
          borderTopColor: 'var(--color-text-primary)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {appState === AppState.UPLOADING ? 'Reading file…' : 'Extracting topics from your notes…'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>This takes a few seconds</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!isReady) {
    // Prompt to upload
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
        <Card title="Upload notes">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileUpload(f); }}
            style={{
              border: '0.5px dashed var(--color-border-primary)',
              borderRadius: 'var(--border-radius-md)',
              padding: 32,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>Drop your notes here or click to browse</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>PDF or text file</div>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>

      {/* File card */}
      <Card title="Uploaded notes">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px',
          background: 'var(--color-background-secondary)',
          borderRadius: 'var(--border-radius-md)',
          border: '0.5px solid var(--color-border-tertiary)'
        }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0
          }}>📄</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {uploadedFile?.name || noteTitle}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {extractedTopics.length} topics detected
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 500,
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 6, background: 'var(--color-background-primary)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)'
            }}
          >
            Replace
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
        </div>
      </Card>

      {/* Topics card */}
      <Card title="Topics detected">
        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
          {extractedTopics.length} topics extracted from your notes
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {extractedTopics.map(t => (
            <span key={t.id} style={{
              fontSize: 12, padding: '5px 11px', borderRadius: 20,
              border: '0.5px solid var(--color-border-tertiary)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-background-primary)'
            }}>
              {t.name}
            </span>
          ))}
        </div>
      </Card>

      {/* Duration card */}
      <Card title="Session duration">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {DURATIONS.map(d => {
            const sel = selectedDuration === d.value;
            return (
              <div
                key={d.value}
                onClick={() => onDurationChange(d.value)}
                style={{
                  padding: '12px 8px',
                  border: sel ? '0.5px solid var(--color-border-primary)' : '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 'var(--border-radius-md)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: sel ? 'var(--color-background-secondary)' : 'transparent',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 500, display: 'block', letterSpacing: '-0.02em', color: sel ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{d.label}</span>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 3 }}>min</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 6, lineHeight: 1.4 }}>{d.desc}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 10 }}>
          Session extends automatically if a weakness is detected near the end
        </div>
      </Card>

      {/* Begin */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onBeginSession}
          style={{
            padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            background: 'var(--color-text-primary)',
            color: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-text-primary)',
            fontFamily: 'var(--font-sans)'
          }}
        >
          Begin session →
        </button>
      </div>
    </div>
  );
}
