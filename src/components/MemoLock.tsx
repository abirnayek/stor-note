import React, { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';

export const MemoLockIcon: React.FC<{ passwordKey: string }> = ({ passwordKey }) => {
    const [locked, setLocked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [pwd, setPwd] = useState('');

    useEffect(() => {
        setLocked(!!localStorage.getItem(passwordKey));
    }, [passwordKey]);

    const handleSave = () => {
        if (pwd.trim()) {
            localStorage.setItem(passwordKey, pwd.trim());
            setLocked(true);
        } else {
            localStorage.removeItem(passwordKey);
            setLocked(false);
        }
        setShowModal(false);
    };
    
    return (
        <>
            <button 
                className="btn-icon" 
                onClick={(e) => { e.stopPropagation(); setShowModal(true); setPwd(''); }}
                style={{ color: locked ? '#ff9800' : '#aaa', padding: '4px', margin: 0 }}
                title="Lock/Unlock Memo"
            >
                {locked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>

            {showModal && (
                <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowModal(false); }} style={{ zIndex: 10000 }}>
                  <div className="modal-content" onClick={e => e.stopPropagation()} style={{ color: '#fff' }}>
                    <div className="modal-header" style={{ marginBottom: '1rem' }}>
                      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Set Memo Password</h2>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Password (Leave blank to remove)</label>
                      <input 
                        type="text" 
                        value={pwd}
                        onChange={e => setPwd(e.target.value)}
                        placeholder="Enter password..."
                        className="supplier-input"
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px' }}
                        autoFocus
                      />
                    </div>
                    <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                      <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
                        Save
                      </button>
                    </div>
                  </div>
                </div>
            )}
        </>
    );
};

export const ProtectedMemoWrapper: React.FC<{ 
   passwordKey: string, 
   onAccessGranted: () => void,
   children: React.ReactNode 
}> = ({ passwordKey, onAccessGranted, children }) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [pwd, setPwd] = useState('');

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const saved = localStorage.getItem(passwordKey);
        const bypass = localStorage.getItem('disableLotPassword') === 'true';
        if (saved && !bypass) {
            setShowPrompt(true);
            setPwd('');
        } else {
            onAccessGranted();
        }
    }

    return (
        <>
            <div onClick={handleClick} style={{ display: 'contents' }}>
                {children}
            </div>
            {showPrompt && (
                <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowPrompt(false); }} style={{ zIndex: 10000 }}>
                  <div className="modal-content" onClick={e => e.stopPropagation()} style={{ color: '#fff' }}>
                    <div className="modal-header" style={{ marginBottom: '1rem' }}>
                      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Memo is Locked!</h2>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Enter Password</label>
                      <input 
                        type="text" 
                        value={pwd}
                        onChange={e => setPwd(e.target.value)}
                        className="supplier-input"
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px' }}
                        autoFocus
                      />
                    </div>
                    <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                      <button className="btn btn-secondary" onClick={() => setShowPrompt(false)} style={{ flex: 1 }}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={() => {
                          if (pwd === localStorage.getItem(passwordKey)) {
                              setShowPrompt(false);
                              onAccessGranted();
                          } else {
                              alert('Incorrect password!');
                          }
                      }} style={{ flex: 1 }}>
                        Open Memo
                      </button>
                    </div>
                  </div>
                </div>
            )}
        </>
    );
};
