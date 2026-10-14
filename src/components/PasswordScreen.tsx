import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Mail, KeyRound, ChevronLeft, ShieldAlert, CheckCircle, RefreshCw, Key } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { supabase } from '../utils/supabaseClient';

interface PasswordScreenProps {
  onSuccess: () => void;
  onBack: () => void;
  pinKey?: string;
  title?: string;
}

const PasswordScreen: React.FC<PasswordScreenProps> = ({
  onSuccess,
  onBack,
  pinKey = 'kenaHisabPin',
  title
}) => {
  const { t, language } = useLanguage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  
  // Stored PIN
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [isPasswordSet, setIsPasswordSet] = useState(false);

  // Setup mode (if no password is set yet)
  const [setupPin, setSetupPin] = useState('');
  const [confirmSetupPin, setConfirmSetupPin] = useState('');
  const [setupError, setSetupError] = useState('');

  // Recovery mode
  const [showForgot, setShowForgot] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [alertSent, setAlertSent] = useState(false);

  // Load existing PIN and email
  useEffect(() => {
    const rawStored = localStorage.getItem(pinKey);
    if (rawStored && rawStored.trim() !== '') {
      setStoredPin(rawStored.trim());
      setIsPasswordSet(true);
    } else {
      setStoredPin(null);
      setIsPasswordSet(false);
    }

    // Determine user email
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email || localStorage.getItem('userEmail') || 'atik20002218@gmail.com';
      setRecoveryEmail(email);
    });
  }, [pinKey]);

  // Send security alert email
  const triggerSecurityAlert = async (targetEmail: string) => {
    if (alertSent) return;
    setAlertSent(true);
    try {
      // Trigger Supabase OTP/Security notification email
      await supabase.auth.signInWithOtp({ email: targetEmail });
    } catch (e) {
      console.warn('Failed to send security alert email', e);
    }

    try {
      const alertLog = {
        type: 'failed_password_attempt',
        pinKey,
        title: title || 'Protected Section',
        time: new Date().toISOString()
      };
      localStorage.setItem(`sec_alert_${Date.now()}`, JSON.stringify(alertLog));
    } catch (e) {}
  };

  // Handle password submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordSet) return;

    if (password.trim() === storedPin) {
      setAttempts(0);
      setError('');
      onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= 3) {
        setError(
          language === 'bn' 
            ? `🚨 ৩ বার ভুল পাসওয়ার্ড দেওয়া হয়েছে! নিরাপত্তার জন্য আপনার ইমেইলে (${recoveryEmail}) সতর্কতা পাঠানো হয়েছে।`
            : `🚨 3 incorrect attempts! A security alert has been dispatched to your email (${recoveryEmail}).`
        );
        triggerSecurityAlert(recoveryEmail);
      } else {
        setError(
          language === 'bn'
            ? `ভুল পাসওয়ার্ড! আবার চেষ্টা করুন (${newAttempts}/৩ বার)`
            : `Incorrect password! Try again (${newAttempts}/3 attempts)`
        );
      }
      setPassword('');
    }
  };

  // Handle setting initial password (when no password was set)
  const handleInitialSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    if (setupPin.length < 4) {
      setSetupError(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৪ ডিজিট হতে হবে।' : 'Password must be at least 4 digits.');
      return;
    }
    if (setupPin !== confirmSetupPin) {
      setSetupError(language === 'bn' ? 'উভয় পাসওয়ার্ড হুবহু এক হতে হবে।' : 'Passwords do not match.');
      return;
    }

    localStorage.setItem(pinKey, setupPin.trim());
    setStoredPin(setupPin.trim());
    setIsPasswordSet(true);
    setAttempts(0);
    alert(language === 'bn' ? 'নতুন পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে!' : 'New password saved successfully!');
    onSuccess();
  };

  // Step 1: Send OTP for password recovery
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: recoveryEmail.trim()
      });
      if (error) throw error;
      setOtpStep('verify');
    } catch (err: any) {
      setOtpError(err.message || (language === 'bn' ? 'ওটিপি পাঠাতে সমস্যা হয়েছে, আবার চেষ্টা করুন।' : 'Failed to send OTP. Please try again.'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpLoading(true);
    setOtpError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: recoveryEmail.trim(),
        token: otpCode.trim(),
        type: 'email'
      });
      if (error) throw error;
      setOtpStep('reset');
    } catch (err: any) {
      setOtpError(err.message || (language === 'bn' ? 'ভুল ওটিপি কোড! অনুগ্রহ করে সঠিক কোড দিন।' : 'Invalid OTP code. Please enter the correct code.'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    if (newPin.length < 4) {
      setOtpError(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৪ ডিজিটের হতে হবে।' : 'Password must be at least 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setOtpError(language === 'bn' ? 'উভয় পাসওয়ার্ড হুবহু এক হতে হবে।' : 'Passwords do not match.');
      return;
    }

    localStorage.setItem(pinKey, newPin.trim());
    setStoredPin(newPin.trim());
    setIsPasswordSet(true);
    setShowForgot(false);
    setAttempts(0);
    setError('');
    alert(language === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! আপনি এখন প্রবেশ করতে পারবেন।' : 'Password successfully updated! You can now log in.');
    onSuccess();
  };

  // Render: Forgot Password / Recovery Flow
  if (showForgot) {
    return (
      <div className="password-screen">
        <div className="password-card" style={{ maxWidth: '440px' }}>
          <div className="login-card">
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(255, 152, 0, 0.15)',
                color: '#ff9800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <KeyRound size={32} />
              </div>
              <h2 style={{ fontSize: '1.3rem', margin: '0 0 6px 0', color: '#ffb74d' }}>
                {language === 'bn' ? 'পাসওয়ার্ড রিকভারি' : 'Password Recovery'}
              </h2>
              <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>
                {language === 'bn' 
                  ? 'আপনার ইমেইলে ওটিপি কোডের মাধ্যমে পাসওয়ার্ড রিসেট করুন' 
                  : 'Reset your password via OTP sent to your registered email'}
              </p>
            </div>

            {/* Step 1: Request OTP */}
            {otpStep === 'request' && (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={16} style={{ color: '#ff9800' }} /> {language === 'bn' ? 'রেজিস্টার্ড ইমেইল এড্রেস:' : 'Registered Email:'}
                  </div>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={e => { setRecoveryEmail(e.target.value); setOtpError(''); }}
                    required
                    className="login-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="email@example.com"
                  />
                </div>

                {otpError && (
                  <div className="error-message" style={{ color: '#ff5252', fontSize: '0.88rem' }}>
                    {otpError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpLoading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                >
                  {otpLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> {language === 'bn' ? 'পাঠানো হচ্ছে...' : 'Sending...'}
                    </>
                  ) : (
                    <>
                      <Mail size={18} /> {language === 'bn' ? 'ইমেইলে ওটিপি কোড পাঠান' : 'Send OTP to Email'}
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Step 2: Verify OTP */}
            {otpStep === 'verify' && (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  background: 'rgba(76, 175, 80, 0.1)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  color: '#81c784',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle size={18} />
                  <span>
                    {language === 'bn' 
                      ? `${recoveryEmail} ঠিকানায় ৬ সংখ্যার কোড পাঠানো হয়েছে।` 
                      : `A 6-digit code was sent to ${recoveryEmail}.`}
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#ccc' }}>
                    {language === 'bn' ? '৬ সংখ্যার ওটিপি কোড লিখুন:' : 'Enter 6-digit OTP Code:'}
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    placeholder="123456"
                    maxLength={6}
                    autoFocus
                    required
                    className="login-input"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      letterSpacing: '6px',
                      textAlign: 'center',
                      fontSize: '1.4rem',
                      fontWeight: 'bold',
                      padding: '0.75rem'
                    }}
                  />
                </div>

                {otpError && (
                  <div className="error-message" style={{ color: '#ff5252', fontSize: '0.88rem' }}>
                    {otpError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={otpLoading || otpCode.length < 6}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                >
                  {otpLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" /> {language === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Verifying...'}
                    </>
                  ) : (
                    <>
                      {language === 'bn' ? 'কোড যাচাই করুন' : 'Verify Code'} <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading}
                    className="text-btn"
                    style={{ fontSize: '0.85rem', color: '#ff9800', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {language === 'bn' ? 'পুনরায় ওটিপি পাঠান' : 'Resend OTP'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Set New PIN */}
            {otpStep === 'reset' && (
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{
                  background: 'rgba(76, 175, 80, 0.1)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  padding: '0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  color: '#81c784',
                  textAlign: 'center'
                }}>
                  {language === 'bn' ? 'পরিচয় সফলভাবে যাচাই হয়েছে! এবার নতুন পাসওয়ার্ড সেট করুন:' : 'Identity verified! Now set your new password:'}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#ccc' }}>
                    {language === 'bn' ? 'নতুন পাসওয়ার্ড (কমপক্ষে ৪ সংখ্যা)' : 'New Password (min 4 chars)'}
                  </label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={e => { setNewPin(e.target.value); setOtpError(''); }}
                    placeholder="••••"
                    required
                    autoFocus
                    className="login-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#ccc' }}>
                    {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm New Password'}
                  </label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={e => { setConfirmPin(e.target.value); setOtpError(''); }}
                    placeholder="••••"
                    required
                    className="login-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {otpError && (
                  <div className="error-message" style={{ color: '#ff5252', fontSize: '0.88rem' }}>
                    {otpError}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
                >
                  {language === 'bn' ? 'পাসওয়ার্ড সংরক্ষণ ও প্রবেশ করুন' : 'Save & Enter'} <ArrowRight size={18} />
                </button>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setShowForgot(false);
                  setOtpStep('request');
                  setOtpCode('');
                  setOtpError('');
                  setError('');
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <ChevronLeft size={16} /> {language === 'bn' ? 'লগইন পেজে ফিরুন' : 'Back to Login'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render: Setup Mode (If NO password was ever set for this section)
  if (!isPasswordSet) {
    return (
      <div className="password-screen">
        <div className="password-card" style={{ maxWidth: '440px' }}>
          <div className="password-header">
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 152, 0, 0.15)',
              color: '#ff9800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <Key size={32} />
            </div>
            <h2>{title || (language === 'bn' ? 'সুরক্ষিত হিসাব' : 'Protected Account')}</h2>
            <p style={{ color: '#ffb74d', fontWeight: 'bold', margin: '0.5rem 0' }}>
              {language === 'bn' 
                ? '🔒 এই সেকশনের জন্য কোনো পাসওয়ার্ড সেট করা নেই।' 
                : '🔒 No password is set for this section.'}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#aaa', margin: 0 }}>
              {language === 'bn'
                ? 'অননুমোদিত প্রবেশ রোধ করতে অনুগ্রহ করে ৪-৮ ডিজিটের একটি পাসওয়ার্ড সেট করুন (স্কিপ করার সুযোগ নেই)।'
                : 'Please set a 4-8 digit password to protect this section (Skipping is not allowed).'}
            </p>
          </div>

          <form onSubmit={handleInitialSetup} className="password-form" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#ccc' }}>
                {language === 'bn' ? 'নতুন পাসওয়ার্ড লিখুন:' : 'Enter New Password:'}
              </label>
              <input
                type="password"
                value={setupPin}
                onChange={e => { setSetupPin(e.target.value); setSetupError(''); }}
                placeholder="••••"
                required
                autoFocus
                className="password-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', color: '#ccc' }}>
                {language === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন:' : 'Confirm Password:'}
              </label>
              <input
                type="password"
                value={confirmSetupPin}
                onChange={e => { setConfirmSetupPin(e.target.value); setSetupError(''); }}
                placeholder="••••"
                required
                className="password-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {setupError && <span className="error-text" style={{ color: '#ff5252', fontSize: '0.88rem' }}>{setupError}</span>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onBack}
                style={{ flex: 1, padding: '0.85rem' }}
              >
                {t('backBtn') || 'ফিরে যান'}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, padding: '0.85rem', fontWeight: 'bold' }}
              >
                {language === 'bn' ? 'পাসওয়ার্ড সংরক্ষণ ও প্রবেশ' : 'Save & Enter'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render: Normal Password Entry Screen
  return (
    <div className="password-screen">
      <div className="password-card" style={{ maxWidth: '440px' }}>
        <div className="password-header">
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(0, 216, 255, 0.1)',
            color: 'var(--primary-color, #00d8ff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Lock size={32} />
          </div>
          <h2>{title || t('purchaseLogin')}</h2>
          <p style={{ color: '#bbb', margin: '0.4rem 0 0' }}>
            {t('enterPasswordMsg') || (language === 'bn' ? 'প্রবেশ করতে পাসওয়ার্ড দিন' : 'Enter password to continue')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="password-form" style={{ marginTop: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder={language === 'bn' ? 'পাসওয়ার্ড লিখুন...' : 'Enter password...'}
              className={`password-input ${error ? 'error' : ''}`}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem 1rem' }}
              autoFocus
              required
            />
          </div>

          {error && (
            <div style={{
              marginTop: '0.85rem',
              padding: '0.75rem',
              borderRadius: '8px',
              background: 'rgba(255, 82, 82, 0.15)',
              border: '1px solid rgba(255, 82, 82, 0.4)',
              color: '#ff8a80',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{error}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onBack}
              style={{ flex: 1, padding: '0.85rem' }}
            >
              {t('backBtn') || 'ফিরে যান'}
            </button>
            <button
              type="submit"
              className="btn btn-primary submit-btn"
              style={{ flex: 2, padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}
            >
              {t('enterBtn') || 'প্রবেশ করুন'} <ArrowRight size={18} />
            </button>
          </div>
        </form>

        <div className="password-actions" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button
            type="button"
            className="text-btn"
            onClick={() => setShowForgot(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#ff9800',
              fontSize: '0.9rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 12px'
            }}
          >
            <KeyRound size={16} /> {language === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন? ইমেইলে রিকভার করুন' : 'Forgot password? Recover via Email'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordScreen;
