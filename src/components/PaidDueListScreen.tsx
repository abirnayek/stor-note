import React, { useState, useEffect, useCallback } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Settings, X, Trash2, ArrowLeftRight } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { syncAllDueAccounts, getNormalizedMemo, deleteDueMemo, changeDueCustomerType, type NormalizedDueMemo } from '../utils/dueSyncUtils';

interface PaidDueListScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType: 'regular' | 'permanent' | 'purchase' | 'reseller';
  onSelectDue: (dueId: string) => void;
  onSelectType?: (type: 'regular' | 'permanent' | 'reseller') => void;
}

const PaidDueListScreen: React.FC<PaidDueListScreenProps> = ({ onNavigate, dueType, onSelectDue, onSelectType }) => {
  const [dues, setDues] = useState<string[]>([]);
  const [paidRegularCount, setPaidRegularCount] = useState(0);
  const [paidPermanentCount, setPaidPermanentCount] = useState(0);
  const [paidResellerCount, setPaidResellerCount] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoDeleteEnabled, setAutoDeleteEnabled] = useState(true);
  const [autoDeleteMonths, setAutoDeleteMonths] = useState(6);
  const { t, language } = useLanguage();

  const handleDeleteDue = (dueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this paid memo?')) {
      deleteDueMemo(dueId, dueType, true);
      setDues(prev => prev.filter(d => d !== dueId));
    }
  };

  const handleToggleCategory = (dueId: string, currentType: 'regular' | 'permanent' | 'purchase' | 'reseller', e: React.MouseEvent) => {
    e.stopPropagation();
    // Cycle: regular -> permanent -> reseller -> regular
    const targetType: 'regular' | 'permanent' | 'reseller' = 
      currentType === 'regular' ? 'permanent' : currentType === 'permanent' ? 'reseller' : 'regular';

    const targetLabel = targetType === 'regular'
      ? (language === 'bn' ? 'সাধারণ পরিশোধিত' : 'Regular Paid')
      : targetType === 'permanent'
        ? (language === 'bn' ? 'আড়তদারের পরিশোধিত' : 'Aratdar Paid')
        : (language === 'bn' ? 'রিসেলার পরিশোধিত' : 'Reseller Paid');

    const confirmMsg = language === 'bn'
      ? `এই পরিশোধিত মেমোটি ${targetLabel}-তে স্থানান্তর করতে চান?`
      : `Move this paid memo to ${targetLabel}?`;

    if (window.confirm(confirmMsg)) {
      changeDueCustomerType(dueId, targetType);
      runCleanup(autoDeleteEnabled, autoDeleteMonths);
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
    setPaidRegularCount(synced.paidRegularDues.length);
    setPaidPermanentCount(synced.paidPermanentDues.length);
    setPaidResellerCount(synced.paidResellerDues.length);

    let duesList = dueType === 'regular'
      ? synced.paidRegularDues
      : dueType === 'permanent'
        ? synced.paidPermanentDues
        : dueType === 'reseller'
          ? synced.paidResellerDues
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
    const memo = memoMap[dueId] || getNormalizedMemo(dueId);
    memoMap[dueId] = memo;
    totalCategoryPaid += memo.paidAmount;
  });

  const title = dueType === 'regular'
    ? t('regularDue')
    : dueType === 'permanent'
      ? t('permanentDue')
      : dueType === 'reseller'
        ? (language === 'bn' ? 'রিসেলার বকেয়া' : 'Reseller Due')
        : (language === 'bn' ? 'ক্রয় বকেয়া' : 'Purchase Due');

  return (
    <div className="lots-screen">
      <div className="screen-header" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          key="btn-back-paid-due-list"
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(dueType === 'purchase' ? 'due-purchase-list' : 'due-list');
          }}
          title="Back"
        >
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

      {/* Switcher tabs between Regular and Aratdar Paid Dues */}
      {dueType !== 'purchase' && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectType ? onSelectType('regular') : onNavigate('due-types')}
            style={{
              background: dueType === 'regular' ? '#4caf50' : 'rgba(255,255,255,0.06)',
              color: dueType === 'regular' ? '#fff' : '#bbb',
              border: dueType === 'regular' ? '1px solid #4caf50' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {language === 'bn' ? 'সাধারণ পরিশোধিত' : 'Regular Paid'} ({paidRegularCount})
          </button>
          <button
            onClick={() => onSelectType ? onSelectType('permanent') : onNavigate('due-types')}
            style={{
              background: dueType === 'permanent' ? '#ab47bc' : 'rgba(255,255,255,0.06)',
              color: dueType === 'permanent' ? '#fff' : '#bbb',
              border: dueType === 'permanent' ? '1px solid #ab47bc' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {language === 'bn' ? 'আড়তদার পরিশোধিত' : 'Aratdar Paid'} ({paidPermanentCount})
          </button>
          <button
            onClick={() => onSelectType ? onSelectType('reseller') : onNavigate('due-types')}
            style={{
              background: dueType === 'reseller' ? '#00e676' : 'rgba(255,255,255,0.06)',
              color: dueType === 'reseller' ? '#003300' : '#bbb',
              border: dueType === 'reseller' ? '1px solid #00e676' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {language === 'bn' ? 'রিসেলার পরিশোধিত' : 'Reseller Paid'} ({paidResellerCount})
          </button>
        </div>
      )}

      <div className="due-summary-bar" style={{ marginTop: '1.2rem' }}>
        <div className="due-stats">
          <div className="stat-item main-stat">
            <span className="stat-label">Total {dueType === 'regular' ? 'Regular' : dueType === 'permanent' ? 'Aratdar' : dueType === 'reseller' ? 'Reseller' : 'Purchase'} Paid:</span>
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
              <ProtectedMemoWrapper 
                key={dueId} 
                passwordKey={`memo_password_due_memo_${dueId}`} 
                name={name || `পরিশোধিত #${dueId}`}
                type="memo"
                onAccessGranted={() => onSelectDue(dueId)}
              >
                <div className="lot-card" style={{ position: 'relative', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)', wordBreak: 'break-word', textAlign: 'left' }}>{name}</span>
                    <span style={{ fontSize: '0.95rem', color: '#72be44', marginTop: '0.3rem', fontWeight: '600' }}>
                      Paid: ৳ {memo.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {paidDateStr && <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>Paid on: {paidDateStr}</div>}
                    {memo.mobile && <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.2rem' }}>📞 {memo.mobile}</div>}

                    {/* Customer Type Indicator & Category Mover Button */}
                    {dueType !== 'purchase' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {(() => {
                          const isReseller = memo.customerType === 'reseller';
                          const isPermanent = memo.customerType === 'permanent';
                          const bg = isReseller 
                            ? 'rgba(0, 200, 83, 0.2)' 
                            : isPermanent 
                              ? 'rgba(171, 71, 188, 0.2)' 
                              : 'rgba(33, 150, 243, 0.2)';
                          const color = isReseller ? '#00e676' : isPermanent ? '#ce93d8' : '#90caf9';
                          const border = isReseller 
                            ? 'rgba(0, 200, 83, 0.4)' 
                            : isPermanent 
                              ? 'rgba(171, 71, 188, 0.4)' 
                              : 'rgba(33, 150, 243, 0.4)';
                          const label = isReseller 
                            ? (language === 'bn' ? 'রিসেলার' : 'Reseller')
                            : isPermanent 
                              ? (language === 'bn' ? 'আড়তদার' : 'Aratdar')
                              : (language === 'bn' ? 'সাধারণ ক্রেতা' : 'Regular Customer');

                          const nextLabel = memo.customerType === 'regular'
                            ? (language === 'bn' ? 'আড়তদারে নিন' : 'To Aratdar')
                            : memo.customerType === 'permanent'
                              ? (language === 'bn' ? 'রিসেলারে নিন' : 'To Reseller')
                              : (language === 'bn' ? 'সাধারণে নিন' : 'To Regular');

                          return (
                            <>
                              <span style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: bg,
                                color: color,
                                border: `1px solid ${border}`,
                                fontWeight: 'bold'
                              }}>
                                {label}
                              </span>
                              <button
                                onClick={(e) => handleToggleCategory(dueId, memo.customerType, e)}
                                title={language === 'bn' ? 'ক্যাটাগরি স্থানান্তর করুন' : 'Change Due Category'}
                                style={{
                                  background: 'rgba(255,255,255,0.08)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  borderRadius: '4px',
                                  color: '#eee',
                                  fontSize: '0.7rem',
                                  padding: '2px 7px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <ArrowLeftRight size={11} />
                                {nextLabel}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    )}
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
