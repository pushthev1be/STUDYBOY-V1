
import React, { useState, useRef } from 'react';
import { X, Upload, Lock, Loader2, Check, ChevronRight } from 'lucide-react';
import { PersonalityProfile } from '../types';
import { extractPersonality } from '../services/personalityService';

interface Props {
  onSave: (profile: PersonalityProfile) => void;
  onClose: () => void;
}

type Step = 'upload' | 'details' | 'processing' | 'done';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const STEP_LABELS: Record<Step, string> = {
  upload: 'Upload conversations',
  details: 'Name & PIN',
  processing: 'Processing',
  done: 'Done'
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'var(--color-background-primary)',
  border: '0.5px solid var(--color-border-secondary)',
  borderRadius: 8, outline: 'none',
  fontSize: 13, color: 'var(--color-text-primary)',
  fontFamily: 'var(--font-sans)'
};

export function PersonalitySetup({ onSave, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [chatText, setChatText] = useState('');
  const [name, setName] = useState('');
  const [authorizedEmail, setAuthorizedEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const chatFileRef = useRef<HTMLInputElement>(null);

  const handleChatFiles = async (files: FileList | null) => {
    if (!files) return;
    const texts: string[] = [];
    for (const file of Array.from(files)) {
      texts.push(await file.text());
    }
    setChatText(prev => prev + '\n\n' + texts.join('\n\n'));
  };

  const handleProcess = async () => {
    setError('');
    if (!chatText.trim()) { setError('Please provide some conversations first.'); return; }
    if (!name.trim()) { setError('Enter a name.'); return; }
    if (!authorizedEmail.trim() || !authorizedEmail.includes('@')) { setError('Enter a valid email address.'); return; }
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    if (pin !== pinConfirm) { setError("PINs don't match."); return; }

    setStep('processing');
    setProcessing(true);
    try {
      const style = await extractPersonality(chatText);
      const profile: PersonalityProfile = {
        id: generateId(),
        name: name.trim(),
        pfpDataUrl: '',
        pin,
        authorizedEmail: authorizedEmail.trim().toLowerCase(),
        style,
        createdAt: new Date().toISOString()
      };
      onSave(profile);
      setStep('done');
    } catch (e: any) {
      setError(e?.message || 'Failed to process conversations. Try again.');
      setStep('details');
    } finally {
      setProcessing(false);
    }
  };

  const STEPS: Step[] = ['upload', 'details'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--color-background-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 16, overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Create personality</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{STEP_LABELS[step]}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 5, padding: '12px 20px 0' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              height: 3, flex: 1, borderRadius: 2,
              background: i <= stepIndex ? 'var(--color-text-primary)' : 'var(--color-border-tertiary)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 20px 24px' }}>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Upload exported chats (.txt files) or paste messages directly. The more conversations, the better the personality match.
              </div>

              <div
                onClick={() => chatFileRef.current?.click()}
                style={{
                  border: '0.5px dashed var(--color-border-secondary)',
                  borderRadius: 10, padding: '20px 16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  cursor: 'pointer', textAlign: 'center'
                }}
              >
                <Upload size={20} style={{ color: 'var(--color-text-tertiary)' }} />
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Click to upload .txt chat exports</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>WhatsApp, iMessage, Discord — any plain text export</div>
                <input ref={chatFileRef} type="file" accept=".txt" multiple style={{ display: 'none' }} onChange={e => handleChatFiles(e.target.files)} />
              </div>

              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>— or paste directly —</div>

              <textarea
                placeholder="Paste chat messages here..."
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                style={{
                  ...inputStyle,
                  minHeight: 120, resize: 'vertical', lineHeight: 1.5,
                  border: '0.5px solid var(--color-border-secondary)'
                }}
              />

              {chatText.trim() && (
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {chatText.length.toLocaleString()} characters loaded
                </div>
              )}

              {error && step === 'upload' && (
                <div style={{ fontSize: 12, color: '#f87171', padding: '8px 10px', background: '#1a0a0a', borderRadius: 6 }}>
                  {error}
                </div>
              )}

              <button
                onClick={() => { if (!chatText.trim()) { setError('Add some conversations first.'); return; } setError(''); setStep('details'); }}
                disabled={!chatText.trim()}
                style={{
                  padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: chatText.trim() ? 'var(--color-text-primary)' : 'var(--color-border-tertiary)',
                  color: chatText.trim() ? 'var(--color-background-primary)' : 'var(--color-text-tertiary)',
                  border: 'none', cursor: chatText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'var(--font-sans)'
                }}
              >
                Continue <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Step 2: Name + PIN */}
          {step === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                Set a name and PIN. Your girlfriend will need the PIN to enable this mode.
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>Your name</div>
                <input
                  type="text"
                  placeholder="e.g. Jake"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>Her email address</div>
                <input
                  type="email"
                  placeholder="girlfriend@email.com"
                  value={authorizedEmail}
                  onChange={e => setAuthorizedEmail(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>Only this email can enable the personality</div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>PIN (4+ digits)</div>
                <input
                  type="password"
                  placeholder="Enter PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 6 }}>Confirm PIN</div>
                <input
                  type="password"
                  placeholder="Repeat PIN"
                  value={pinConfirm}
                  onChange={e => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  inputMode="numeric"
                  style={inputStyle}
                />
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#f87171', padding: '8px 10px', background: '#1a0a0a', borderRadius: 6 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => { setError(''); setStep('upload'); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 13, background: 'none', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  Back
                </button>
                <button
                  onClick={handleProcess}
                  style={{
                    flex: 2, padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  Create personality
                </button>
              </div>
            </div>
          )}

          {/* Processing */}
          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--color-text-secondary)', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                Analyzing conversations and building personality profile…
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                This usually takes 10–20 seconds
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Done */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#1a2f1a', border: '0.5px solid #3B6D11',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Check size={24} style={{ color: '#3B6D11' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Personality created</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                The icon will appear in the sidebar. Your girlfriend can enable it with the PIN you set.
              </div>
              <button
                onClick={onClose}
                style={{
                  marginTop: 4, padding: '10px 28px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: 'var(--color-text-primary)', color: 'var(--color-background-primary)',
                  border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)'
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
