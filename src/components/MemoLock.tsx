import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Folder, FileText, Package } from 'lucide-react';

export const MemoLockIcon: React.FC<{ passwordKey: string }> = ({ passwordKey }) => {
    const [locked, setLocked] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [pwd, setPwd] = useState('');

    useEffect(() => {
        const check = () => setLocked(!!localStorage.getItem(passwordKey));
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, [passwordKey]);

    const handleSave = () => {
        if (pwd.trim()) {
            localStorage.setItem(passwordKey, pwd.trim());
            setLocked(true);
        } else {
            localStorage.removeItem(passwordKey);
            setLocked(false);
        }
        window.dispatchEvent(new Event('storage'));
        setShowModal(false);
    };

    const handleRemove = () => {
        if (window.confirm('আপনি কি নিশ্চিত এই পাসওয়ার্ডটি মুছে ফেলতে চান?')) {
            localStorage.removeItem(passwordKey);
            setLocked(false);
            window.dispatchEvent(new Event('storage'));
            setShowModal(false);
            alert('পাসওয়ার্ড সফলভাবে মুছে ফেলা হয়েছে!');
        }
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
                      <h2 style={{ margin: 0, fontSize: '1.2rem' }}>পাসওয়ার্ড সেট / পরিবর্তন</h2>
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>নতুন পাসওয়ার্ড দিন (খালি রাখলে পাসওয়ার্ড মুছে যাবে)</label>
                      <input 
                        type="text" 
                        value={pwd}
                        onChange={e => setPwd(e.target.value)}
                        placeholder="পাসওয়ার্ড লিখুন..."
                        className="supplier-input"
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px' }}
                        autoFocus
                      />
                    </div>
                    <div className="modal-actions" style={{ display: 'flex', gap: '0.8rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>
                        বাতিল
                      </button>
                      {locked && (
                        <button 
                          type="button"
                          className="btn" 
                          onClick={handleRemove}
                          style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 'bold' }}
                        >
                          পাসওয়ার্ড মুছুন
                        </button>
                      )}
                      <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
                        সেভ করুন
                      </button>
                    </div>
                  </div>
                </div>
            )}
        </>
    );
};

export interface ProtectedMemoWrapperProps {
   passwordKey: string;
   onAccessGranted: () => void;
   name?: string;
   type?: 'folder' | 'memo' | 'lot';
   children: React.ReactNode;
   draggable?: boolean;
   style?: React.CSSProperties;
   className?: string;
   onDragStart?: (e: React.DragEvent) => void;
   onDragEnd?: (e: React.DragEvent) => void;
   onDragOver?: (e: React.DragEvent) => void;
   onDragEnter?: (e: React.DragEvent) => void;
   onDragLeave?: (e: React.DragEvent) => void;
   onDrop?: (e: React.DragEvent) => void;
}

export const ProtectedMemoWrapper: React.FC<ProtectedMemoWrapperProps> = ({ 
   passwordKey, 
   onAccessGranted, 
   name,
   type,
   children,
   draggable,
   style,
   className,
   onDragStart,
   onDragEnd,
   onDragOver,
   onDragEnter,
   onDragLeave,
   onDrop
}) => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [pwd, setPwd] = useState('');
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        const check = () => {
            const saved = localStorage.getItem(passwordKey);
            const bypass = localStorage.getItem('disableLotPassword') === 'true';
            setIsLocked(!!(saved && saved.trim() !== '' && !bypass));
        };
        check();
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, [passwordKey]);

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
    };

    const handleRemovePassword = () => {
        const saved = localStorage.getItem(passwordKey);
        if (!saved) {
            setIsLocked(false);
            setShowPrompt(false);
            return;
        }

        const proceedDelete = () => {
            localStorage.removeItem(passwordKey);
            setIsLocked(false);
            setShowPrompt(false);
            setPwd('');
            window.dispatchEvent(new Event('storage'));
            alert('পাসওয়ার্ড সফলভাবে মুছে ফেলা হয়েছে! এখন যে কেউ সরাসরি প্রবেশ করতে পারবে।');
        };

        if (pwd && pwd.trim() === saved.trim()) {
            if (window.confirm('আপনি কি নিশ্চিত এই ফোল্ডার/মেমোর পাসওয়ার্ডটি মুছে ফেলতে চান?')) {
                proceedDelete();
            }
        } else if (pwd && pwd.trim() !== saved.trim()) {
            alert('ভুল পাসওয়ার্ড! পাসওয়ার্ড মুছতে বক্সে সঠিক পাসওয়ার্ডটি লিখে এই বাটনে ক্লিক করুন।');
        } else {
            const entered = window.prompt('পাসওয়ার্ডটি মুছে ফেলতে বর্তমান পাসওয়ার্ডটি লিখুন:');
            if (entered === null) return;
            if (entered.trim() === saved.trim()) {
                proceedDelete();
            } else {
                alert('ভুল পাসওয়ার্ড! পাসওয়ার্ড মোছা হয়নি।');
            }
        }
    };

    const handleUnlockSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const saved = localStorage.getItem(passwordKey);
        if (pwd === saved) {
            setShowPrompt(false);
            onAccessGranted();
        } else {
            alert('ভুল পাসওয়ার্ড! আবার চেষ্টা করুন।');
        }
    };

    return (
        <div 
            className={className}
            style={{ 
                position: 'relative', 
                width: '100%', 
                height: '100%', 
                cursor: 'pointer',
                borderRadius: '14px',
                overflow: 'hidden',
                ...style
            }}
            onClick={handleClick}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            <div 
                style={{ 
                    width: '100%',
                    height: '100%',
                    ...(isLocked ? {
                        filter: 'blur(4px)',
                        WebkitFilter: 'blur(4px)',
                        userSelect: 'none' as const,
                        opacity: 0.75,
                    } : {}),
                    transition: 'filter 0.2s ease, opacity 0.2s ease',
                }}
            >
                {children}
            </div>

            {isLocked && (
                <div 
                    onClick={handleClick}
                    onDragOver={onDragOver}
                    onDragEnter={onDragEnter}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    title="লক করা রয়েছে, পাসওয়ার্ড দিয়ে খুলুন"
                    style={{ 
                        position: 'absolute',
                        inset: 0,
                        cursor: 'pointer',
                        zIndex: 20,
                        borderRadius: '14px',
                        border: '1.5px solid rgba(255, 152, 0, 0.9)',
                        boxShadow: '0 0 16px rgba(255, 152, 0, 0.3), inset 0 0 12px rgba(0, 0, 0, 0.6)',
                        background: 'rgba(9, 22, 16, 0.88)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '1rem',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                    }}
                >
                    {/* Display name clearly so user can see whose memo or folder this is */}
                    {name && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(20, 24, 30, 0.92)',
                            border: '1.5px solid rgba(255, 255, 255, 0.4)',
                            padding: '6px 14px',
                            borderRadius: '10px',
                            maxWidth: '92%',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                            backdropFilter: 'blur(6px)',
                            marginBottom: '4px'
                        }}>
                            {type === 'folder' ? (
                                <Folder size={18} style={{ color: '#ce93d8', flexShrink: 0 }} />
                            ) : type === 'lot' ? (
                                <Package size={18} style={{ color: '#ffb74d', flexShrink: 0 }} />
                            ) : (
                                <FileText size={18} style={{ color: '#90caf9', flexShrink: 0 }} />
                            )}
                            <span style={{
                                fontSize: '1.05rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {name}
                            </span>
                        </div>
                    )}

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(15, 23, 20, 0.95)',
                        border: '1px solid rgba(255, 152, 0, 0.9)',
                        padding: '5px 14px',
                        borderRadius: '20px',
                        color: '#ffb74d',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(2px)'
                    }}>
                        <Lock size={15} style={{ color: '#ff9800' }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>লক করা (পাসওয়ার্ড দিন)</span>
                    </div>
                </div>
            )}

            {showPrompt && (
                <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowPrompt(false); }} style={{ zIndex: 10000 }}>
                  <div className="modal-content" onClick={e => e.stopPropagation()} style={{ color: '#fff', maxWidth: '380px' }}>
                    <form onSubmit={handleUnlockSubmit}>
                      <div className="modal-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: 'rgba(255, 152, 0, 0.2)', padding: '6px', borderRadius: '8px', color: '#ff9800' }}>
                          <Lock size={20} />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>পাসওয়ার্ড দিয়ে প্রবেশ করুন</h2>
                      </div>
                      <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.88rem', color: '#ccc' }}>পাসওয়ার্ড দিন</label>
                        <input 
                          type="password" 
                          value={pwd}
                          onChange={e => setPwd(e.target.value)}
                          placeholder="পাসওয়ার্ড লিখুন..."
                          className="supplier-input"
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                          autoFocus
                        />
                      </div>
                      <div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => setShowPrompt(false)} style={{ flex: 1 }}>
                            বাতিল
                          </button>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #ff9800, #f57c00)', border: 'none', color: '#fff', fontWeight: 'bold' }}>
                            প্রবেশ করুন
                          </button>
                        </div>

                        <button 
                          type="button" 
                          onClick={handleRemovePassword}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.45)',
                            color: '#f87171',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                          }}
                        >
                          <Unlock size={15} />
                          <span>পাসওয়ার্ড মুছে ফেলুন (Remove Password)</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
            )}
        </div>
    );
};
