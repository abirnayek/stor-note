import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Filter, Lock, FileText, Calendar } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { getAllGlobalSalesMemos, deleteSalesMemoCompletely, type SalesMemoGlobalItem } from '../utils/dueSyncUtils';

interface SalesMemoListScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number;
  onSelectMemo: (memoId: string) => void;
}

const SalesMemoListScreen: React.FC<SalesMemoListScreenProps> = ({ onNavigate, lotNumber, onSelectMemo }) => {
  const [memos, setMemos] = useState<SalesMemoGlobalItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'due'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'regular' | 'permanent' | 'reseller'>('all');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { t, language } = useLanguage();
  const devicePermission = localStorage.getItem('device_permission');
  const hasEditPermission = devicePermission === 'edit' || devicePermission === 'admin';

  useEffect(() => {
    const loadMemos = () => {
      const allGlobal = getAllGlobalSalesMemos();
      // Strictly only memos belonging to this specific lotNumber
      const lotMemos = allGlobal.filter(m => m.lotNumber === lotNumber);
      setMemos(lotMemos);

      // Keep sales_memo_list_${lotNumber} in sync and clean
      try {
        localStorage.setItem(`sales_memo_list_${lotNumber}`, JSON.stringify(lotMemos.map(m => m.id)));
      } catch (e) {}
    };

    loadMemos();
    window.addEventListener('storage', loadMemos);
    return () => window.removeEventListener('storage', loadMemos);
  }, [lotNumber]);

  const handleAddMemo = () => {
    let nextId = Date.now().toString();
    const allGlobal = getAllGlobalSalesMemos();
    const numericIds = allGlobal.map(m => Number(m.id)).filter(n => !isNaN(n) && n > 0 && n < 1000000000);
    if (numericIds.length > 0) {
      nextId = (Math.max(...numericIds) + 1).toString();
    } else {
      nextId = '1';
    }

    // Pre-initialize memo state with lotNumberInput set to this lot
    const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const initialState = {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: lotNumber.toString(),
      lotNumber: lotNumber.toString(),
      paidAmount: '',
      customerType: 'regular',
      status: 'draft',
      createdAt: today,
      createdAtTime: currentTime,
      lastModified: Date.now(),
      sellerSignature: localStorage.getItem('default_seller_signature') || '',
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', profitPercent: '' }]
    };
    localStorage.setItem(`sales_memo_${nextId}`, JSON.stringify(initialState));
    localStorage.setItem(`sales_memo_lot_${lotNumber}_memo_${nextId}`, JSON.stringify(initialState));

    // Preserve local timestamps for strict ordering
    try {
      const tsRaw = localStorage.getItem('local_timestamps');
      let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
      const now = Date.now();
      tsMap[`sales_memo_${nextId}`] = now;
      tsMap[`sales_memo_lot_${lotNumber}_memo_${nextId}`] = now;
      localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
    } catch (e) {}

    // Dispatch storage event so global memos & lot list update simultaneously
    window.dispatchEvent(new Event('storage'));
    onSelectMemo(nextId);
  };

  const handleDeleteMemo = (memo: SalesMemoGlobalItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${memo.name || 'মেমো #' + memo.id}" মেমোটি মুছে ট্র্যাশে পাঠাতে চান?`
      : `Are you sure you want to delete memo "${memo.name || '#' + memo.id}" and move to Trash?`;

    if (window.confirm(confirmMsg)) {
      deleteSalesMemoCompletely(memo.id, { name: memo.name, lotNumber });
      setMemos(prev => prev.filter(m => m.id !== memo.id));
    }
  };

  const filteredMemos = memos.filter(memo => {
    let statusMatch = true;
    if (filter === 'paid') statusMatch = (memo.status === 'paid');
    else if (filter === 'due') statusMatch = (memo.status === 'due' || memo.status === 'draft');

    let typeMatch = true;
    if (customerTypeFilter === 'regular') typeMatch = (memo.customerType === 'regular');
    else if (customerTypeFilter === 'permanent') typeMatch = (memo.customerType === 'permanent');
    else if (customerTypeFilter === 'reseller') typeMatch = (memo.customerType === 'reseller');

    return statusMatch && typeMatch;
  });

  return (
    <div className="lots-screen">
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            key="btn-back-sales-memo-list"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('sales-lots');
            }}
            title="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <h2>{t('salesAccount')} {lotNumber} - Memos</h2>
            <div style={{ background: 'rgba(114, 190, 68, 0.2)', color: '#72be44', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              Total: {memos.length}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
          <button className="btn-icon" onClick={() => setShowPasswordModal(true)} title="Set Password" style={{ margin: 0, padding: '4px' }}>
            <Lock size={18} />
          </button>
          
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }}></div>
          
          <Filter size={18} opacity={0.7} />
          
          <select 
            value={customerTypeFilter} 
            onChange={(e) => setCustomerTypeFilter(e.target.value as 'all' | 'regular' | 'permanent' | 'reseller')}
            style={{ 
              background: 'transparent', 
              color: '#fff', 
              border: 'none', 
              outline: 'none',
              cursor: 'pointer',
              padding: '0.2rem',
              marginRight: '0.5rem',
              borderRight: '1px solid rgba(255,255,255,0.2)'
            }}
          >
            <option value="all" style={{ color: '#000' }}>All Types</option>
            <option value="regular" style={{ color: '#000' }}>{t('regularSeller')}</option>
            <option value="permanent" style={{ color: '#000' }}>{t('aratdarSeller')}</option>
            <option value="reseller" style={{ color: '#000' }}>{t('reseller') || 'রিসেলার'}</option>
          </select>

          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as 'all' | 'paid' | 'due')}
            style={{ 
              background: 'transparent', 
              color: '#fff', 
              border: 'none', 
              outline: 'none',
              cursor: 'pointer',
              padding: '0.2rem'
            }}
          >
            <option value="all" style={{ color: '#000' }}>All Memos</option>
            <option value="paid" style={{ color: '#000' }}>Paid Memos</option>
            <option value="due" style={{ color: '#000' }}>Due Memos</option>
          </select>
        </div>
      </div>

      <div className="lot-grid">
        {hasEditPermission && (
          <div className="lot-card add-lot-card" onClick={handleAddMemo}>
            <div className="add-lot-content">
              <Plus size={48} />
              <h3>{t('newMemo')}</h3>
            </div>
          </div>
        )}

        {filteredMemos.map((memo) => {
          const memoPasswordKey = localStorage.getItem(`memo_password_sales_memo_lot_${lotNumber}_memo_${memo.id}`) 
            ? `memo_password_sales_memo_lot_${lotNumber}_memo_${memo.id}` 
            : `memo_password_${memo.id}`;

          return (
            <ProtectedMemoWrapper 
              key={memo.uniqueKey || `sales_memo_${lotNumber}_${memo.id}`} 
              passwordKey={memoPasswordKey} 
              name={memo.name || `মেমো #${memo.id}`}
              type="memo"
              onAccessGranted={() => onSelectMemo(memo.id)}
            >
              <div className="lot-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} style={{ opacity: 0.7 }} />
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{memo.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        background: `${memo.statusColor}33`, 
                        color: memo.statusColor, 
                        fontWeight: 'bold' 
                      }}>
                        {memo.statusText}
                      </span>
                      <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                        Lot: {memo.lotNumber !== null ? memo.lotNumber : 'N/A'}
                      </span>
                      {memo.totalAmount > 0 && (
                        <span style={{ 
                          fontSize: '0.8rem', 
                          background: 'rgba(76, 175, 80, 0.1)', 
                          color: '#4caf50', 
                          padding: '2px 6px', 
                          borderRadius: '4px', 
                          fontWeight: 'bold' 
                        }}>
                          ৳ {memo.totalAmount.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {memo.dateStr && (
                      <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Calendar size={12} opacity={0.7} />
                        <span>{memo.dateStr}</span>
                        {memo.timeStr && <span>({memo.timeStr})</span>}
                      </div>
                    )}
                  </div>
                  {hasEditPermission && (
                    <div className="card-top-actions">
                      <button 
                        className="btn-icon delete-btn" 
                        onClick={(e) => handleDeleteMemo(memo, e)} 
                        title={language === 'bn' ? 'লট থেকে সরান (মেমোটি গ্লোবাল মেমোতে থাকবে)' : 'Remove from lot (kept in global memos)'}
                        style={{ padding: '4px', margin: 0, color: '#ff5252' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                    <MemoLockIcon passwordKey={memoPasswordKey} />
                  </div>
                </div>
              </div>
            </ProtectedMemoWrapper>
          );
        })}
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>লটের পাসওয়ার্ড সেট করুন</h2>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>পাসওয়ার্ড (ঐচ্ছিক)</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন..."
                className="modal-input"
                autoFocus
              />
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => {
                localStorage.removeItem(`sales_lot_password_${lotNumber}`);
                setShowPasswordModal(false);
              }} style={{ flex: 1 }}>
                রিমুভ করুন
              </button>
              <button className="btn btn-primary" onClick={() => {
                if (newPassword.trim()) {
                  localStorage.setItem(`sales_lot_password_${lotNumber}`, newPassword.trim());
                } else {
                  localStorage.removeItem(`sales_lot_password_${lotNumber}`);
                }
                setShowPasswordModal(false);
              }} style={{ flex: 1 }}>
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesMemoListScreen;
