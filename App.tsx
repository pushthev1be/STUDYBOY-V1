
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, User, CheckSession, SessionDuration, QAMessage, ExtractedTopic, TopicPerformance, SessionTurnResponse, KnowledgeReport, PersonalityProfile } from './types';
import { extractTopicsFromNotes, runSessionTurn, generateKnowledgeReport, extractTextFromImage } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { AuthView } from './components/AuthView';
import { BrandMark } from './components/BrandMark';
import { HomeView } from './components/HomeView';
import { SetupView } from './components/SetupView';
import { SessionView } from './components/SessionView';
import { ReportView } from './components/ReportView';
import { PersonalitySetup } from './components/PersonalitySetup';
import { ThemeProvider } from './components/ThemeContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

type AppScreen = 'home' | 'setup' | 'session' | 'report';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(' '));
  }
  return pages.join('\n\n');
}

function loadPastReports(): KnowledgeReport[] {
  try {
    const raw = localStorage.getItem('crosscheck-reports');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePastReports(reports: KnowledgeReport[]) {
  try { localStorage.setItem('crosscheck-reports', JSON.stringify(reports.slice(-20))); } catch {}
}

// Nav SVG icons
const NAV_ICONS = {
  home: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 6.5L8 2l6 4.5V14a1 1 0 01-1 1H3a1 1 0 01-1-1V6.5z" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>,
  setup: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M5 8h6M5 5h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>,
  session: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>,
  report: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h10v12H3z" stroke="currentColor" strokeWidth="1.2" fill="none" /><path d="M5 6h6M5 9h6M5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>,
};

const PAGE_NAMES: Record<AppScreen, string> = {
  home: 'Home',
  setup: 'New session',
  session: 'Live session',
  report: 'Session report'
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('home');
  const [user, setUser] = useState<User | null>(null);

  // Upload / extraction
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [extractedTopics, setExtractedTopics] = useState<ExtractedTopic[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<SessionDuration>(30);

  // Session
  const [session, setSession] = useState<CheckSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overtimeTriggeredRef = useRef(false);

  // Reports
  const [pastReports, setPastReports] = useState<KnowledgeReport[]>(loadPastReports);
  const [viewingReport, setViewingReport] = useState<KnowledgeReport | null>(null);

  // Personality
  const [personality, setPersonality] = useState<PersonalityProfile | null>(() => {
    try { const r = localStorage.getItem('crosscheck-personality'); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const [personalityActive, setPersonalityActive] = useState(false);
  const [showPersonalitySetup, setShowPersonalitySetup] = useState(false);
  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPersonalityPopover, setShowPersonalityPopover] = useState(false);

  // Error log
  const [errorLog, setErrorLog] = useState<{ id: string; time: string; context: string; message: string }[]>([]);
  const [showErrorLog, setShowErrorLog] = useState(false);
  const [error, setError] = useState('');

  const logError = (context: string, err: any) => {
    const entry = {
      id: generateId(),
      time: new Date().toLocaleTimeString(),
      context,
      message: err?.message || String(err)
    };
    setErrorLog(prev => [entry, ...prev.slice(0, 49)]);
    console.error(`[${context}]`, err);
  };

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: any }) => { const sb = data.session;
      if (sb?.user) {
        setUser({ id: sb.user.id, username: sb.user.user_metadata?.username || sb.user.email?.split('@')[0] || 'User', email: sb.user.email || '', joinedAt: sb.user.created_at || '' });
        setAppState(AppState.IDLE);
      }
    });
  }, []);

  // Timer
  useEffect(() => {
    if (appState === AppState.SESSION_ACTIVE) {
      timerRef.current = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [appState]);

  // Overtime / time-up
  useEffect(() => {
    if (!session || appState !== AppState.SESSION_ACTIVE) return;
    const totalSeconds = session.duration * 60;
    if (elapsedSeconds >= totalSeconds && !overtimeTriggeredRef.current) {
      overtimeTriggeredRef.current = true;
      const hasWeakness = Object.values(session.topicPerformances).some(p => p.status === 'weak' || p.status === 'revisit');
      const hasUntested = session.topics.some(t => !session.topicPerformances[t.id]);
      if (hasWeakness || hasUntested) {
        setSession(prev => prev ? { ...prev, isOvertimeActive: true, status: 'overtime' } : prev);
      } else {
        handleEndSession();
      }
    }
  }, [elapsedSeconds, session, appState]);

  const handleAuth = (u: User) => { setUser(u); setAppState(AppState.IDLE); };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setSession(null); setNoteContent(''); setNoteTitle('');
    setExtractedTopics([]); setUploadedFile(null); setElapsedSeconds(0);
    overtimeTriggeredRef.current = false;
    setAppState(AppState.AUTH); setActiveScreen('home');
  };

  const processNotes = async (content: string, file?: File) => {
    setAppState(AppState.PROCESSING);
    setActiveScreen('setup');
    setError('');
    if (file) setUploadedFile(file);
    try {
      const { title, topics } = await extractTopicsFromNotes(content);
      setNoteContent(content); setNoteTitle(title); setExtractedTopics(topics);
      setAppState(AppState.SESSION_SETUP);
    } catch (e: any) {
      logError('processNotes', e);
      setError(e?.message || 'Failed to process notes.');
      setAppState(AppState.IDLE); setActiveScreen('home');
    }
  };

  const handleFileUpload = async (files: File | File[]) => {
    const fileList = Array.isArray(files) ? files : [files];
    const primary = fileList[0];
    setAppState(AppState.UPLOADING);
    setActiveScreen('setup');
    try {
      let content: string;
      const images = fileList.filter(f => f.type.startsWith('image/'));
      if (images.length > 0) {
        content = await extractTextFromImage(images.length === 1 ? images[0] : images);
      } else if (primary.type === 'application/pdf') {
        content = await extractTextFromPdf(primary);
      } else {
        content = await primary.text();
      }
      if (!content.trim()) throw new Error('No readable text found in file.');
      await processNotes(content, primary);
    } catch (e: any) {
      logError('fileUpload', e);
      setError(e?.message || 'Failed to read file.');
      setUploadedFile(null); setAppState(AppState.IDLE); setActiveScreen('home');
    }
  };

  const handleStartSession = useCallback(async () => {
    if (!extractedTopics.length) return;
    const newSession: CheckSession = {
      id: generateId(), uploadTitle: noteTitle, noteContent, topics: extractedTopics,
      messages: [], duration: selectedDuration, startTime: Date.now(),
      isOvertimeActive: false, topicPerformances: {}, status: 'active'
    };
    setSession(newSession); setElapsedSeconds(0);
    overtimeTriggeredRef.current = false;
    setIsAiThinking(true); setAppState(AppState.SESSION_ACTIVE); setActiveScreen('session');

    try {
      const turn = await runSessionTurn(newSession, null, 0, true, personalityActive ? personality ?? undefined : undefined);
      const aiMsg: QAMessage = { id: generateId(), role: 'ai', content: turn.message, topicId: turn.currentTopicId, tag: 'question', timestamp: Date.now() };
      setSession(prev => prev ? { ...prev, messages: [aiMsg] } : prev);
    } catch (e) {
      logError('startSession', e);
      setSession(prev => prev ? { ...prev, messages: [{ id: generateId(), role: 'ai', content: 'The audit is beginning. Walk me through the main topics covered in your notes.', timestamp: Date.now() }] } : prev);
    } finally { setIsAiThinking(false); }
  }, [extractedTopics, noteTitle, noteContent, selectedDuration]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!session || isAiThinking) return;
    const userMsg: QAMessage = { id: generateId(), role: 'user', content: text, timestamp: Date.now() };
    const updated = { ...session, messages: [...session.messages, userMsg] };
    setSession(updated); setIsAiThinking(true);

    try {
      const turn: SessionTurnResponse = await runSessionTurn(updated, text, elapsedSeconds, false, personalityActive ? personality ?? undefined : undefined);
      const aiMsg: QAMessage = { id: generateId(), role: 'ai', content: turn.message, topicId: turn.currentTopicId, tag: turn.isFollowUp ? 'followup' : 'question', timestamp: Date.now() };

      const newPerfs = { ...updated.topicPerformances };
      if (turn.topicUpdate) {
        const t = session.topics.find(t => t.id === turn.topicUpdate!.topicId);
        if (t) newPerfs[t.id] = { topicId: t.id, topicName: t.name, status: turn.topicUpdate.status as any, evidence: turn.topicUpdate.evidence, noteSection: t.noteSection, concepts: t.concepts };
      }

      const next: CheckSession = { ...updated, messages: [...updated.messages, aiMsg], topicPerformances: newPerfs };
      setSession(next);
      if (turn.sessionShouldEnd && !turn.overtimeNeeded) setTimeout(() => handleEndSession(next), 800);
    } catch (e) {
      logError('sendMessage', e);
      setSession(prev => prev ? { ...prev, messages: [...prev.messages, { id: generateId(), role: 'ai', content: 'Connection issue. Please try again.', timestamp: Date.now() }] } : prev);
    } finally { setIsAiThinking(false); }
  }, [session, isAiThinking, elapsedSeconds]);

  const handleEndSession = useCallback(async (override?: CheckSession) => {
    const active = override || session;
    if (!active) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const final: CheckSession = { ...active, endTime: Date.now(), status: 'complete' };
    setSession(final); setIsAiThinking(true);

    try {
      const report = await generateKnowledgeReport(final);
      setSession(prev => prev ? { ...prev, report } : prev);
      setViewingReport(report);
      const updated = [...pastReports, report];
      setPastReports(updated); savePastReports(updated);
    } catch (e) {
      logError('endSession/generateReport', e);
      const topics = final.topics.map(t => final.topicPerformances[t.id] || { topicId: t.id, topicName: t.name, status: 'untested' as const, evidence: 'Not covered.', concepts: t.concepts });
      const report: KnowledgeReport = { sessionId: final.id, date: new Date().toISOString(), uploadTitle: final.uploadTitle, durationMinutes: final.duration, actualDurationMinutes: Math.round((Date.now() - final.startTime) / 60000), topics, revisitList: topics.filter(t => t.status === 'weak' || t.status === 'revisit').flatMap(t => t.concepts.slice(0, 2).map(c => ({ concept: c, topicName: t.topicName }))), overtimeUsed: final.isOvertimeActive };
      setViewingReport(report);
      const updated = [...pastReports, report];
      setPastReports(updated); savePastReports(updated);
    } finally {
      setIsAiThinking(false);
      setAppState(AppState.REPORT); setActiveScreen('report');
    }
  }, [session, pastReports]);

  const handleNewSession = () => {
    setSession(null); setNoteContent(''); setNoteTitle(''); setExtractedTopics([]);
    setUploadedFile(null); setElapsedSeconds(0); overtimeTriggeredRef.current = false;
    setViewingReport(null); setAppState(AppState.IDLE); setActiveScreen('setup');
  };

  const handleStudyAgain = () => {
    // If we still have the notes from the last session, go straight to setup with them loaded
    // Otherwise navigate to setup for a fresh upload
    setSession(null); setElapsedSeconds(0); overtimeTriggeredRef.current = false;
    setViewingReport(null);
    if (noteContent && extractedTopics.length > 0) {
      setAppState(AppState.SESSION_SETUP); setActiveScreen('setup');
    } else {
      setAppState(AppState.IDLE); setActiveScreen('setup');
    }
  };

  const handleViewReport = (report: KnowledgeReport) => {
    setViewingReport(report); setActiveScreen('report');
  };

  const navigate = (screen: AppScreen) => {
    if (screen === 'session' && appState !== AppState.SESSION_ACTIVE) return;
    if (screen === 'report' && !viewingReport && appState !== AppState.REPORT) return;
    setActiveScreen(screen);
  };

  const handleSavePersonality = (profile: PersonalityProfile) => {
    setPersonality(profile);
    localStorage.setItem('crosscheck-personality', JSON.stringify(profile));
    setShowPersonalitySetup(false);
  };

  // AUTH
  if (appState === AppState.AUTH) {
    return <ThemeProvider><AuthView onAuth={handleAuth} /></ThemeProvider>;
  }

  const displayReport = viewingReport || (session?.report ?? null);

  return (
    <ThemeProvider>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--color-background-primary)', fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>

        {showPersonalitySetup && (
          <PersonalitySetup onSave={handleSavePersonality} onClose={() => setShowPersonalitySetup(false)} />
        )}

        {/* Nav */}
        <nav style={{ width: 200, borderRight: '0.5px solid var(--color-border-tertiary)', display: 'flex', flexDirection: 'column', background: 'var(--color-background-secondary)', flexShrink: 0 }}>
          <div style={{ padding: '18px 16px 14px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              <BrandMark size="md" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 5 }}>Knowledge audit</div>
          </div>

          {/* Personality icon */}
          {personality && (
            <div style={{ padding: '10px 16px 0', position: 'relative' }}>
              <div
                onClick={() => {
                  if (personalityActive) {
                    setPersonalityActive(false);
                    setShowPersonalityPopover(false);
                  } else {
                    const emailMatch = true; // TODO: restore email gate — const emailMatch = user?.email?.toLowerCase() === personality.authorizedEmail.toLowerCase();
                    if (!emailMatch) {
                      setPinError('not-authorized');
                      setShowPersonalityPopover(true);
                    } else {
                      setPinError('');
                      setPinInput('');
                      setShowPersonalityPopover(p => !p);
                    }
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 8px', borderRadius: 8, cursor: 'pointer',
                  background: personalityActive ? 'var(--color-background-primary)' : 'transparent',
                  border: personalityActive ? '0.5px solid var(--color-border-secondary)' : '0.5px solid transparent',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {personality.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -1, right: -1,
                    width: 9, height: 9, borderRadius: '50%',
                    background: personalityActive ? '#3B6D11' : 'var(--color-border-secondary)',
                    border: '1.5px solid var(--color-background-secondary)'
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>{personality.name}</div>
                  <div style={{ fontSize: 10, color: personalityActive ? '#3B6D11' : 'var(--color-text-tertiary)' }}>
                    {personalityActive ? 'Active' : 'Off'}
                  </div>
                </div>
              </div>

              {/* PIN / blocked popover */}
              {showPersonalityPopover && !personalityActive && (
                <div style={{
                  position: 'absolute', top: '100%', left: 16, right: 16, zIndex: 100,
                  background: 'var(--color-background-primary)',
                  border: '0.5px solid var(--color-border-secondary)',
                  borderRadius: 10, padding: '12px 12px 10px', marginTop: 4,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                  {pinError === 'not-authorized' ? (
                    <>
                      <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8, lineHeight: 1.4 }}>
                        This personality is locked to a specific account.
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setShowPersonalityPopover(false); setPinError(''); }} style={{ flex: 1, padding: '6px 0', fontSize: 11, background: 'none', border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Close</button>
                        <button onClick={() => { setPersonality(null); localStorage.removeItem('crosscheck-personality'); setShowPersonalityPopover(false); setPersonalityActive(false); setPinError(''); }} style={{ flex: 1, padding: '6px 0', fontSize: 11, background: 'none', border: '0.5px solid #3f1212', borderRadius: 5, cursor: 'pointer', color: '#f87171', fontFamily: 'var(--font-sans)' }}>Delete</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>Enter PIN to enable</div>
                      <input
                        type="password"
                        inputMode="numeric"
                        placeholder="PIN"
                        value={pinInput}
                        onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setPinError(''); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (pinInput === personality.pin) { setPersonalityActive(true); setShowPersonalityPopover(false); setPinInput(''); }
                            else { setPinError('Wrong PIN'); }
                          }
                        }}
                        autoFocus
                        style={{
                          width: '100%', padding: '8px 10px', fontSize: 13,
                          background: 'var(--color-background-secondary)',
                          border: `0.5px solid ${pinError ? '#f87171' : 'var(--color-border-secondary)'}`,
                          borderRadius: 6, outline: 'none', color: 'var(--color-text-primary)',
                          fontFamily: 'var(--font-sans)', letterSpacing: '0.15em'
                        }}
                      />
                      {pinError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>{pinError}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button onClick={() => { setShowPersonalityPopover(false); setPinInput(''); setPinError(''); }} style={{ flex: 1, padding: '6px 0', fontSize: 11, background: 'none', border: '0.5px solid var(--color-border-secondary)', borderRadius: 5, cursor: 'pointer', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                        <button onClick={() => {
                          if (pinInput === personality.pin) { setPersonalityActive(true); setShowPersonalityPopover(false); setPinInput(''); }
                          else { setPinError('Wrong PIN'); }
                        }} style={{ flex: 1, padding: '6px 0', fontSize: 11, background: 'var(--color-text-primary)', border: 'none', borderRadius: 5, cursor: 'pointer', color: 'var(--color-background-primary)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>Unlock</button>
                      </div>
                      <button onClick={() => { setPersonality(null); localStorage.removeItem('crosscheck-personality'); setShowPersonalityPopover(false); setPersonalityActive(false); }} style={{ marginTop: 8, width: '100%', padding: '5px 0', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                        Delete personality
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!personality && (
            <div style={{ padding: '10px 16px 0' }}>
              <button
                onClick={() => setShowPersonalitySetup(true)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 11,
                  background: 'none', border: '0.5px dashed var(--color-border-secondary)',
                  color: 'var(--color-text-tertiary)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <span style={{ fontSize: 14 }}>+</span> Create personality
              </button>
            </div>
          )}

          <div style={{ padding: '16px 10px 6px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 6px', marginBottom: 6 }}>Menu</div>
            {([
              { id: 'home', label: 'Home' },
              { id: 'setup', label: 'New session' },
              { id: 'session', label: 'Live session', disabled: appState !== AppState.SESSION_ACTIVE },
              { id: 'report', label: 'Reports', disabled: !displayReport }
            ] as const).map(item => {
              const isActive = activeScreen === item.id;
              const disabled = (item as any).disabled;
              return (
                <div
                  key={item.id}
                  onClick={() => !disabled && navigate(item.id as AppScreen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 10px', borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
                    fontSize: 13, marginBottom: 2,
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 500 : 400,
                    background: isActive ? 'var(--color-background-primary)' : 'transparent',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { if (!disabled && !isActive) e.currentTarget.style.background = 'var(--color-background-primary)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }}>{NAV_ICONS[item.id as keyof typeof NAV_ICONS]}</span>
                  {item.label}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '0.5px solid var(--color-border-tertiary)' }}>
            {/* Error log button */}
            {errorLog.length > 0 && (
              <div style={{ padding: '8px 10px 0' }}>
                <button onClick={() => setShowErrorLog(true)} style={{
                  width: '100%', padding: '6px 10px', borderRadius: 6, fontSize: 11,
                  background: '#1a0a0a', border: '0.5px solid #3f1212',
                  color: '#f87171', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span>Errors</span>
                  <span style={{ background: '#3f1212', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>{errorLog.length}</span>
                </button>
              </div>
            )}
            <div style={{ padding: '8px 10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }} onClick={handleLogout}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: 'var(--color-text-primary)', flexShrink: 0 }}>
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{user?.username || 'User'}</div>
              </div>
            </div>
          </div>
        </nav>

        {/* Error log overlay */}
        {showErrorLog && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 16 }} onClick={() => setShowErrorLog(false)}>
            <div style={{ width: 420, maxHeight: '70vh', background: '#0f0a0a', border: '0.5px solid #3f1212', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '0.5px solid #3f1212' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#f87171', fontFamily: 'var(--font-sans)' }}>Error log ({errorLog.length})</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setErrorLog([])} style={{ fontSize: 11, background: 'none', border: 'none', color: '#636366', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Clear</button>
                  <button onClick={() => setShowErrorLog(false)} style={{ fontSize: 11, background: 'none', border: 'none', color: '#636366', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Close</button>
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {errorLog.map(e => (
                  <div key={e.id} style={{ padding: '10px 16px', borderBottom: '0.5px solid #1a0a0a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: '#636366', fontFamily: 'var(--font-mono)' }}>{e.time}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#BA7517', background: '#1a1000', padding: '1px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>{e.context}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#f87171', fontFamily: 'var(--font-mono)', lineHeight: 1.5, wordBreak: 'break-word' }}>{e.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Topbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 48, borderBottom: '0.5px solid var(--color-border-tertiary)', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 0 }}>
              <BrandMark size="sm" />
              <span style={{ margin: '0 6px', color: 'var(--color-text-tertiary)' }}>—</span>
              <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{PAGE_NAMES[activeScreen]}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {activeScreen === 'session' && (
                <button onClick={() => handleEndSession()} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-danger)', border: '0.5px solid var(--color-border-danger)', fontFamily: 'var(--font-sans)' }}>
                  End session
                </button>
              )}
              {activeScreen === 'report' && (
                <button onClick={handleNewSession} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', border: '0.5px solid var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                  New session
                </button>
              )}
              {(activeScreen === 'home' || activeScreen === 'setup') && (
                <button onClick={() => { setActiveScreen('setup'); if (appState === AppState.IDLE) { setUploadedFile(null); setExtractedTopics([]); } }} style={{ padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', border: '0.5px solid var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>
                  Start new session
                </button>
              )}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ padding: '10px 20px', background: '#FEF2F2', borderBottom: '0.5px solid #FECACA', fontSize: 12, color: '#991B1B', display: 'flex', justifyContent: 'space-between' }}>
              {error}
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#991B1B' }}>✕</button>
            </div>
          )}

          {/* Content */}
          <div style={{
            flex: 1,
            overflowY: activeScreen === 'session' ? 'hidden' : 'auto',
            overflow: activeScreen === 'session' ? 'hidden' : undefined
          }}>
            {activeScreen === 'home' && (
              <HomeView
                pastReports={pastReports}
                onFileUpload={handleFileUpload}
                onViewReport={handleViewReport}
                onStartNewSession={() => setActiveScreen('setup')}
              />
            )}
            {activeScreen === 'setup' && (
              <SetupView
                appState={appState}
                uploadedFile={uploadedFile}
                noteTitle={noteTitle}
                extractedTopics={extractedTopics}
                selectedDuration={selectedDuration}
                onDurationChange={setSelectedDuration}
                onFileUpload={handleFileUpload}
                onBeginSession={handleStartSession}
              />
            )}
            {activeScreen === 'session' && session && (
              <div style={{ height: '100%' }}>
                {isAiThinking && session.messages.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, fontFamily: 'var(--font-sans)' }}>
                    <div style={{ width: 24, height: 24, border: '2px solid var(--color-border-tertiary)', borderTopColor: 'var(--color-text-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Starting audit…</span>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                ) : (
                  <SessionView
                    session={session}
                    elapsedSeconds={elapsedSeconds}
                    isAiThinking={isAiThinking}
                    onSendMessage={handleSendMessage}
                    personality={personality ?? undefined}
                    personalityActive={personalityActive}
                  />
                )}
              </div>
            )}
            {activeScreen === 'report' && displayReport && (
              <ReportView report={displayReport} onNewSession={handleNewSession} onStudyAgain={handleStudyAgain} />
            )}
            {activeScreen === 'report' && !displayReport && (
              <div style={{ padding: 24, fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>No report available yet.</div>
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
