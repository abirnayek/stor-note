import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { Plus, ChevronLeft, Package, Calendar, Trash2, FileText } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';

interface SalesLotsScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectLot: (lotNumber: number) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
}

interface GlobalMemo {
  id: string;
  lotNumber: number | null;
  name: string;
  statusText: string;
  statusColor: string;
  timestamp: number;
  totalAmount: number;
}

const SalesLotsScreen: React.FC<SalesLotsScreenProps> = ({ onNavigate, onSelectLot, onSelectMemo }) => {
  const [lots, setLots] = useState<number[]>(() => {
    const saved = localStorage.getItem('sales_lots_list');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [globalMemos, setGlobalMemos] = useState<GlobalMemo[]>([]);
      const [showNewLotModal, setShowNewLotModal] = useState(false);
  const [newLotPassword, setNewLotPassword] = useState('');
  const { t, language } = useLanguage();
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  useEffect(() => {
    const loadGlobalMemos = () => {
      const allMemos: GlobalMemo[] = [];
      const lotKeys: (number | 'unassigned')[] = [...lots, 'unassigned'];

      lotKeys.forEach(lotKey => {
        const listStr = localStorage.getItem(`sales_memo_list_${lotKey}`);
        if (listStr) {
          try {
            const memoIds = JSON.parse(listStr);
            memoIds.forEach((memoId: string) => {
              const memoStr = localStorage.getItem(`sales_memo_lot_${lotKey}_memo_${memoId}`);
              let name = `Memo ${memoId}`;
              let statusColor = '#aaa';
              let statusText = 'Draft';
              let timestamp = Number(memoId) || Date.now();
              let totalAmount = 0;
              
              if (memoStr) {
                try {
                  const memo = JSON.parse(memoStr);
                  if (memo.customerName) name = memo.customerName;
                  if (memo.status === 'paid') {
                    statusColor = '#72be44';
                    statusText = 'Paid';
                  } else if (memo.status === 'due') {
                    statusColor = '#ff9800';
                    statusText = 'Due';
                  }
                  // try parsing timestamp from created at or just use id
                  if (memo.createdAt) {
                    const parsed = Date.parse(memo.createdAt);
                    if (!isNaN(parsed)) timestamp = parsed;
                  }
                  
                  // calculate total amount
                  if (memo.entries && Array.isArray(memo.entries)) {
                    memo.entries.forEach((entry: any) => {
                      let baseRate = 0;
                      if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
                        baseRate = Number(entry.manualSaleRate);
                      } else {
                        baseRate = Number(entry.buyRate) || 0;
                      }
                      let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
                      let finalRate = baseRate + (baseRate * currentProfitPercent / 100);
                      let totalKgNum = Number(entry.totalKg) || 0;
                      let weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
                      if (weightInKg > 0 && finalRate > 0) {
                        totalAmount += weightInKg * finalRate;
                      }
                    });
                  }
                } catch(e) {}
              }
              
              allMemos.push({
                id: memoId,
                lotNumber: lotKey === 'unassigned' ? null : Number(lotKey),
                name,
                statusText,
                statusColor,
                timestamp,
                totalAmount
              });
            });
          } catch(e) {}
        }
      });
      
      allMemos.sort((a, b) => b.timestamp - a.timestamp);
      setGlobalMemos(allMemos);
    };
    
    loadGlobalMemos();
    
    window.addEventListener('storage', loadGlobalMemos);
    return () => window.removeEventListener('storage', loadGlobalMemos);
  }, [lots]);

  const handleAddLot = () => {
    setShowNewLotModal(true);
    setNewLotPassword('');
  };
  
  const handleAddMemo = () => {
    const listStr = localStorage.getItem(`sales_memo_list_unassigned`);
    const list = listStr ? JSON.parse(listStr) : [];
    const nextId = Date.now().toString();
    list.push(nextId);
    localStorage.setItem(`sales_memo_list_unassigned`, JSON.stringify(list));
    onSelectMemo(nextId, null);
  };

  const confirmAddLot = (skipPassword = false) => {
    const nextLot = lots.length > 0 ? Math.max(...lots) + 1 : 1;
    const newLots = [...lots, nextLot];
    setLots(newLots);
    localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
    
    if (!skipPassword && newLotPassword.trim() !== '') {
      localStorage.setItem(`sales_lot_password_${nextLot}`, newLotPassword.trim());
    }
    
    setShowNewLotModal(false);
    onSelectLot(nextLot);
  };

  const handleDeleteLot = (lot: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this Lot and ALL its memos?')) {
      const listStr = localStorage.getItem(`sales_memo_list_${lot}`);
      if (listStr) {
        try {
           const memoIds = JSON.parse(listStr);
           memoIds.forEach((mId: string) => {
             const key = `sales_memo_lot_${lot}_memo_${mId}`;
             localStorage.removeItem(key);
           });
        } catch(e){}
      }
      localStorage.removeItem(`sales_memo_list_${lot}`);

      const newLots = lots.filter(l => l !== lot);
      setLots(newLots);
      localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
    }
  };
  
  const handleDeleteMemo = (memo: GlobalMemo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this memo?')) {
      const lotKey = memo.lotNumber !== null ? memo.lotNumber : 'unassigned';
      const listStr = localStorage.getItem(`sales_memo_list_${lotKey}`);
      if (listStr) {
        let list = JSON.parse(listStr);
        list = list.filter((id: string) => id !== memo.id);
        localStorage.setItem(`sales_memo_list_${lotKey}`, JSON.stringify(list));
      }
      
      const key = `sales_memo_lot_${lotKey}_memo_${memo.id}`;
      const memoDataStr = localStorage.getItem(key);
      if (memoDataStr) {
        moveToTrash({
          id: key,
          type: 'sales_lot',
          title: `Sales Memo (Lot: ${lotKey}) - ${memo.name}`,
          data: JSON.parse(memoDataStr)
        });
      }
      localStorage.removeItem(key);
      
      setGlobalMemos(prev => prev.filter(m => m.id !== memo.id));
    }
  };

    return (
    <div className="lots-screen" style={{ paddingBottom: '2rem' }}>
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={24} />
          </button>
          <h2>{t('salesAccount')}</h2>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Lots</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>{lots.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 152, 0, 0.1)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#ff9800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Memos</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffb74d' }}>{globalMemos.length}</div>
          </div>
        </div>
      </div>

      <h3 style={{ margin: '1rem 0', opacity: 0.8, fontSize: '1.1rem' }}>ফোল্ডার / লটসমূহ</h3>
      <div className="lot-grid" style={{ marginBottom: '2rem' }}>
        <div className="lot-card add-lot-card" onClick={handleAddLot}>
          <div className="add-lot-content">
            <Package size={48} />
            <h3>ক্রিয়েট লট</h3>
          </div>
        </div>
        
        {lots.map(lot => (
              <ProtectedMemoWrapper key={lot} passwordKey={`sales_lot_password_${lot}`} onAccessGranted={() => onSelectLot(lot)}>
              <div className="lot-card">
                    <div className="lot-card-header">
                      <Package size={40} className="lot-icon" />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="lot-status">{t('activeLot')}</span>
                      </div>
                      <div className="card-top-actions">
                        <button className="btn-icon delete-btn" onClick={(e) => handleDeleteLot(lot, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                        <MemoLockIcon passwordKey={`sales_lot_password_${lot}`} />
                      </div>
                    </div>
                    <div className="lot-card-body">
                      <h3>লট নাম্বার {lot.toString().padStart(2, '0')}</h3>
                      <div className="lot-date">
                        <Calendar size={14} /> 
                        <span>{today}</span>
                      </div>
                    </div>
              </div>
              </ProtectedMemoWrapper>
            ))}
          </div>
      
      <h3 style={{ margin: '1rem 0', opacity: 0.8, fontSize: '1.1rem', borderTop: lots.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: lots.length > 0 ? '1.5rem' : '0' }}>
        সকল মেমো (Global List)
      </h3>
      
      <div className="lot-grid">
        <div className="lot-card add-lot-card" onClick={handleAddMemo}>
          <div className="add-lot-content">
            <Plus size={48} />
            <h3>নতুন মেমো</h3>
          </div>
        </div>

        {globalMemos.map(memo => (
            <ProtectedMemoWrapper key={memo.id} passwordKey={`memo_password_${memo.id}`} onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber)}>
            <div className="lot-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} style={{ opacity: 0.7 }} />
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{memo.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: `${memo.statusColor}33`, color: memo.statusColor, fontWeight: 'bold' }}>
                      {memo.statusText}
                    </span>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      Lot: {memo.lotNumber !== null ? memo.lotNumber : 'N/A'}
                    </span>
                    {memo.totalAmount > 0 && (
                      <span style={{ fontSize: '0.8rem', background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        ৳ {memo.totalAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="card-top-actions">
                  <button className="btn-icon delete-btn" onClick={(e) => handleDeleteMemo(memo, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                    <Trash2 size={16} />
                  </button>
                      </div>
                      <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                        <MemoLockIcon passwordKey={`memo_password_${memo.id}`} />
                      </div>
              </div>
            </div>
            </ProtectedMemoWrapper>
          ))}
      </div>

      {showNewLotModal && (
        <div className="modal-overlay" onClick={() => setShowNewLotModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">লটের পাসওয়ার্ড সেট করুন</h2>
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>পাসওয়ার্ড (ঐচ্ছিক)</label>
              <input 
                type="password" 
                value={newLotPassword}
                onChange={(e) => setNewLotPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন..."
                className="modal-input"
                autoFocus
              />
            </div>
            
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => confirmAddLot(true)} style={{ flex: 1 }}>
                Skip (পাসওয়ার্ড ছাড়া)
              </button>
              <button className="btn btn-primary" onClick={() => confirmAddLot(false)} style={{ flex: 1 }}>
                লট তৈরি করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesLotsScreen;


