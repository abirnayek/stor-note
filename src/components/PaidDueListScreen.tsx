import React, { useState, useEffect, useCallback } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Settings, X, Trash2 } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { syncAllDueAccounts, getNormalizedMemo, deleteDueMemo, type NormalizedDueMemo } from '../utils/dueSyncUtils';

interface PaidDueListScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType: 'regular' | 'permanent' | 'purchase';
  onSelectDue: (dueId: string) => void;
}

const PaidDueListScreen: React.FC<PaidDueListScreenProps> = ({ onNavigate, dueType, onSelectDue }) => {
  const [dues, setDues] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(true);
  const [autoDeleteMonths, setAutoDeleteMonths] = useState(6);
  const { t } = useLanguage();

  const handleDeleteDue = (dueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this paid memo?')) {
      deleteDueMemo(dueId, dueType, true);
      setDues(prev => prev.filter(d => d !== dueId));
    }
  };

  // Load settings
  useEffect(() => {
    const settingsStr = localStorage.getItem(`auto_delete_settings_${dueType}`);
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        setAutoDeleteEnabled(settings.enabled);
        setAutoDeleteMonths(settings.months);
      } catch (e) {}
    }
  }, [dueType]);

  // Save settings
  const saveSettings = (enabled: boolean, months: number) => {
    setAutoDeleteEnabled(enabled);
    setAutoDeleteMonths(months);
    localStorage.setItem(`auto_delete_settings_${dueType}`, JSON.stringify({ enabled, months }));
    runCleanup(enabled, months);
  };

  // Run cleanup and load dues
  const runCleanup = useCallback((enabled: boolean, months: number) => {
    const synced = syncAllDueAccounts();
    let duesList = dueType === 'regular'
      ? synced.paidRegularDues
      : dueType === 'permanent'
        ? synced.paidPermanentDues
        : synced.paidPurchaseDues;

    if (enabled) {
      const now = Date.now();
      const msInMonth = 30 * 24 * 60 * 60 * 1000;

      const filteredDues = duesList.filter(dueId => {
        const memo = getNormalizedMemo(dueId);
        if (memo.paidDate) {
          const age = now - memo.paidDate;
          if (age > months * msInMonth) {
            deleteDueMemo(dueId, dueType, true);
            return false;
          }
        }
        return true;
      });

      if (filteredDues.length !== duesList.length) {
        localStorage.setItem(`paid_dues_${dueType}`, JSON.stringify(filteredDues));
        duesList = filteredDues;
      }
    }

    setDues(duesList);
  }, [dueType]);

  useEffect(() => {
    runCleanup(autoDeleteEnabled, autoDeleteMonths);

    const handleStorage = () => runCleanup(autoDeleteEnabled, autoDeleteMonths);
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [runCleanup, autoDeleteEnabled, autoDeleteMonths]);

  let totalCategoryPaid = 0;
  const memoMap: Record<string, NormalizedDueMemo> = {};

  dues.forEach(dueId => {
    const memo = getNormalizedMemo(dueId);
    memoMap[dueId] = memo;
    totalCategoryPaid += memo.paidAmount;
  });

  const title = dueType === 'regular' ? t('regularDue') : dueType === 'permanent' ? t('permanentDue') : 'ক্রয় বকেয়া';

  return (
    <div className="lots-screen">
      <div className="screen-header" style={{ display: 'flex', alignItems: 'center' }}>
        <button className="btn-icon" onClick={() => onNavigate('due-list')}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ marginLeft: '1rem' }}>{title} - Paid Memos</h2>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
            {dues.length === 0 ? '0 Paid Memos' : `${dues.length} Paid Memos`}
          </div>
          <button className="btn-icon" onClick={() => setIsSettingsOpen(true)} title="Auto-Delete Settings">
            <Settings size={24} />
          </button>
        </div>
      </div>

      <div className="due-summary-bar">
        <div className="due-stats">
          <div className="stat-item main-stat">
            <span className="stat-label">Total {dueType === 'regular' ? 'Regular' : dueType === 'permanent' ? 'Arotder' : 'Purchase'} Paid:</span>
            <div className="stat-value highlight" style={{ color: '#72be44' }}>৳ {totalCategoryPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      <div className="list-layout-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '2rem' }}>
        <div className="lot-grid" style={{ flex: 1, marginTop: 0 }}>
          {dues.map(dueId => {
            const memo = memoMap[dueId] || getNormalizedMemo(dueId);
            const name = memo.name;
            let paidDateStr = '';
            if (memo.paidDate) {
              paidDateStr = new Date(memo.paidDate).toLocaleDateString();
            } else if (memo.dateStr) {
              paidDateStr = memo.dateStr;
            }

            return (
              <ProtectedMemoWrapper key={dueId} passwordKey={`memo_password_due_memo_${dueId}`} onAccessGranted={() => onSelectDue(dueId)}>
                <div className="lot-card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)', wordBreak: 'break-word', textAlign: 'left' }}>{name}</span>
                    <span style={{ fontSize: '0.95rem', color: '#72be44', marginTop: '0.3rem', fontWeight: '600' }}>
                      Paid: ৳ {memo.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {paidDateStr && <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>Paid on: {paidDateStr}</div>}
                    {memo.mobile && <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>📞 {memo.mobile}</div>}
                  </div>
                  <div className="card-top-actions">
                    <button className="btn-icon delete-btn" onClick={(e) => handleDeleteDue(dueId, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                    <MemoLockIcon passwordKey={`memo_password_${dueId}`} />
                  </div>
                </div>
              </div>
              </ProtectedMemoWrapper>
            );
          })}
        </div>
      </div>

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '450px' }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trash2 size={20} color="#ea4335" /> Auto-Delete Settings</h2>
              <button className="close-button" onClick={() => setIsSettingsOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <p style={{ marginBottom: '1.5rem', opacity: 0.8, lineHeight: 1.5 }}>
              Automatically delete paid memos from this list after a certain time to free up space.
            </p>

            <div className="setting-item" style={{ padding: '1rem 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 600 }}>Enable Auto-Delete</span>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={autoDeleteEnabled} 
                  onChange={(e) => saveSettings(e.target.checked, autoDeleteMonths)}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--primary-color)' }}
                />
              </label>
            </div>
            
            {autoDeleteEnabled && (
              <div className="setting-item" style={{ padding: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontWeight: 600 }}>Delete after:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    min="1" 
                    max="120"
                    value={autoDeleteMonths}
                    onChange={(e) => saveSettings(true, parseInt(e.target.value) || 6)}
                    style={{ 
                      width: '60px', 
                      padding: '0.5rem', 
                      borderRadius: '8px', 
                      background: 'var(--input-bg)', 
                      border: '1px solid var(--border-color)', 
                      color: 'var(--text-color)',
                      textAlign: 'center'
                    }}
                  />
                  <span>months</span>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <button className="btn" onClick={() => setIsSettingsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaidDueListScreen;
