import React, { useEffect, useState } from 'react';
import { X, Trash2, Shield, ShieldAlert, Monitor, Smartphone } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

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
  const currentDeviceId = localStorage.getItem('device_id');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('status', 'active')
      .order('last_active', { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  const handleKickOut = async (deviceId: string) => {
    if (window.confirm("Are you sure you want to Remove this device? They will be logged out immediately.")) {
      const { error } = await supabase
        .from('active_sessions')
        .update({ status: 'revoked' })
        .eq('device_id', deviceId);
        
      if (!error) {
        fetchSessions();
      }
    }
  };

  const changePermission = async (deviceId: string, newPermission: string) => {
    const { error } = await supabase
      .from('active_sessions')
      .update({ permission: newPermission })
      .eq('device_id', deviceId);
      
    if (!error) {
      fetchSessions();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Monitor size={24} /> Manage Devices
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', color: '#ff9800', fontSize: '0.9rem' }}>
          Here you can see all devices currently logged into your account. You can revoke their access (Remove) or change their permissions (View/Edit).
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading devices...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sessions.length === 0 ? (
              <p>No active sessions found.</p>
            ) : (
              sessions.map(session => (
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
                        disabled={session.device_id === currentDeviceId}
                        style={{
                          background: 'transparent',
                          color: '#fff',
                          border: 'none',
                          padding: '0.4rem 0.5rem',
                          fontSize: '0.9rem',
                          outline: 'none',
                          cursor: session.device_id === currentDeviceId ? 'not-allowed' : 'pointer',
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
                    
                    {session.device_id !== currentDeviceId && (
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
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManager;
