import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Filter, Lock } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';

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
  const { t } = useLanguage();

  const getMemoData = (memoId: string) => {
    const memoKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
    let memoStr = localStorage.getItem(memoKey);
    if (!memoStr) {
      memoStr = localStorage.getItem(`sales_memo_lot_unassigned_memo_${memoId}`);
    }
    if (!memoStr) {
      for (let l = 1; l <= 50; l++) {
        const s = localStorage.getItem(`sales_memo_lot_${l}_memo_${memoId}`);
        if (s) { memoStr = s; break; }
      }
    }
    if (!memoStr) {
      memoStr = localStorage.getItem(`due_memo_${memoId}`);
    }
    if (memoStr) {
      try {
        const parsed = JSON.parse(memoStr);
        if (!localStorage.getItem(memoKey)) {
          localStorage.setItem(memoKey, JSON.stringify(parsed.memoState || parsed));
        }
        return parsed.memoState || parsed;
      } catch(e) {}
    }
    return null;
  };

  useEffect(() => {
    const loadMemos = () => {
      // Migration logic for old single memo format
      const oldMemoKey = `sales_memo_lot_${lotNumber}`;
      const oldMemoStr = localStorage.getItem(oldMemoKey);
      
      const memoListKey = `sales_memo_list_${lotNumber}`;
      let savedListStr = localStorage.getItem(memoListKey);
      
      if (oldMemoStr && !savedListStr) {
        // Migrate
        const firstMemoId = '1';
        localStorage.setItem(`sales_memo_lot_${lotNumber}_memo_${firstMemoId}`, oldMemoStr);
        localStorage.removeItem(oldMemoKey);
        
        const newList = [firstMemoId];
        localStorage.setItem(memoListKey, JSON.stringify(newList));
        savedListStr = JSON.stringify(newList);
      }

      const foundMemoIds = new Set<string>();
      if (savedListStr) {
        try {
          const listArr: string[] = JSON.parse(savedListStr);
          listArr.forEach(id => foundMemoIds.add(id));
        } catch(e) {}
      }

      // Comprehensive scan for all memos belonging to this lot
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // Pattern 1: sales_memo_lot_{lotNumber}_memo_{id}
        if (key.startsWith(`sales_memo_lot_${lotNumber}_memo_`)) {
          const id = key.replace(`sales_memo_lot_${lotNumber}_memo_`, '');
          if (id) foundMemoIds.add(id);
        }

        // Pattern 2: any sales memo where lotNumberInput == lotNumber
        if (key.startsWith('sales_memo_lot_') && key.includes('_memo_')) {
          const parts = key.split('_memo_');
          const id = parts[1];
          if (id && !foundMemoIds.has(id)) {
            try {
              const str = localStorage.getItem(key);
              if (str) {
                const parsed = JSON.parse(str);
                const memoLot = parsed.lotNumberInput ? parseInt(parsed.lotNumberInput, 10) : (parsed.lotNumber ? parseInt(parsed.lotNumber, 10) : null);
                if (memoLot === lotNumber) {
                  foundMemoIds.add(id);
                  const targetKey = `sales_memo_lot_${lotNumber}_memo_${id}`;
                  if (!localStorage.getItem(targetKey)) {
                    localStorage.setItem(targetKey, str);
                  }
                }
              }
            } catch(e) {}
          }
        }

        // Pattern 3: due_memo_* where lotNumber == lotNumber
        if (key.startsWith('due_memo_')) {
          const id = key.replace('due_memo_', '');
          if (id && !foundMemoIds.has(id)) {
            try {
              const str = localStorage.getItem(key);
              if (str) {
                const parsed = JSON.parse(str);
                const memoLot = parsed.lotNumber ? parseInt(parsed.lotNumber, 10) : (parsed.memoState?.lotNumberInput ? parseInt(parsed.memoState.lotNumberInput, 10) : null);
                if (memoLot === lotNumber) {
                  foundMemoIds.add(id);
                  const targetKey = `sales_memo_lot_${lotNumber}_memo_${id}`;
                  if (!localStorage.getItem(targetKey)) {
                    localStorage.setItem(targetKey, JSON.stringify(parsed.memoState || parsed));
                  }
                }
              }
            } catch(e) {}
          }
        }
      }

      const finalMemos = Array.from(foundMemoIds);
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
    if (window.confirm('Are you sure you want to delete this memo?')) {
      const memoKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
      const memoDataStr = localStorage.getItem(memoKey);
      const memoData = memoDataStr ? JSON.parse(memoDataStr) : {};
      
      moveToTrash({
        id: `sales_memo_lot_${lotNumber}_memo_${memoId}`,
        type: 'sales_lot',
        title: `Sales Lot ${lotNumber} - Memo ${memoId}`,
        data: memoData
      });

      const newMemos = memos.filter(m => m !== memoId);
      setMemos(newMemos);
      localStorage.setItem(`sales_memo_list_${lotNumber}`, JSON.stringify(newMemos));
      localStorage.removeItem(memoKey);
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
                  <button className="btn-icon delete-btn" onClick={(e) => handleDeleteMemo(memoId, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
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



