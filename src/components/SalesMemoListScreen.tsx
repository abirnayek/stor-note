import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Filter, Lock } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';

interface SalesMemoListScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number;
  onSelectMemo: (memoId: string) => void;
}

const SalesMemoListScreen: React.FC<SalesMemoListScreenProps> = ({ onNavigate, lotNumber, onSelectMemo }) => {
  const [memos, setMemos] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'paid' | 'due'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'regular' | 'permanent'>('all');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { t, language } = useLanguage();

  const getMemoData = (memoId: string) => {
    const memoKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
    let memoStr = localStorage.getItem(memoKey);
    if (!memoStr) {
      memoStr = localStorage.getItem(`due_memo_${memoId}`);
    }
    if (memoStr) {
      try {
        const parsed = JSON.parse(memoStr);
        const data = parsed.memoState || parsed;
        const rawLot = (data.lotNumberInput !== undefined && data.lotNumberInput !== '')
          ? data.lotNumberInput
          : (data.lotNumber !== undefined && data.lotNumber !== '' ? data.lotNumber : null);
        const memoLot = rawLot !== null ? parseInt(String(rawLot), 10) : null;
        
        // This screen ONLY displays memos that specifically belong to lotNumber.
        // If unassigned (null/NaN) or assigned to another lot, do NOT display in this lot!
        if (memoLot === null || isNaN(memoLot) || memoLot !== lotNumber) {
          return null;
        }
        return data;
      } catch(e) {}
    }
    return null;
  };

  useEffect(() => {
    const loadMemos = () => {
      const foundMemoIds = new Set<string>();

      // Check saved list for this lot
      const memoListKey = `sales_memo_list_${lotNumber}`;
      const savedListStr = localStorage.getItem(memoListKey);
      if (savedListStr) {
        try {
          const listArr: string[] = JSON.parse(savedListStr);
          listArr.forEach(id => {
            const data = getMemoData(id);
            if (data) {
              foundMemoIds.add(id);
            }
          });
        } catch(e) {}
      }

      // Check all storage keys matching sales_memo_lot_${lotNumber}_memo_*
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith(`sales_memo_lot_${lotNumber}_memo_`)) {
          const id = key.replace(`sales_memo_lot_${lotNumber}_memo_`, '');
          if (id) {
            const data = getMemoData(id);
            if (data) {
              foundMemoIds.add(id);
            } else {
              // Memo does not belong to this lot anymore.
              // Make sure its data is preserved in unassigned before removing from this lot!
              const rawStr = localStorage.getItem(key);
              if (rawStr) {
                try {
                  const parsed = JSON.parse(rawStr);
                  const inner = parsed.memoState || parsed;
                  const rawLot = (inner.lotNumberInput !== undefined && inner.lotNumberInput !== '')
                    ? inner.lotNumberInput
                    : (inner.lotNumber !== undefined && inner.lotNumber !== '' ? inner.lotNumber : null);
                  const mLot = rawLot !== null ? parseInt(String(rawLot), 10) : null;
                  if (mLot === null || isNaN(mLot)) {
                    const uKey = `sales_memo_lot_unassigned_memo_${id}`;
                    if (!localStorage.getItem(uKey)) {
                      localStorage.setItem(uKey, rawStr);
                    }
                    const uListKey = 'sales_memo_list_unassigned';
                    const uListStr = localStorage.getItem(uListKey);
                    let uList: string[] = uListStr ? JSON.parse(uListStr) : [];
                    if (!uList.includes(id)) {
                      uList.push(id);
                      localStorage.setItem(uListKey, JSON.stringify(uList));
                    }
                  }
                } catch(e) {}
              }
              localStorage.removeItem(key);
            }
          }
        }
      }

      const finalMemos = Array.from(foundMemoIds);
      // Deterministic sort: numeric ID descending
      finalMemos.sort((a, b) => {
        const numA = Number(a);
        const numB = Number(b);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numB - numA;
        }
        return b.localeCompare(a);
      });

      setMemos(finalMemos);
      localStorage.setItem(memoListKey, JSON.stringify(finalMemos));
    };

    loadMemos();
    window.addEventListener('storage', loadMemos);
    return () => window.removeEventListener('storage', loadMemos);
  }, [lotNumber]);

  const handleAddMemo = () => {
    const nextId = memos.length > 0 ? (Math.max(...memos.map(Number)) + 1).toString() : '1';
    const newMemos = [...memos, nextId];
    setMemos(newMemos);
    localStorage.setItem(`sales_memo_list_${lotNumber}`, JSON.stringify(newMemos));
    onSelectMemo(nextId);
  };

  const handleDeleteMemo = (memoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? 'আপনি কি এই মেমোটি এই লট থেকে মুছে দিতে চান?\n(মেমোটির লট নম্বর মুছে যাবে এবং এটি গ্লোবাল মেমোতে সংরক্ষিত থাকবে)'
      : 'Do you want to remove this memo from this lot?\n(The lot number will be cleared and it will remain in global memos)';

    if (window.confirm(confirmMsg)) {
      const oldKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
      let memoData: any = null;
      const oldStr = localStorage.getItem(oldKey);
      if (oldStr) {
        try { memoData = JSON.parse(oldStr); } catch(e) {}
      }
      if (!memoData) {
        const dueStr = localStorage.getItem(`due_memo_${memoId}`);
        if (dueStr) {
          try { memoData = JSON.parse(dueStr); } catch(e) {}
        }
      }
      if (!memoData) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.endsWith(`_memo_${memoId}`)) {
            try { 
              memoData = JSON.parse(localStorage.getItem(k) || '');
              break; 
            } catch(e) {}
          }
        }
      }

      // Clear lot number in memo data and save to unassigned key
      if (memoData) {
        if (memoData.memoState) {
          memoData.memoState.lotNumberInput = '';
          memoData.memoState.lotNumber = '';
        }
        memoData.lotNumberInput = '';
        memoData.lotNumber = '';
      } else {
        memoData = { lotNumberInput: '', lotNumber: '' };
      }

      const unassignedKey = `sales_memo_lot_unassigned_memo_${memoId}`;
      localStorage.setItem(unassignedKey, JSON.stringify(memoData));

      // Preserve stable timestamp for global memos ordering
      try {
        const tsRaw = localStorage.getItem('local_timestamps');
        let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
        if (tsMap[oldKey]) {
          tsMap[unassignedKey] = tsMap[oldKey];
        } else if (!tsMap[unassignedKey]) {
          tsMap[unassignedKey] = Date.now();
        }
        localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
      } catch(e) {}

      // Remove from current lot storage key
      localStorage.removeItem(oldKey);

      // Remove from current lot list
      const newMemos = memos.filter(m => m !== memoId);
      setMemos(newMemos);
      localStorage.setItem(`sales_memo_list_${lotNumber}`, JSON.stringify(newMemos));

      // Add to unassigned list
      const uKey = 'sales_memo_list_unassigned';
      const uStr = localStorage.getItem(uKey);
      let uList: string[] = uStr ? JSON.parse(uStr) : [];
      if (!uList.includes(memoId)) {
        uList.push(memoId);
        localStorage.setItem(uKey, JSON.stringify(uList));
      }

      // Update due_memo_${memoId} if exists
      const dueKey = `due_memo_${memoId}`;
      const dueStr = localStorage.getItem(dueKey);
      if (dueStr) {
        try {
          const dueData = JSON.parse(dueStr);
          dueData.lotNumber = '';
          if (dueData.memoState) {
            dueData.memoState.lotNumberInput = '';
            dueData.memoState.lotNumber = '';
          }
          localStorage.setItem(dueKey, JSON.stringify(dueData));
        } catch(e) {}
      }

      // Trigger storage event so both this screen and global list refresh
      window.dispatchEvent(new Event('storage'));
    }
  };

  const filteredMemos = memos.filter(memoId => {
    const memo = getMemoData(memoId);
    let status = 'draft';
    let cType = '';
    
    if (memo) {
      status = memo.status || 'draft';
      cType = memo.customerType || '';
    }

    let statusMatch = true;
    if (filter === 'paid') statusMatch = (status === 'paid');
    else if (filter === 'due') statusMatch = (status === 'due' || status === 'draft');

    let typeMatch = true;
    if (customerTypeFilter === 'regular') typeMatch = (cType === 'regular');
    else if (customerTypeFilter === 'permanent') typeMatch = (cType === 'permanent');

    return statusMatch && typeMatch;
  });

  return (
    <div className="lots-screen">
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => onNavigate('sales-lots')}>
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
            onChange={(e) => setCustomerTypeFilter(e.target.value as 'all' | 'regular' | 'permanent')}
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
        {filteredMemos.map((memoId, idx) => {
          const memoKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
          const memo = getMemoData(memoId);
          let name = `Memo ${memoId}`;
          let statusColor = '#aaa';
          let statusText = 'Draft';
          
          if (memo) {
            if (memo.customerName) {
              name = `${memo.customerName}`;
            }
            if (memo.status === 'paid') {
              statusColor = '#72be44';
              statusText = 'Paid';
            } else if (memo.status === 'due') {
              statusColor = '#ff9800';
              statusText = 'Due';
            }
          }
          
          return (
            <ProtectedMemoWrapper key={`sales_memo_${lotNumber}_${memoId}_${idx}`} passwordKey={`memo_password_${memoKey}`} onAccessGranted={() => onSelectMemo(memoId)}>
              <div className="lot-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="lot-status" style={{ margin: 0 }}>Memo {memoId}</span>
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: `${statusColor}33`, color: statusColor, fontWeight: 'bold' }}>
                      {statusText}
                    </span>
                  </div>
                  <span className="lot-number">{name}</span>
                </div>
                <div className="card-top-actions">
                  <button 
                    className="btn-icon delete-btn" 
                    onClick={(e) => handleDeleteMemo(memoId, e)} 
                    title={language === 'bn' ? 'লট থেকে সরান (মেমোটি গ্লোবাল মেমোতে থাকবে)' : 'Remove from lot (kept in global memos)'}
                    style={{ padding: '4px', margin: 0, color: '#ff5252' }}
                  >
                    <Trash2 size={16} />
                  </button>
                      </div>
                      <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                        <MemoLockIcon passwordKey={`memo_password_${memoKey}`} />
                      </div>
              </div>
            </div>
            </ProtectedMemoWrapper>
          );
        })}
        
        <div className="lot-card add-lot-card" onClick={handleAddMemo}>
          <div className="add-lot-content">
            <Plus size={48} />
            <h3>{t('newMemo')}</h3>
          </div>
        </div>
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



