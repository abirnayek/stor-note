import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { restoreFromCloud, setupRealtimeSync } from '../utils/syncEngine';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Restore data from cloud to local storage after successful login
        await restoreFromCloud();
        setupRealtimeSync();
        onLoginSuccess();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        alert('Account created successfully! Please check your email if confirmation is required, or simply log in.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)'
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.3)', padding: '2.5rem', borderRadius: '16px',
        width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>সামুদ্রিক মাছ</h1>
          <p style={{ opacity: 0.8 }}>Login to sync and backup your data securely in the cloud.</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,82,82,0.1)', color: '#ff5252', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid rgba(255,82,82,0.3)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.9 }}>Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '0.8rem', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.9 }}>Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              style={{
                width: '100%', padding: '0.8rem', borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)'
              }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%', padding: '1rem', marginTop: '1rem', borderRadius: '8px',
              background: 'var(--primary-color)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Sign Up')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Log In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
