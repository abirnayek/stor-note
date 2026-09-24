import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';

interface AutoMessageConfig {
  scheduledFor: number;
  type: 'whatsapp' | 'sms';
  status: 'pending' | 'sent' | 'failed';
}

interface DueListScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType: 'regular' | 'permanent' | 'purchase';
  onSelectDue: (dueId: string) => void;
}

const DueListScreen: React.FC<DueListScreenProps> = ({ onNavigate, dueType, onSelectDue }) => {
  const [dues, setDues] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [msgTimeframe, setMsgTimeframe] = useState<'24h' | '7d' | 'custom'>('7d');
  const [msgCustomDate, setMsgCustomDate] = useState<string>('');
  const [msgType, setMsgType] = useState<'whatsapp' | 'sms'>('whatsapp');
  
  useEffect(() => {
    const loadDues = () => {
      const savedDues = localStorage.getItem(`dues_${dueType}`);
      if (savedDues) {
        setDues(JSON.parse(savedDues));
      }
    };
    loadDues();
    window.addEventListener('storage', loadDues);
    return () => window.removeEventListener('storage', loadDues);
  }, [dueType]);
  
  const handleDeleteDue = (dueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this due memo?')) {
      const memoDataStr = localStorage.getItem(`due_memo_${dueId}`);
      const memoData = memoDataStr ? JSON.parse(memoDataStr) : {};
      
      moveToTrash({
        id: dueId,
        type: 'due_memo',
        title: `Due Memo (${memoData.name || 'Unknown'})`,
        data: memoData
      });

      const newDues = dues.filter(d => d !== dueId);
      setDues(newDues);
      localStorage.setItem(`dues_${dueType}`, JSON.stringify(newDues));
      localStorage.removeItem(`due_memo_${dueId}`);
    }
  };
  const { t } = useLanguage();

  const titleKey = dueType === 'regular' ? 'regularDue' : dueType === 'permanent' ? 'permanentDue' : 'purchaseDue';
  const title = titleKey === 'purchaseDue' ? 'ক্রয় বকেয়া' : t(titleKey);

  let setMsgCount = 0;
  let emptyMsgCount = 0;
  let totalCategoryDue = 0;
  let userDues: Record<string, number> = {};

  dues.forEach(dueId => {
    const memoStr = localStorage.getItem(`due_memo_${dueId}`);
    if (memoStr) {
      try {
        const memo = JSON.parse(memoStr);
        if (memo.autoMessage) {
          setMsgCount++;
        } else {
          emptyMsgCount++;
        }
        
        // Calculate due for this memo
        if (memo && Array.isArray(memo.entries)) {
          const totalPrice = memo.entries.reduce((sum: number, entry: any) => {
            let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
            let buyRateNum = Number(entry.buyRate) || 0;
            
            let calculatedSalePriceAuto = 0;
            if (buyRateNum > 0) {
              calculatedSalePriceAuto = buyRateNum + (buyRateNum * currentProfitPercent / 100);
            }
            
            let salePriceAuto = 0;
            if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
              let manualRateNum = Number(entry.manualSaleRate);
              salePriceAuto = manualRateNum + (manualRateNum * currentProfitPercent / 100);
            } else {
              salePriceAuto = calculatedSalePriceAuto;
            }
            
            let weightInKg = 0;
            let totalKgNum = Number(entry.totalKg) || 0;
            if (totalKgNum > 0) {
              weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
            }
            
            if (weightInKg > 0 && salePriceAuto > 0) {
              return sum + (salePriceAuto * weightInKg);
            }
            return sum;
          }, 0);
          
          const deposit = typeof memo.deposit === 'number' ? memo.deposit : (Number(memo.deposit) || 0);
          const paid = typeof memo.paidAmount === 'number' ? memo.paidAmount : (Number(memo.paidAmount) || 0);
          const dueAmount = totalPrice - deposit - paid;
          
          userDues[dueId] = dueAmount > 0 ? dueAmount : 0;

          if (dueAmount > 0) {
            totalCategoryDue += dueAmount;
          }
        }
      } catch (e) {}
    }
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
      const memoStr = localStorage.getItem(`due_memo_${dueId}`);
      if (memoStr) {
        try {
          const memo = JSON.parse(memoStr);
          if (!memo.autoMessage) {
            memo.autoMessage = {
              scheduledFor: timestamp,
              type: msgType,
              status: 'pending'
            };
            localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(memo));
          }
        } catch (e) {}
      }
    });

    setShowBulkModal(false);
    alert(`Successfully scheduled auto message for ${emptyMsgCount} memos!`);
    // trigger re-render
    setDues([...dues]);
  };

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button className="btn-icon" onClick={() => onNavigate(dueType === 'purchase' ? 'due-category' : 'due-types')}>
          <ChevronLeft size={24} />
        </button>
        <h2>{title} - {t('dueListTitle')}</h2>
        
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
          {dues.length === 0 ? t('noDues') : `${dues.length} ${t('duesCount')}`}
        </div>
      </div>

      <div className="due-summary-bar">
        <div className="due-stats">
          <div className="stat-item main-stat">
            <span className="stat-label">Total {dueType === 'regular' ? 'Regular' : dueType === 'permanent' ? 'Arotder' : 'Purchase'} Due:</span>
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
            const memoStr = localStorage.getItem(`due_memo_${dueId}`);
            let name = 'Unknown';
            let autoMsg: AutoMessageConfig | undefined = undefined;
            if (memoStr) {
              try {
                const memo = JSON.parse(memoStr);
                name = memo.name || 'Unknown';
                autoMsg = memo.autoMessage;
              } catch (e) {}
            }
            return (
              <ProtectedMemoWrapper key={dueId} passwordKey={`memo_password_due_memo_${dueId}`} onAccessGranted={() => onSelectDue(dueId)}>
                <div className="lot-card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-color)', wordBreak: 'break-word', textAlign: 'left' }}>{name}</span>
                    <span style={{ fontSize: '0.95rem', color: '#ff9800', marginTop: '0.3rem', fontWeight: '600' }}>Due: ৳ {(userDues[dueId] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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


