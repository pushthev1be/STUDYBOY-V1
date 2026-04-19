
import React, { useState, useRef, useEffect } from 'react';
import { CheckSession, TopicStatus } from '../types';

interface Props {
  session: CheckSession;
  elapsedSeconds: number;
  isAiThinking: boolean;
  onSendMessage: (text: string) => void;
}

const DOT_COLOR: Record<TopicStatus, string> = {
  strong: '#3B6D11',
  weak: '#BA7517',
  revisit: '#BA7517',
  untested: 'var(--color-border-secondary)'
};

const STATUS_ICON: Record<TopicStatus, string> = {
  strong: '✓',
  weak: '⚠',
  revisit: '⚠',
  untested: ''
};

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function SessionView({ session, elapsedSeconds, isAiThinking, onSendMessage }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const totalSeconds = session.duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const isOvertime = session.isOvertimeActive;

  const coveredCount = Object.keys(session.topicPerformances).length;
  const totalCount = session.topics.length;

  const currentTopicId = [...session.messages].reverse().find(m => m.role === 'ai' && m.topicId)?.topicId;
  const currentTopic = session.topics.find(t => t.id === currentTopicId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, isAiThinking]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isAiThinking) return;
    setInput('');
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const words = wordCount(input);

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'var(--font-sans)' }}>

      {/* Sidebar */}
      <div style={{
        width: 170,
        borderRight: '0.5px solid var(--color-border-tertiary)',
        padding: '16px 12px',
        overflowY: 'auto',
        flexShrink: 0
      }}>
        <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Topics
        </div>
        {session.topics.map(topic => {
          const perf = session.topicPerformances[topic.id];
          const status: TopicStatus = perf ? perf.status as TopicStatus : 'untested';
          const isActive = topic.id === currentTopicId;
          return (
            <div key={topic.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 8px', borderRadius: 6, marginBottom: 3,
              background: isActive ? 'var(--color-background-secondary)' : 'transparent'
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: isActive ? 'var(--color-text-primary)' : DOT_COLOR[status]
              }} />
              <div style={{
                fontSize: 12, lineHeight: 1.3, flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: isActive ? 500 : 400
              }}>
                {topic.name}
              </div>
              {!isActive && STATUS_ICON[status] && (
                <span style={{ fontSize: 11, flexShrink: 0 }}>{STATUS_ICON[status]}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Chat bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--color-border-tertiary)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentTopic && (
              <span style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 4,
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                color: 'var(--color-text-secondary)'
              }}>
                {currentTopic.name}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              <span style={{ width: 70, height: 3, background: 'var(--color-border-tertiary)', borderRadius: 2, overflow: 'hidden', display: 'inline-block' }}>
                <span style={{ display: 'block', height: '100%', background: 'var(--color-text-primary)', width: `${totalCount > 0 ? (coveredCount / totalCount) * 100 : 0}%`, borderRadius: 2 }} />
              </span>
              {coveredCount} of {totalCount}
            </span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-mono)',
            color: isOvertime ? 'var(--color-text-danger)' : 'var(--color-text-secondary)',
            background: 'var(--color-background-secondary)',
            border: isOvertime ? '0.5px solid var(--color-border-danger)' : '0.5px solid var(--color-border-tertiary)',
            padding: '4px 10px', borderRadius: 6
          }}>
            {isOvertime ? 'OVERTIME' : formatTime(remainingSeconds)}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {session.messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isUser ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 27, height: 27, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 500, flexShrink: 0,
                  border: isUser ? 'none' : '0.5px solid var(--color-border-tertiary)',
                  background: isUser ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
                  color: isUser ? 'var(--color-background-primary)' : 'var(--color-text-primary)'
                }}>
                  {isUser ? 'U' : 'CC'}
                </div>
                <div style={{ maxWidth: '76%' }}>
                  <div style={{
                    fontSize: 10, color: 'var(--color-text-tertiary)',
                    fontWeight: 500, letterSpacing: '0.04em', marginBottom: 4,
                    textAlign: isUser ? 'right' : 'left'
                  }}>
                    {isUser ? 'You' : 'Cross Check'}
                  </div>
                  {!isUser && msg.tag && (
                    <div style={{
                      display: 'inline-block', fontSize: 10, fontWeight: 500,
                      padding: '2px 7px', borderRadius: 4, marginBottom: 5,
                      ...(msg.tag === 'question'
                        ? { background: '#E6F1FB', color: '#0C447C' }
                        : { background: '#FAEEDA', color: '#633806' })
                    }}>
                      {msg.tag === 'question' ? 'Question' : 'Follow-up'}
                    </div>
                  )}
                  <div style={{
                    fontSize: 13, lineHeight: 1.6,
                    color: 'var(--color-text-primary)',
                    background: isUser ? 'var(--color-background-primary)' : 'var(--color-background-secondary)',
                    border: '0.5px solid var(--color-border-tertiary)',
                    borderRadius: 10, padding: '10px 13px'
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}

          {isAiThinking && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                width: 27, height: 27, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 500, flexShrink: 0,
                border: '0.5px solid var(--color-border-tertiary)',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-primary)'
              }}>CC</div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 500, letterSpacing: '0.04em', marginBottom: 4 }}>Cross Check</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '10px 13px',
                  background: 'var(--color-background-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  borderRadius: 10, width: 'fit-content'
                }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span key={i} style={{
                      width: 5, height: 5, background: 'var(--color-text-tertiary)',
                      borderRadius: '50%', display: 'inline-block',
                      animation: `cc-bounce 1.2s ${delay}s infinite`
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{
          borderTop: '0.5px solid var(--color-border-tertiary)',
          padding: '12px 16px', flexShrink: 0
        }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 7 }}>
            Answer in full sentences — explain your reasoning, not just the fact
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAiThinking}
              placeholder="Type your answer…"
              style={{
                flex: 1, resize: 'none', fontSize: 13,
                fontFamily: 'var(--font-sans)', lineHeight: 1.5,
                padding: '9px 12px',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 8,
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
                height: 60, outline: 'none',
                opacity: isAiThinking ? 0.5 : 1
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-border-primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border-secondary)')}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isAiThinking}
              style={{
                padding: '0 14px', height: 38, borderRadius: 8,
                background: 'var(--color-text-primary)',
                color: 'var(--color-background-primary)',
                fontSize: 12, fontWeight: 500,
                cursor: input.trim() && !isAiThinking ? 'pointer' : 'not-allowed',
                opacity: input.trim() && !isAiThinking ? 1 : 0.4,
                border: 'none', fontFamily: 'var(--font-sans)'
              }}
            >
              Send
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {words} word{words !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Full sentences only</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cc-bounce {
          0%,60%,100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
