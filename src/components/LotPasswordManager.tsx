import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock, Key, Trash2, ArrowLeft } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface Props {
  onClose: () => void;
}

export const LotPasswordManager: React.FC<Props> = ({ onClose }) => {
  const [salesLots, setSalesLots] = useState<number[]>([]);
  const [buyLots, setBuyLots] = useState<number[]>([]);
  
  const [activeTab, setActiveTab] = useState<'sales' | 'buy'>('sales');
  
  const [selectedLot, setSelectedLot] = useState<{type: 'sales' | 'buy', lot: number} | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  // Forgot password logic
  const [forgotLot, setForgotLot] = useState<{type: 'sales' | 'buy', lot: number} | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadLots();
  }, []);

  const loadLots = () => {
    try {
      const sLots = localStorage.getItem('sales_lots_list');
      if (sLots) {
        const parsed = JSON.parse(sLots);
        if (Array.isArray(parsed)) setSalesLots(parsed);
      }
      
      const bLots = localStorage.getItem('purchase_lots_list');
      if (bLots) {
        const parsed = JSON.parse(bLots);
        if (Array.isArray(parsed)) setBuyLots(parsed);
      }
    } catch (e) {
      console.error('Failed to parse lots', e);
    }
  };

  const getPasswordKey = (type: 'sales' | 'buy', lot: number) => {
    return type === 'sales' ? `sales_lot_password_${lot}` : `lot_password_${lot}`;
  };

  const hasPassword = (type: 'sales' | 'buy', lot: number) => {
    return !!localStorage.getItem(getPasswordKey(type, lot));
  };

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    
    if (newPassword.trim() === '') {
      localStorage.removeItem(getPasswordKey(selectedLot.type, selectedLot.lot));
    } else {
      localStorage.setItem(getPasswordKey(selectedLot.type, selectedLot.lot), newPassword.trim());
    }
    
    setSelectedLot(null);
    setNewPassword('');
    // Trigger update
    setSalesLots([...salesLots]);
  };
  
  const handleRemovePassword = (type: 'sales' | 'buy', lot: number) => {
    if (window.confirm(`Are you sure you want to remove the password for this lot?`)) {
      localStorage.removeItem(getPasswordKey(type, lot));
      setSalesLots([...salesLots]);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: adminEmail
      });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: adminEmail,
        token: otp,
        type: 'email'
      });
      if (error) throw error;
      
      // Verified successfully! Remove the password for the forgotten lot
      if (forgotLot) {
        localStorage.removeItem(getPasswordKey(forgotLot.type, forgotLot.lot));
        setForgotLot(null);
        setOtpSent(false);
        setOtp('');
        setAdminEmail('');
        setSalesLots([...salesLots]);
        alert('Password successfully removed! You can now access the lot.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '1rem', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Key size={20} /> Lot Passwords
        </h2>
        <button onClick={onClose} className="btn-icon">
          <X size={20} />
        </button>
      </div>
      
      {forgotLot ? (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button className="btn-icon" onClick={() => setForgotLot(null)} title="Back" style={{ padding: 0 }}>
              <ArrowLeft size={20} />
            </button>
            <h3 style={{ margin: 0 }}>Forgot Password - {forgotLot.type === 'sales' ? 'Sales' : 'Purchase'} Lot {forgotLot.lot}</h3>
          </div>
          
          {errorMsg && <div style={{ background: 'rgba(244, 67, 54, 0.2)', border: '1px solid #f44336', color: '#ffb4b4', padding: '0.75rem', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{errorMsg}</div>}
          
          {!otpSent ? (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 500 }}>Admin Email</label>
                <input 
                  type="email" 
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }}
                  placeholder="Enter admin email..."
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                {loading ? 'Sending Code...' : 'Send Reset Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)', padding: '0.75rem', borderRadius: '6px' }}>
                <p style={{ fontSize: '0.9rem', margin: 0, color: '#a5d6a7' }}>6-digit code sent to <strong>{adminEmail}</strong>.</p>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 500 }}>Enter 6-Digit Code</label>
                <input 
                  type="text" 
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '4px', textAlign: 'center', fontSize: '1.1rem' }}
                  placeholder="------"
                  maxLength={6}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                {loading ? 'Verifying...' : 'Verify & Remove Password'}
              </button>
            </form>
          )}
        </div>
      ) : selectedLot ? (
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button className="btn-icon" onClick={() => setSelectedLot(null)} title="Back" style={{ padding: 0 }}>
              <ArrowLeft size={20} />
            </button>
            <h3 style={{ margin: 0 }}>
              Set Password for {selectedLot.type === 'sales' ? 'Sales' : 'Purchase'} Lot {selectedLot.lot}
            </h3>
          </div>
          <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="supplier-input"
              style={{ width: '100%', padding: '0.5rem' }}
              placeholder="Leave empty to remove password"
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.75rem', fontWeight: 'bold' }}>Save Password</button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button 
              className={`btn ${activeTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('sales')}
              style={{ flex: 1 }}
            >
              Sales Lots
            </button>
            <button 
              className={`btn ${activeTab === 'buy' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('buy')}
              style={{ flex: 1 }}
            >
              Purchase Lots
            </button>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', padding: '0.5rem' }}>
            {(activeTab === 'sales' ? salesLots : buyLots).length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.7 }}>No lots found</div>
            ) : (
              (activeTab === 'sales' ? salesLots : buyLots).map(lot => {
                const locked = hasPassword(activeTab, lot);
                return (
                  <div key={lot} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {locked ? <Lock size={16} color="#ff9800" /> : <Unlock size={16} color="#72be44" />}
                      <span style={{ fontWeight: 500 }}>Lot {lot}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {locked && (
                        <span 
                          onClick={() => setForgotLot({ type: activeTab, lot })} 
                          style={{ color: '#ff9800', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', marginRight: '0.5rem' }}
                        >
                          Forgot?
                        </span>
                      )}
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => setSelectedLot({ type: activeTab, lot })}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        {locked ? 'Change' : 'Set Password'}
                      </button>
                      {locked && (
                        <button className="btn-icon" onClick={() => handleRemovePassword(activeTab, lot)} title="Remove Password" style={{ color: '#f44336' }}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem' }}>Global Password Bypass</span>
              <button 
                className={`btn ${localStorage.getItem('disableLotPassword') === 'true' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  const isDis = localStorage.getItem('disableLotPassword') === 'true';
                  localStorage.setItem('disableLotPassword', String(!isDis));
                  window.dispatchEvent(new Event('settingsChange'));
                  setSalesLots([...salesLots]); // force update
                }}
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
              >
                {localStorage.getItem('disableLotPassword') === 'true' ? 'Bypass ON' : 'Bypass OFF'}
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0.5rem 0 0' }}>
              Turn on bypass to temporarily skip all lot passwords without removing them.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
