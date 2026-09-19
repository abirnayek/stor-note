import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Filter } from 'lucide-react';
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
  const { t } = useLanguage();

  useEffect(() => {
    // Migration logic for old single memo format
    const oldMemoKey = `sales_memo_lot_${lotNumber}`;
    const oldMemoStr = localStorage.getItem(oldMemoKey);
    
    const memoListKey = `sales_memo_list_${lotNumber}`;
    let savedList = localStorage.getItem(memoListKey);
    
    if (oldMemoStr && !savedList) {
      // Migrate
      const firstMemoId = '1';
      localStorage.setItem(`sales_memo_lot_${lotNumber}_memo_${firstMemoId}`, oldMemoStr);
      localStorage.removeItem(oldMemoKey);
      
      const newList = [firstMemoId];
      localStorage.setItem(memoListKey, JSON.stringify(newList));
      setMemos(newList);
    } else if (savedList) {
      setMemos(JSON.parse(savedList));
    }
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
    const memoKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
    const memoStr = localStorage.getItem(memoKey);
    let status = 'draft';
    let cType = '';
    
    if (memoStr) {
      try {
        const memo = JSON.parse(memoStr);
        status = memo.status || 'draft';
        cType = memo.customerType || '';
      } catch (e) {}
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
          <h2>{t('salesAccount')} {lotNumber} - Memos</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
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
        {filteredMemos.map(memoId => {
          const memoKey = `sales_memo_lot_${lotNumber}_memo_${memoId}`;
          const memoStr = localStorage.getItem(memoKey);
          let name = `Memo ${memoId}`;
          let statusColor = '#aaa';
          let statusText = 'Draft';
          
          if (memoStr) {
            try {
              const memo = JSON.parse(memoStr);
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
            } catch (e) {}
          }
          
          return (
            <div key={memoId} className="lot-card" onClick={() => onSelectMemo(memoId)}>
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
                <button className="btn-icon delete-btn" onClick={(e) => handleDeleteMemo(memoId, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        
        <div className="lot-card add-lot-card" onClick={handleAddMemo}>
          <div className="add-lot-content">
            <Plus size={48} />
            <h3>New Memo</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesMemoListScreen;

