import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock, Trash2, ArrowLeft, Shield, Edit2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  onClose: () => void;
}

interface AccountItem {
  id: string;
  nameBn: string;
  nameEn: string;
  storageKey: string;
  category: 'account' | 'lot';
}

export const LotPasswordManager: React.FC<Props> = ({ onClose }) => {
  const { language } = useLanguage();
  const isBn = language === 'bn';

  const [activeTab, setActiveTab] = useState<'accounts' | 'sales' | 'buy'>('accounts');
  
  const [salesLots, setSalesLots] = useState<number[]>([]);
  const [buyLots, setBuyLots] = useState<number[]>([]);
  
  // Modal states for setting/changing PIN
  const [editingTarget, setEditingTarget] = useState<{
    key: string;
    title: string;
    currentValue: string;
  } | null>(null);
  const [inputPin, setInputPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot password / reset via admin OTP
  const [forgotTarget, setForgotTarget] = useState<{
    key: string;
    title: string;
  } | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Force re-render key
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    loadData();
  }, [renderCount]);

  const loadData = () => {
    try {
      const sLots = localStorage.getItem('sales_lots_list');
      if (sLots) {
        const parsed = JSON.parse(sLots);
        if (Array.isArray(parsed)) setSalesLots(parsed.sort((a: number, b: number) => a - b));
      }
      
      const bLots = localStorage.getItem('purchase_lots_list');
      if (bLots) {
        const parsed = JSON.parse(bLots);
        if (Array.isArray(parsed)) setBuyLots(parsed.sort((a: number, b: number) => a - b));
      }
    } catch (e) {
      console.error('Failed to parse lots', e);
    }
  };

  const mainAccounts: AccountItem[] = [
    {
      id: 'sales',
      nameBn: 'বিক্রয় হিসাব',
      nameEn: 'Sales Account',
      storageKey: 'salesAccountPin',
      category: 'account'
    },
    {
      id: 'due',
      nameBn: 'বকেয়া হিসাব',
      nameEn: 'Due Account',
      storageKey: 'dueAccountPin',
      category: 'account'
    },
    {
      id: 'purchase',
      nameBn: 'ক্রয় হিসাব',
      nameEn: 'Purchase Account',
      storageKey: 'kenaHisabPin',
      category: 'account'
    },
    {
      id: 'reseller',
      nameBn: 'রিসেলার হিসাব',
      nameEn: 'Reseller Account',
      storageKey: 'resellerPin',
      category: 'account'
    },
    {
      id: 'investor',
      nameBn: 'ইনভেস্টর হিসাব',
      nameEn: 'Investor Account',
      storageKey: 'investorPin',
      category: 'account'
    },
    {
      id: 'stock',
      nameBn: 'স্টক হিসাব',
      nameEn: 'Stock Account',
      storageKey: 'stockAccountPin',
      category: 'account'
    }
  ];

  const getPassword = (key: string): string | null => {
    const val = localStorage.getItem(key);
    return val && val.trim() !== '' ? val.trim() : null;
  };

  const handleOpenEdit = (key: string, title: string) => {
    const curr = getPassword(key) || '';
    setEditingTarget({ key, title, currentValue: curr });
    setInputPin(curr);
    setConfirmPin(curr);
    setErrorMsg('');
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;

    const trimmed = inputPin.trim();
    if (trimmed !== '') {
      if (trimmed !== confirmPin.trim()) {
        setErrorMsg(isBn ? 'পাসওয়ার্ড দুটি মিলেনি!' : 'Passwords do not match!');
        return;
      }
      localStorage.setItem(editingTarget.key, trimmed);
    } else {
      localStorage.removeItem(editingTarget.key);
    }

    setEditingTarget(null);
    setInputPin('');
    setConfirmPin('');
    setErrorMsg('');
    setRenderCount(c => c + 1);
  };

  const handleRemovePin = (key: string, title: string) => {
    const confirmText = isBn 
      ? `আপনি কি নিশ্চিত যে "${title}" এর পাসওয়ার্ড মুছে ফেলতে (Remove) চান?`
      : `Are you sure you want to remove the password for "${title}"?`;
    if (window.confirm(confirmText)) {
      localStorage.removeItem(key);
      setRenderCount(c => c + 1);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setForgotError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: adminEmail
      });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setForgotError('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: adminEmail,
        token: otp,
        type: 'email'
      });
      if (error) throw error;
      
      if (forgotTarget) {
        localStorage.removeItem(forgotTarget.key);
        alert(isBn ? `"${forgotTarget.title}" এর পাসওয়ার্ড সফলভাবে রিমুভ করা হয়েছে!` : `Password removed successfully!`);
        setForgotTarget(null);
        setOtpSent(false);
        setOtp('');
        setAdminEmail('');
        setRenderCount(c => c + 1);
      }
    } catch (err: any) {
      setForgotError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', color: '#fff', maxWidth: '600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Shield size={22} color="#4ade80" /> 
          {isBn ? 'পাসওয়ার্ড ম্যানেজমেন্ট' : 'Password Management'}
        </h2>
        <button onClick={onClose} className="btn-icon" style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: '#fff' }}>
          <X size={22} />
        </button>
      </div>

      {/* Forgot Password Reset Modal */}
      {forgotTarget ? (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button className="btn-icon" onClick={() => { setForgotTarget(null); setOtpSent(false); }} title="Back" style={{ padding: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {isBn ? 'পাসওয়ার্ড রিসেট' : 'Password Reset'} — {forgotTarget.title}
            </h3>
          </div>
          
          {forgotError && (
            <div style={{ background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', color: '#ffb4b4', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.88rem' }}>
              {forgotError}
            </div>
          )}
          
          {!otpSent ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.9 }}>
                  {isBn ? 'অ্যাডমিন ইমেইল' : 'Admin Email'}
                </label>
                <input 
                  type="email" 
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  placeholder="admin@gmail.com"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                {loading ? (isBn ? 'কোড পাঠানো হচ্ছে...' : 'Sending...') : (isBn ? 'ভেরিফিকেশন কোড পাঠান' : 'Send Verification Code')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(76, 175, 80, 0.15)', border: '1px solid rgba(76, 175, 80, 0.4)', padding: '0.75rem', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.85rem', margin: 0, color: '#a5d6a7' }}>
                  {isBn ? `৬-সংখ্যার কোড পাঠানো হয়েছে: ` : `6-digit code sent to: `}<strong>{adminEmail}</strong>
                </p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', opacity: 0.9 }}>
                  {isBn ? '৬ সংখ্যার কোড লিখুন' : 'Enter 6-Digit Code'}
                </label>
                <input 
                  type="text" 
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '4px', textAlign: 'center', fontSize: '1.2rem', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  placeholder="------"
                  maxLength={6}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                {loading ? (isBn ? 'যাচাই করা হচ্ছে...' : 'Verifying...') : (isBn ? 'যাচাই করুন ও পাসওয়ার্ড রিমুভ করুন' : 'Verify & Remove')}
              </button>
            </form>
          )}
        </div>
      ) : editingTarget ? (
        /* Edit / Set PIN Modal */
        <div style={{ background: 'rgba(0,0,0,0.35)', padding: '1.5rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button className="btn-icon" onClick={() => setEditingTarget(null)} title="Back" style={{ padding: 0, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <ArrowLeft size={20} />
            </button>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {isBn ? 'পাসওয়ার্ড সেট / পরিবর্তন' : 'Set / Change Password'} — <span style={{ color: '#4ade80' }}>{editingTarget.title}</span>
            </h3>
          </div>

          {errorMsg && (
            <div style={{ background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', color: '#ffb4b4', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', opacity: 0.9 }}>
                {isBn ? 'নতুন পাসওয়ার্ড (ফাঁকা রাখলে পাসওয়ার্ড রিমুভ হবে)' : 'New Password (Leave empty to remove)'}
              </label>
              <input 
                type="text" 
                value={inputPin}
                onChange={e => setInputPin(e.target.value)}
                className="supplier-input"
                style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                placeholder={isBn ? 'পাসওয়ার্ড লিখুন...' : 'Enter password...'}
                autoFocus
              />
            </div>

            {inputPin.trim() !== '' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', opacity: 0.9 }}>
                  {isBn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                </label>
                <input 
                  type="text" 
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                  placeholder={isBn ? 'একই পাসওয়ার্ড আবার লিখুন...' : 'Re-enter password...'}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setEditingTarget(null)}
                style={{ flex: 1, padding: '0.65rem' }}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flex: 1, padding: '0.65rem', fontWeight: 'bold' }}
              >
                {inputPin.trim() === '' 
                  ? (isBn ? 'পাসওয়ার্ড মুছুন (Remove)' : 'Remove Password') 
                  : (isBn ? 'সংরক্ষণ করুন (Save)' : 'Save Password')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main View with Tabs */
        <>
          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '8px' }}>
            <button 
              className={`btn ${activeTab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('accounts')}
              style={{ flex: 1, padding: '0.6rem 0.4rem', fontSize: '0.9rem', borderRadius: '6px' }}
            >
              {isBn ? 'হিসাবসমূহ (Accounts)' : 'Main Accounts'}
            </button>
            <button 
              className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('sales')}
              style={{ flex: 1, padding: '0.6rem 0.4rem', fontSize: '0.9rem', borderRadius: '6px' }}
            >
              {isBn ? 'বিক্রয় লট' : 'Sales Lots'} ({salesLots.length})
            </button>
            <button 
              className={`btn ${activeTab === 'buy' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('buy')}
              style={{ flex: 1, padding: '0.6rem 0.4rem', fontSize: '0.9rem', borderRadius: '6px' }}
            >
              {isBn ? 'ক্রয় লট' : 'Purchase Lots'} ({buyLots.length})
            </button>
          </div>

          {/* List Content */}
          <div style={{ maxHeight: '380px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.5rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            
            {/* TAB 1: Main Accounts */}
            {activeTab === 'accounts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {mainAccounts.map(acc => {
                  const hasPw = !!getPassword(acc.storageKey);
                  const title = isBn ? acc.nameBn : acc.nameEn;
                  return (
                    <div 
                      key={acc.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '0.85rem 1rem', 
                        background: 'rgba(255,255,255,0.04)', 
                        borderRadius: '6px',
                        borderLeft: hasPw ? '4px solid #ff9800' : '4px solid #4ade80'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {hasPw ? <Lock size={16} color="#ff9800" /> : <Unlock size={16} color="#4ade80" />}
                          <span>{title}</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', marginTop: '3px', color: hasPw ? '#ffb74d' : '#81c784' }}>
                          {hasPw ? (isBn ? '● পাসওয়ার্ড চালু আছে' : '● Password Protected') : (isBn ? '○ পাসওয়ার্ড নাই' : '○ No Password')}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {hasPw && (
                          <button
                            onClick={() => setForgotTarget({ key: acc.storageKey, title })}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: '#ff9800', 
                              fontSize: '0.8rem', 
                              cursor: 'pointer', 
                              textDecoration: 'underline',
                              padding: '0.2rem 0.4rem'
                            }}
                          >
                            {isBn ? 'ভুলে গেছেন?' : 'Forgot?'}
                          </button>
                        )}

                        <button 
                          className="btn btn-secondary" 
                          onClick={() => handleOpenEdit(acc.storageKey, title)}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Edit2 size={13} />
                          {hasPw ? (isBn ? 'পরিবর্তন' : 'Change') : (isBn ? 'পাসওয়ার্ড দিন' : 'Set PIN')}
                        </button>

                        {hasPw && (
                          <button 
                            className="btn-icon" 
                            onClick={() => handleRemovePin(acc.storageKey, title)} 
                            title={isBn ? 'পাসওয়ার্ড রিমুভ করুন' : 'Remove Password'} 
                            style={{ color: '#f44336', background: 'rgba(244,67,54,0.1)', padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2 & 3: Lots */}
            {(activeTab === 'sales' || activeTab === 'buy') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(activeTab === 'sales' ? salesLots : buyLots).length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6, fontSize: '0.9rem' }}>
                    {isBn ? 'কোন লট পাওয়া যায়নি' : 'No lots found'}
                  </div>
                ) : (
                  (activeTab === 'sales' ? salesLots : buyLots).map(lot => {
                    const key = activeTab === 'sales' ? `sales_lot_password_${lot}` : `lot_password_${lot}`;
                    const title = activeTab === 'sales' 
                      ? (isBn ? `বিক্রয় লট: ${lot}` : `Sales Lot ${lot}`)
                      : (isBn ? `ক্রয় লট: ${lot}` : `Purchase Lot ${lot}`);
                    const hasPw = !!getPassword(key);

                    return (
                      <div 
                        key={lot} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '0.75rem 1rem', 
                          background: 'rgba(255,255,255,0.04)', 
                          borderRadius: '6px',
                          borderLeft: hasPw ? '4px solid #ff9800' : '4px solid rgba(255,255,255,0.2)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          {hasPw ? <Lock size={16} color="#ff9800" /> : <Unlock size={16} color="#888" />}
                          <div>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{title}</span>
                            <div style={{ fontSize: '0.75rem', color: hasPw ? '#ffb74d' : '#888' }}>
                              {hasPw ? (isBn ? 'পাসওয়ার্ড আছে' : 'Password Set') : (isBn ? 'পাসওয়ার্ড নাই' : 'No Password')}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {hasPw && (
                            <button
                              onClick={() => setForgotTarget({ key, title })}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: '#ff9800', 
                                fontSize: '0.8rem', 
                                cursor: 'pointer', 
                                textDecoration: 'underline',
                                padding: '0.2rem 0.4rem'
                              }}
                            >
                              {isBn ? 'ভুলে গেছেন?' : 'Forgot?'}
                            </button>
                          )}

                          <button 
                            className="btn btn-secondary" 
                            onClick={() => handleOpenEdit(key, title)}
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                          >
                            {hasPw ? (isBn ? 'পরিবর্তন' : 'Change') : (isBn ? 'পাসওয়ার্ড দিন' : 'Set PIN')}
                          </button>

                          {hasPw && (
                            <button 
                              className="btn-icon" 
                              onClick={() => handleRemovePin(key, title)} 
                              title={isBn ? 'পাসওয়ার্ড মুছুন' : 'Remove Password'} 
                              style={{ color: '#f44336', background: 'rgba(244,67,54,0.1)', padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
          
          {/* Global Password Bypass Toggle */}
          <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  {isBn ? 'গ্লোবাল পাসওয়ার্ড বাইপাস' : 'Global Password Bypass'}
                </span>
                <p style={{ fontSize: '0.78rem', opacity: 0.65, margin: '2px 0 0' }}>
                  {isBn 
                    ? 'অন থাকলে পাসওয়ার্ড না মুছেই সাময়িকভাবে সব লকের প্রবেশ সহজ হবে' 
                    : 'Skip all passwords temporarily without removing them'}
                </p>
              </div>
              <button 
                className={`btn ${localStorage.getItem('disableLotPassword') === 'true' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  const isDis = localStorage.getItem('disableLotPassword') === 'true';
                  localStorage.setItem('disableLotPassword', String(!isDis));
                  window.dispatchEvent(new Event('settingsChange'));
                  setRenderCount(c => c + 1);
                }}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                {localStorage.getItem('disableLotPassword') === 'true' 
                  ? (isBn ? 'বাইপাস চালু (ON)' : 'Bypass ON') 
                  : (isBn ? 'বাইপাস বন্ধ (OFF)' : 'Bypass OFF')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
