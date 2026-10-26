import React, { useEffect, useState } from 'react';
import { X, Trash2, Shield, ShieldAlert, Monitor, Smartphone, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { broadcastDeviceKickout, broadcastDevicePermission, forceLogoutEverywhere, getReadableDeviceName } from '../utils/syncEngine';

interface DeviceManagerProps {
  onClose: () => void;
}

interface Session {
  id: string;
  device_id: string;
  device_name: string;
  last_active: string;
  status: string;
  permission: 'view' | 'edit' | 'admin';
}

const DeviceManager: React.FC<DeviceManagerProps> = ({ onClose }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [kickoutLoading, setKickoutLoading] = useState(false);
  const currentDeviceId = localStorage.getItem('device_id');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isAdmin = isLocalhost || localStorage.getItem('device_permission') === 'admin';

  useEffect(() => {
    // 1. Immediately ensure this current device is registered & active in Supabase
    const registerCurrentDevice = async () => {
      let devId = localStorage.getItem('device_id');
      if (!devId) {
        devId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('device_id', devId);
      }
      const devPermission = (localStorage.getItem('device_permission') as any) || 'admin';
      const devName = getReadableDeviceName();

      try {
        await supabase.from('active_sessions').upsert({
          device_id: devId,
          device_name: devName,
          status: 'active',
          permission: devPermission,
          last_active: new Date().toISOString()
        }, { onConflict: 'device_id' });
      } catch (e) {
        console.warn('[DeviceManager] registerCurrentDevice error:', e);
      }

      await fetchSessions();
    };

    registerCurrentDevice();

    const channel = supabase.channel('active_sessions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, () => {
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setErrorMessage(null);
    let devId = localStorage.getItem('device_id');
    if (!devId) {
      devId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('device_id', devId);
    }
    const devPermission = (localStorage.getItem('device_permission') as any) || 'admin';
    const devName = getReadableDeviceName();

    const currentDeviceFallback: Session = {
      id: devId,
      device_id: devId,
      device_name: devName,
      last_active: new Date().toISOString(),
      status: 'active',
      permission: devPermission
    };

    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('status', 'active')
        .order('last_active', { ascending: false });

      if (error) {
        console.error('[DeviceManager] fetchSessions error:', error);
        if (error.message?.includes('exceed_egress_quota') || (error as any).status === 402) {
          setErrorMessage('Supabase কোটা সীমা শেষ (Exceed Egress Quota): Supabase ফ্রি প্ল্যানের মাসিক ব্যান্ডউইথ (5GB) লিমিট শেষ হওয়ায় সার্ভার সাময়িকভাবে রেস্ট্রিক্ট করা হয়েছে। Supabase Dashboard (Billing / Usage) থেকে Spend Cap বা Plan আপডেট করুন। তবে আপনার বর্তমান ডিভাইস সচল রয়েছে।');
        } else {
          setErrorMessage('ক্লাউড থেকে তথ্য লোড করা যায়নি: ' + error.message);
        }
        // Always display current device so user is not shown an empty list
        setSessions([currentDeviceFallback]);
      } else if (data) {
        const hasCurrent = data.some(s => s.device_id === devId);
        if (!hasCurrent) {
          setSessions([currentDeviceFallback, ...data]);
        } else {
          setSessions(data);
        }
      }
    } catch (e: any) {
      console.error('[DeviceManager] Exception in fetchSessions:', e);
      setErrorMessage(e?.message || 'সার্ভার যোগাযোগে ত্রুটি হয়েছে।');
      setSessions([currentDeviceFallback]);
    } finally {
      setLoading(false);
    }
  };

  const handleKickOut = async (deviceId: string) => {
    if (window.confirm("Are you sure you want to Remove this device? They will be logged out immediately.")) {
      const { error } = await supabase
        .from('active_sessions')
        .update({ status: 'revoked' })
        .eq('device_id', deviceId);
        
      if (!error) {
        broadcastDeviceKickout(deviceId);
        fetchSessions();
      } else {
        alert("ডিভাইস রিমুভ করা যায়নি: " + error.message);
      }
    }
  };

  const changePermission = async (deviceId: string, newPermission: string) => {
    const { error } = await supabase
      .from('active_sessions')
      .update({ permission: newPermission })
      .eq('device_id', deviceId);
      
    if (!error) {
      broadcastDevicePermission(deviceId, newPermission);
      fetchSessions();
    } else {
      alert("পারমিশন পরিবর্তন করা যায়নি: " + error.message);
    }
  };

  const handleKickOutAllOthers = async () => {
    if (window.confirm("আপনি কি এই ডিভাইস ছাড়া অন্য সকল ডিভাইস (পূর্বের ও বর্তমান সব লগইন) অবিলম্বে লগআউট করতে চান?")) {
      setKickoutLoading(true);
      try {
        await forceLogoutEverywhere(true);
        await fetchSessions();
        alert("সকল অন্যান্য ডিভাইস সফলভাবে লগআউট করা হয়েছে।");
      } catch (e: any) {
        alert("Error logging out devices: " + (e?.message || e));
      } finally {
        setKickoutLoading(false);
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={24} /> Manage Devices
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              onClick={() => fetchSessions()} 
              title="Refresh device list" 
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={18} className={loading ? 'spin-icon' : ''} />
            </button>
            <button className="close-button" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', color: '#ff9800', fontSize: '0.9rem' }}>
          Here you can see all devices currently logged into your account. You can revoke their access (Remove) or change their permissions (View/Edit).
        </div>

        {errorMessage && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.85rem 1rem',
            background: 'rgba(244, 67, 54, 0.15)',
            border: '1px solid rgba(244, 67, 54, 0.4)',
            borderRadius: '8px',
            color: '#ff7979',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem'
          }}>
            <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert size={16} /> ক্লাউড সার্ভার সংক্রান্ত সতর্কতা
            </div>
            <div>{errorMessage}</div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading devices...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>কোনো সক্রিয় ডিভাইস পাওয়া যায়নি</p>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>ফোনের অ্যাপটি একবার ওপেন/রিফ্রেশ করুন এবং উপরের রিফ্রেশ বাটনে ক্লিক করুন।</p>
                <button 
                  onClick={() => fetchSessions()} 
                  className="btn btn-primary" 
                  style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={loading ? 'spin-icon' : ''} /> আবার চেক করুন
                </button>
              </div>
            ) : (
              <>
                {sessions.map(session => (
                <div key={session.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px',
                  border: session.device_id === currentDeviceId ? '1px solid var(--primary-color)' : '1px solid transparent'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {session.device_name?.toLowerCase().includes('mobile') || session.device_name?.toLowerCase().includes('android') || session.device_name?.toLowerCase().includes('iphone') ? <Smartphone size={16} /> : <Monitor size={16} />}
                      <span>{session.device_name || 'Unknown Device'}</span>
                      {session.device_id === currentDeviceId && (
                        <span style={{ fontSize: '0.7rem', background: 'var(--primary-color)', color: '#000', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                          This Device
                        </span>
                      )}
                      {session.last_active && (Date.now() - new Date(session.last_active).getTime() < 5 * 60 * 1000) && (
                        <span style={{ fontSize: '0.7rem', background: 'rgba(76, 175, 80, 0.2)', border: '1px solid #4caf50', color: '#4caf50', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4caf50', display: 'inline-block' }}></span>
                          Active Now
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.4rem' }}>
                      Last Active: {new Date(session.last_active).toLocaleString()}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '2px' }}>
                      {session.permission === 'admin' && <Shield size={14} style={{ color: '#ff9800', marginLeft: '6px' }} />}
                      {session.permission === 'edit' && <Shield size={14} style={{ color: 'var(--primary-color)', marginLeft: '6px' }} />}
                      {session.permission === 'view' && <ShieldAlert size={14} style={{ color: '#ccc', marginLeft: '6px' }} />}
                      
                      <select
                        value={session.permission}
                        onChange={(e) => changePermission(session.device_id, e.target.value)}
                        disabled={session.device_id === currentDeviceId || localStorage.getItem('device_permission') !== 'admin'}
                        style={{
                          background: 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '0.4rem 0.5rem',
                          fontSize: '0.9rem',
                          outline: 'none',
                          cursor: (session.device_id === currentDeviceId || localStorage.getItem('device_permission') !== 'admin') ? 'not-allowed' : 'pointer',
                          appearance: 'none', // to hide default arrow on some browsers
                        }}
                      >
                        <option value="view" style={{ color: '#000' }}>View Only</option>
                        <option value="edit" style={{ color: '#000' }}>Edit Access</option>
                        <option value="admin" style={{ color: '#000' }}>Admin</option>
                      </select>
                      {/* Custom dropdown arrow */}
                      <span style={{ paddingRight: '8px', pointerEvents: 'none', opacity: 0.7 }}>▼</span>
                    </div>
                    
                    {session.device_id !== currentDeviceId && localStorage.getItem('device_permission') === 'admin' && (
                      <button 
                        onClick={() => handleKickOut(session.device_id)}
                        className="btn-icon"
                        title="Remove this device"
                        style={{ padding: '0.5rem', background: 'rgba(255,0,0,0.1)', color: '#ff5252', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            {isAdmin && (
              <button 
                onClick={handleKickOutAllOthers}
                disabled={kickoutLoading}
                style={{
                  marginTop: '1.2rem',
                  padding: '0.85rem',
                  background: 'rgba(255, 82, 82, 0.15)',
                  border: '1px solid #ff5252',
                  borderRadius: '8px',
                  color: '#ff5252',
                  fontWeight: 'bold',
                  cursor: kickoutLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  opacity: kickoutLoading ? 0.7 : 1,
                  fontSize: '0.95rem'
                }}
              >
                <Trash2 size={18} /> {kickoutLoading ? 'লগআউট হচ্ছে...' : 'অন্যান্য সকল ডিভাইস থেকে অবিলম্বে ফোর্স লগআউট করুন'}
              </button>
            )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManager;
