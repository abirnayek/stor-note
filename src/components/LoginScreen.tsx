import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { restoreFromCloud, setupRealtimeSync } from '../utils/syncEngine';
import { CheckCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
      });
      if (error) throw error;
      setStep('code');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data: authData, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email'
      });
      if (error) throw error;
      
      // --- Device Tracking ---
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('device_id', deviceId);
      }
      const deviceName = navigator.userAgent;

      if (authData?.user) {
        // Check if there are any admins in the system
        const { count } = await supabase
          .from('active_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('permission', 'admin').eq('status', 'active');
          
        const isFirstDevice = count === 0;
        const initialPermission = isFirstDevice ? 'admin' : 'view';

        await supabase.from('active_sessions').upsert({
          device_id: deviceId,
          user_id: authData.user.id,
          device_name: deviceName,
          status: 'active',
          permission: initialPermission,
          last_active: new Date().toISOString()
        }, { onConflict: 'device_id' });
        
        localStorage.setItem('device_permission', initialPermission);
      }
      // --- End Device Tracking ---

      // Restore data from cloud to local storage after successful login
      await restoreFromCloud();
      setupRealtimeSync();
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid verification code.');
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

        {step === 'email' ? (
          <form onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%', padding: '1rem', marginTop: '1rem', borderRadius: '8px',
                background: 'var(--primary-color)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Sending Link...' : 'Send Magic Link'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: '#72be44', marginBottom: '1rem' }}>
                <CheckCircle size={48} />
              </div>
              <h3 style={{ marginBottom: '0.5rem' }}>ইমেইল চেক করুন!</h3>
              <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                আমরা <strong>{email}</strong> ঠিকানায় একটি লগইন কোড পাঠিয়েছি।
              </p>
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', opacity: 0.9 }}>লগইন কোড</label>
              <input 
                type="text" 
                required 
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="12345678"
                style={{
                  width: '100%', padding: '0.8rem', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                  textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem'
                }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%', padding: '1rem', marginTop: '0.5rem', borderRadius: '8px',
                background: 'var(--primary-color)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => setStep('email')}
              style={{ 
                background: 'transparent', border: '1px solid var(--primary-color)', 
                color: 'var(--primary-color)', cursor: 'pointer', padding: '0.8rem', 
                borderRadius: '8px', marginTop: '0.5rem'
              }}
            >
              অন্য ইমেইল দিয়ে চেষ্টা করুন
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;

