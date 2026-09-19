import React, { useState } from 'react';
import { Lock, ArrowRight, Phone, Mail, KeyRound, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface PasswordScreenProps {
  onSuccess: () => void;
  onBack: () => void;
  pinKey?: string;
  title?: string;
}

const RECOVERY_PHONE = '01568387047';
const RECOVERY_EMAIL = 'abirailmail@gmail.com';

const PasswordScreen: React.FC<PasswordScreenProps> = ({
  onSuccess,
  onBack,
  pinKey = 'kenaHisabPin',
  title
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const { t } = useLanguage();

  const storedPin = localStorage.getItem(pinKey) || '1234';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === storedPin) {
      setAttempts(0);
      onSuccess();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setError(t('wrongPassword3'));
      } else {
        setError(`${t('wrongPasswordAttempt')} ${newAttempts}/3)`);
      }
      setPassword('');
    }
  };

  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = recoveryInput.trim().toLowerCase();
    if (cleaned === RECOVERY_PHONE || cleaned === RECOVERY_EMAIL.toLowerCase()) {
      setShowResetForm(true);
      setRecoveryError('');
      setRecoveryError(t('phoneEmailMismatch'));
    }
  };

  const handleResetPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setRecoveryError(t('passwordLengthMsg'));
      return;
    }
    if (newPin !== confirmPin) {
      setRecoveryError(t('passwordsMismatch'));
      return;
    }
    localStorage.setItem(pinKey, newPin);
    setResetSuccess(true);
  };

  if (showForgot) {
    if (resetSuccess) {
      return (
        <div className="password-screen">
          <div className="password-card" style={{ textAlign: 'center' }}>
            <div className="login-card" style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--primary-color)' }}>{t('passwordChanged')}</h2>
              <p style={{ color: '#aaa', marginTop: '0.5rem' }}>{t('loginWithNew')}</p>
              
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowForgot(false);
                  setResetSuccess(false);
                  setAttempts(0);
                  setError('');
                  setPassword('');
                }}
                style={{ marginTop: '2rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
              >
                <ChevronLeft size={18} /> {t('backToLogin')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="password-screen">
        <div className="password-card">
          <div className="login-card">
            <h2>{t('passwordRecovery')}</h2>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>{t('enterPhoneEmail')}</p>

            <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
                <Phone size={14} /> 01568387047
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail size={14} /> abirailmail@gmail.com
              </div>
            </div>

            {!showResetForm ? (
              <form onSubmit={handleRecoverySubmit} style={{ marginTop: '2rem' }}>
                <input
                  type="text"
                  value={recoveryInput}
                  onChange={e => { setRecoveryInput(e.target.value); setRecoveryError(''); }}
                  placeholder={t('enterPhoneEmailPlaceholder')}
                  className={`login-input ${recoveryError ? 'error' : ''}`}
                  style={{ marginBottom: '1rem' }}
                  autoFocus
                />
                
                {recoveryError && <div className="error-message">{recoveryError}</div>}
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {t('verifyBtn')} <ArrowRight size={18} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPin} style={{ marginTop: '2rem' }}>
                <p style={{ color: 'var(--primary-color)', marginBottom: '1rem', textAlign: 'center' }}>{t('identityVerified')}</p>
                
                <input
                  type="password"
                  value={newPin}
                  onChange={e => { setNewPin(e.target.value); setRecoveryError(''); }}
                  placeholder={t('newPassword')}
                  className={`login-input ${recoveryError ? 'error' : ''}`}
                  style={{ marginBottom: '1rem' }}
                  autoFocus
                />
                
                <input
                  type="password"
                  value={confirmPin}
                  onChange={e => { setConfirmPin(e.target.value); setRecoveryError(''); }}
                  placeholder={t('confirmPassword')}
                  className={`login-input ${recoveryError ? 'error' : ''}`}
                  style={{ marginBottom: '1rem' }}
                />
                
                {recoveryError && <div className="error-message">{recoveryError}</div>}
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                  {t('setPasswordBtn')} <ArrowRight size={18} />
                </button>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="text-btn" onClick={() => { setShowForgot(false); setShowResetForm(false); setRecoveryInput(''); setRecoveryError(''); }}>
                <ChevronLeft size={14} /> {t('backToLogin')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="password-screen">
      <div className="password-card">
        <div className="password-header">
          <Lock size={48} className="lock-icon" />
          <h2>{title || t('purchaseLogin')}</h2>
          <p>{t('enterPasswordMsg')}</p>
        </div>

        <form onSubmit={handleSubmit} className="password-form">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder={t('passwordPlaceholder')}
            className={`password-input ${error ? 'error' : ''}`}
            autoFocus
          />
          {error && <span className="error-text">{error}</span>}
          <button type="submit" className="btn btn-primary submit-btn">
            {t('enterBtn')} <ArrowRight size={18} />
          </button>
        </form>

        <div className="password-actions">
          {attempts >= 3 && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button className="text-btn" onClick={() => setShowForgot(true)}>
                <KeyRound size={14} /> {t('forgotPassPrompt')}
              </button>
            </div>
          )}
          <button className="btn-text" onClick={onBack}>
            {t('backBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordScreen;

