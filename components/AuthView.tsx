
import React, { useState, useEffect, CSSProperties } from 'react';
import { CheckSquare, Mail, Lock, User as UserIcon, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';

interface AuthViewProps {
  onAuth: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuth }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        const u = data.session.user;
        onAuth({ id: u.id, username: u.user_metadata?.username || u.email?.split('@')[0] || 'User', email: u.email || '', joinedAt: u.created_at || new Date().toISOString() } as any);
      }
    });
  }, [onAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) {
          setErrorMsg(error.message.includes('Invalid login credentials') ? 'Wrong email or password.' : error.message);
          return;
        }
        if (data.user) {
          onAuth({ id: data.user.id, username: data.user.user_metadata?.username || formData.email.split('@')[0], email: data.user.email || formData.email, joinedAt: data.user.created_at || new Date().toISOString() } as any);
        }
      } else {
        if (formData.password.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return; }
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { username: formData.username } }
        });
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already exists')) {
            setErrorMsg('An account with this email already exists.');
          } else if (error.message.includes('rate limit') || error.message.includes('429')) {
            setErrorMsg('Too many attempts. Try again in a few minutes.');
          } else {
            setErrorMsg(error.message);
          }
          return;
        }
        if (data.user) {
          onAuth({ id: data.user.id, username: formData.username || formData.email.split('@')[0], email: formData.email, joinedAt: data.user.created_at || new Date().toISOString() } as any);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: CSSProperties = {
    width: '100%', padding: '12px 12px 12px 44px',
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10, outline: 'none',
    fontSize: 14, color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)'
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--color-background-primary)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 400, width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 12, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', marginBottom: 16 }}>
            <CheckSquare size={24} style={{ color: 'var(--color-text-primary)' }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>CrossCheck</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>Find out what you actually know</div>
        </div>

        <div style={{ background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 16, padding: '28px 28px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 20 }}>
            {isLogin ? 'Sign in' : 'Create account'}
          </div>

          {errorMsg && (
            <div style={{ marginBottom: 16, padding: '10px 12px', background: '#1a0a0a', border: '0.5px solid #3f1212', borderRadius: 8, fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!isLogin && (
              <div style={{ position: 'relative' }}>
                <UserIcon size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                <input type="text" placeholder="Full name" required style={inputStyle}
                  value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}
                  onFocus={e => (e.target.style.borderColor = 'var(--color-border-primary)')}
                  onBlur={e => (e.target.style.borderColor = 'var(--color-border-secondary)')} />
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input type="email" placeholder="Email address" required style={inputStyle}
                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                onFocus={e => (e.target.style.borderColor = 'var(--color-border-primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border-secondary)')} />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input type="password" placeholder="Password" required style={inputStyle}
                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                onFocus={e => (e.target.style.borderColor = 'var(--color-border-primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--color-border-secondary)')} />
            </div>

            <button disabled={loading} style={{ marginTop: 4, padding: '11px 0', background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'var(--font-sans)' }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <>{isLogin ? 'Sign in' : 'Create account'} <ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: '0.5px solid var(--color-border-tertiary)', textAlign: 'center' }}>
            <button onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}>
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
