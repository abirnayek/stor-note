import React, { useState, useEffect, useCallback } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Clock, CheckCircle, AlertTriangle, ArrowLeftRight } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { syncAllDueAccounts, getNormalizedMemo, deleteDueMemo, changeDueCustomerType, type NormalizedDueMemo } from '../utils/dueSyncUtils';

interface AutoMessageConfig {
  scheduledFor: number;
  type: 'whatsapp' | 'sms';
  status: 'pending' | 'sent' | 'failed';
}

interface DueListScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType: 'regular' | 'permanent' | 'purchase' | 'reseller';
  onSelectDue: (dueId: string) => void;
  onSelectType?: (type: 'regular' | 'permanent' | 'reseller') => void;
  onBack?: () => void;
}

const DueListScreen: React.FC<DueListScreenProps> = ({ onNavigate, dueType, onSelectDue, onSelectType, onBack }) => {
  const [dues, setDues] = useState<string[]>([]);
  const [regularCount, setRegularCount] = useState(0);
  const [permanentCount, setPermanentCount] = useState(0);
  const [resellerCount, setResellerCount] = useState(0);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [msgTimeframe, setMsgTimeframe] = useState<'24h' | '7d' | 'custom'>('7d');
  const [msgCustomDate, setMsgCustomDate] = useState<string>('');
  const [msgType, setMsgType] = useState<'whatsapp' | 'sms'>('whatsapp');
  const { t, language } = useLanguage();

  const loadDues = useCallback(() => {
    const synced = syncAllDueAccounts();
    setRegularCount(synced.regularDues.length);
    setPermanentCount(synced.permanentDues.length);
    setResellerCount(synced.resellerDues.length);
    const list = dueType === 'regular'
      ? synced.regularDues
      : dueType === 'permanent'
        ? synced.permanentDues
        : dueType === 'reseller'
          ? synced.resellerDues
          : synced.purchaseDues;
    setDues(list);
  }, [dueType]);

  useEffect(() => {
    loadDues();
    window.addEventListener('storage', loadDues);
    return () => window.removeEventListener('storage', loadDues);
  }, [loadDues]);

  const handleDeleteDue = (dueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this due memo?')) {
      deleteDueMemo(dueId, dueType, false);
      setDues(prev => prev.filter(d => d !== dueId));
    }
  };

  const handleToggleCategory = (dueId: string, currentType: 'regular' | 'permanent' | 'purchase' | 'reseller', e: React.MouseEvent) => {
    e.stopPropagation();
    // Cycle: regular -> permanent -> reseller -> regular
    const targetType: 'regular' | 'permanent' | 'reseller' = 
      currentType === 'regular' ? 'permanent' : currentType === 'permanent' ? 'reseller' : 'regular';

    const targetLabel = targetType === 'regular'
      ? (language === 'bn' ? 'সাধারণ বকেয়া' : 'Regular Due')
      : targetType === 'permanent'
        ? (language === 'bn' ? 'আড়তদারের বকেয়া' : 'Aratdar Due')
        : (language === 'bn' ? 'রিসেলার বকেয়া' : 'Reseller Due');

    const confirmMsg = language === 'bn'
      ? `এই মেমোটি ${targetLabel}-তে স্থানান্তর করতে চান?`
      : `Move this memo to ${targetLabel}?`;

    if (window.confirm(confirmMsg)) {
      changeDueCustomerType(dueId, targetType);
      loadDues();
    }
  };

  const title = dueType === 'regular'
    ? t('regularDue')
    : dueType === 'permanent'
      ? t('permanentDue')
      : dueType === 'reseller'
        ? (language === 'bn' ? 'রিসেলার বকেয়া' : 'Reseller Due')
        : (language === 'bn' ? 'ক্রয় বকেয়া' : 'Purchase Due');

  let setMsgCount = 0;
  let emptyMsgCount = 0;
  let totalCategoryDue = 0;
  const memoMap: Record<string, NormalizedDueMemo> = {};

  dues.forEach(dueId => {
    const memo = getNormalizedMemo(dueId);
    memoMap[dueId] = memo;
    if (memo.autoMessage) {
      setMsgCount++;
    } else {
      emptyMsgCount++;
    }
    totalCategoryDue += memo.dueAmount;
  });

  const handleBulkSetMessage = () => {
    let timestamp = 0;
    if (msgTimeframe === '24h') {
      timestamp = Date.now() + (24 * 60 * 60 * 1000);
    } else if (msgTimeframe === '7d') {
      timestamp = Date.now() + (7 * 24 * 60 * 60 * 1000);
    } else if (msgTimeframe === 'custom' && msgCustomDate) {
      timestamp = new Date(msgCustomDate).getTime();
    } else {
      alert('Please select a valid date');
      return;
    }

    dues.forEach(dueId => {
      const memo = memoMap[dueId] || getNormalizedMemo(dueId);
      if (!memo.autoMessage) {
        const autoMessage: AutoMessageConfig = {
          scheduledFor: timestamp,
          type: msgType,
          status: 'pending'
        };
        const dueStr = localStorage.getItem(`due_memo_${dueId}`);
        if (dueStr) {
          try {
            const parsed = JSON.parse(dueStr);
            parsed.autoMessage = autoMessage;
            localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(parsed));
          } catch (e) {}
        }
      }
    });

    setShowBulkModal(false);
    alert(`Successfully scheduled auto message for ${emptyMsgCount} memos!`);
    loadDues();
  };

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button
          key="btn-back-due-list"
          type="button"
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            if (onBack) onBack();
            else onNavigate(dueType === 'purchase' ? 'due-category' : 'due-types');
          }}
          title="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <h2>{title} - {t('dueListTitle')}</h2>
        
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
          {dues.length === 0 ? t('noDues') : `${dues.length} ${t('duesCount')}`}
        </div>
      </div>

      {/* Switcher tabs between Regular and Aratdar Dues for instant navigation */}
      {dueType !== 'purchase' && (
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSelectType ? onSelectType('regular') : onNavigate('due-types')}
            style={{
              background: dueType === 'regular' ? '#2196f3' : 'rgba(255,255,255,0.06)',
              color: dueType === 'regular' ? '#fff' : '#bbb',
              border: dueType === 'regular' ? '1px solid #2196f3' : '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {language === 'bn' ? 'সাধারণ বকেয়া (রেগুলার)' : 'Regular Dues'} ({regularCount})
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
            {language === 'bn' ? 'আড়তদারের বকেয়া (পার্মানেন্ট)' : 'Aratdar Dues'} ({permanentCount})
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
            {language === 'bn' ? 'রিসেলার বকেয়া' : 'Reseller Dues'} ({resellerCount})
          </button>
        </div>
      )}

      <div className="due-summary-bar" style={{ marginTop: '1.2rem' }}>
        <div className="due-stats">
          <div className="stat-item main-stat">
            <span className="stat-label">Total {dueType === 'regular' ? 'Regular' : dueType === 'permanent' ? 'Aratdar' : dueType === 'reseller' ? 'Reseller' : 'Purchase'} Due:</span>
            <div className="stat-value highlight">৳ {totalCategoryDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-item sub-stat">
            <span className="stat-label">Auto Message Set:</span>
            <div className="stat-value text-green">{setMsgCount}</div>
          </div>
          <div className="stat-item sub-stat">
            <span className="stat-label">Not Set (Empty):</span>
            <div className="stat-value text-red">{emptyMsgCount}</div>
          </div>
        </div>
        
        <div className="due-actions">
          <button className="btn-primary" onClick={() => onNavigate('paid-due-list')}>Paid Memos</button>
          {emptyMsgCount > 0 && (
            <button 
              className="btn-primary bulk-btn" 
              onClick={() => setShowBulkModal(true)}
            >
              Set Messages for All Empty
            </button>
          )}
        </div>
      </div>

      <div className="list-layout-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '2rem' }}>
        <div className="lot-grid" style={{ flex: 1, marginTop: 0 }}>
          {dues.map(dueId => {
            const memo = memoMap[dueId] || getNormalizedMemo(dueId);
            const name = memo.name;
            const autoMsg = memo.autoMessage;
            return (
              <ProtectedMemoWrapper 
                key={dueId} 
                passwordKey={`memo_password_due_memo_${dueId}`} 
                name={name || `বকেয়া #${dueId}`}
                type="memo"
                onAccessGranted={() => onSelectDue(dueId)}
              >
                <div className="lot-card" style={{ position: 'relative', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)', wordBreak: 'break-word', textAlign: 'left' }}>{name}</span>
                    <span style={{ fontSize: '0.95rem', color: '#ff9800', marginTop: '0.3rem', fontWeight: '600' }}>
                      Due: ৳ {memo.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {memo.totalBill > 0 && (
                      <span style={{ fontSize: '0.78rem', color: '#aaa', marginTop: '0.15rem' }}>
                        মোট: ৳{memo.totalBill.toFixed(0)} | পরিশোধ: ৳{memo.paidAmount.toFixed(0)}
                      </span>
                    )}
                    {memo.mobile && (
                      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.2rem' }}>
                        📞 {memo.mobile}
                      </span>
                    )}

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
                {autoMsg && (
                  <div style={{ 
                    position: 'absolute', bottom: '10px', right: '10px', 
                    display: 'flex', alignItems: 'center', gap: '5px', 
                    fontSize: '0.75rem', 
                    color: autoMsg.status === 'sent' ? '#72be44' : autoMsg.status === 'failed' ? '#ff5252' : '#ff9800',
                    background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '12px'
                  }}>
                    {autoMsg.status === 'sent' ? <CheckCircle size={12} /> : autoMsg.status === 'failed' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                    {autoMsg.status.charAt(0).toUpperCase() + autoMsg.status.slice(1)}
                  </div>
                )}
              </div>
              </ProtectedMemoWrapper>
            );
          })}
          
          <div className="lot-card empty-card" onClick={() => onSelectDue(`new_${Date.now()}`)}>
            <Plus size={48} className="card-icon" style={{ opacity: 0.3 }} />
            <h3 style={{ opacity: 0.5 }}>New Due</h3>
          </div>
        </div>
      </div>

      {showBulkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', color: '#fff', textAlign: 'center', minWidth: '300px' }}>
            <h3>Setup Bulk Auto Message</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>This will apply to all {emptyMsgCount} memos currently without a scheduled message.</p>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Select Timeframe:</label>
              <select 
                className="supplier-input" 
                style={{ width: '100%', padding: '0.5rem', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                value={msgTimeframe}
                onChange={e => setMsgTimeframe(e.target.value as any)}
              >
                <option value="24h">After 24 Hours</option>
                <option value="7d">After 7 Days</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            {msgTimeframe === 'custom' && (
              <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Select Date:</label>
                <input 
                  type="date" 
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.5rem', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                  value={msgCustomDate}
                  onChange={e => setMsgCustomDate(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Message Type:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={msgType === 'whatsapp'} onChange={() => setMsgType('whatsapp')} /> WhatsApp
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={msgType === 'sms'} onChange={() => setMsgType('sms')} /> SMS
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              <button className="btn-primary" onClick={handleBulkSetMessage} style={{ background: 'var(--primary-color)' }}>Confirm</button>
              <button className="btn-icon" onClick={() => setShowBulkModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DueListScreen;
