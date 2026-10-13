import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { Plus, ChevronLeft, Package, Calendar, Trash2, FileText, Folder } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';
import { MONTHS, enToBnDigits } from '../utils/dateUtils';
import { getAllGlobalSalesMemos, type SalesMemoGlobalItem } from '../utils/dueSyncUtils';

interface SalesLotsScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectLot: (lotNumber: number) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
  onSelectMonth?: (monthIndex: number, year: number) => void;
}

type GlobalMemo = SalesMemoGlobalItem;

const SalesLotsScreen: React.FC<SalesLotsScreenProps> = ({ onNavigate, onSelectLot, onSelectMemo, onSelectMonth }) => {
  const [lots, setLots] = useState<number[]>(() => {
    const saved = localStorage.getItem('sales_lots_list');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [globalMemos, setGlobalMemos] = useState<GlobalMemo[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [showNewLotModal, setShowNewLotModal] = useState(false);
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newLotPassword, setNewLotPassword] = useState('');
  const { t, language } = useLanguage();
  const devicePermission = localStorage.getItem('device_permission');
  const hasEditPermission = devicePermission === 'edit' || devicePermission === 'admin';
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getMonthStats = (mIndex: number, yr: number) => {
    let count = 0;
    let totalAmount = 0;
    globalMemos.forEach(m => {
      if (m.month === mIndex && m.year === yr) {
        count++;
        totalAmount += m.totalAmount;
      }
    });
    return { count, totalAmount };
  };

  useEffect(() => {
    const loadGlobalMemos = () => {
      const allMemos = getAllGlobalSalesMemos();
      setGlobalMemos(allMemos);
    };



    loadGlobalMemos();

    window.addEventListener('storage', loadGlobalMemos);
    return () => window.removeEventListener('storage', loadGlobalMemos);
  }, [lots]);

  const handleAddLot = () => {
    const nextLot = lots.length > 0 ? Math.max(...lots) + 1 : 1;
    setNewLotNumber(nextLot.toString());
    setNewLotPassword('');
    setShowNewLotModal(true);
  };
  
  const handleAddMemo = () => {
    const listStr = localStorage.getItem(`sales_memo_list_unassigned`);
    const list = listStr ? JSON.parse(listStr) : [];
    const nextId = Date.now().toString();
    list.push(nextId);
    localStorage.setItem(`sales_memo_list_unassigned`, JSON.stringify(list));

    // Pre-initialize memo state
    const initialState = {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: '',
      paidAmount: '',
      customerType: 'regular',
      status: 'draft',
      createdAt: today,
      sellerSignature: localStorage.getItem('default_seller_signature') || '',
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', profitPercent: '' }]
    };
    localStorage.setItem(`sales_memo_${nextId}`, JSON.stringify(initialState));
    localStorage.setItem(`sales_memo_lot_unassigned_memo_${nextId}`, JSON.stringify(initialState));

    onSelectMemo(nextId, null);
  };

  const confirmAddLot = (skipPassword = false) => {
    const parsedNum = parseInt(newLotNumber, 10);
    const targetLot = (!isNaN(parsedNum) && parsedNum > 0)
      ? parsedNum
      : (lots.length > 0 ? Math.max(...lots) + 1 : 1);

    if (!lots.includes(targetLot)) {
      const newLots = [...lots, targetLot].sort((a, b) => a - b);
      setLots(newLots);
      localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
    }
    
    if (!skipPassword && newLotPassword.trim() !== '') {
      localStorage.setItem(`sales_lot_password_${targetLot}`, newLotPassword.trim());
    }
    
    setShowNewLotModal(false);
    onSelectLot(targetLot);
  };

  const handleDeleteLot = (lot: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`লট নম্বর ${lot} ফোল্ডারটি ডিলিট করতে চান? এই লটের মেমোগুলো অক্ষত থাকবে এবং "সকল মেমো (Global List)" এ দেখতে পাবেন।`)) {
      const newLots = lots.filter(l => l !== lot);
      setLots(newLots);
      localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
      localStorage.removeItem(`sales_lot_password_${lot}`);
      window.dispatchEvent(new Event('storage'));
    }
  };
  
  const handleDeleteMemo = (memo: GlobalMemo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this memo?')) {
      const lotKey = memo.lotNumber !== null ? memo.lotNumber : 'unassigned';
      
      // Clean up from all memo lists
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sales_memo_list_')) {
          try {
            const listStr = localStorage.getItem(k);
            if (listStr) {
              let list: string[] = JSON.parse(listStr);
              if (list.includes(memo.id)) {
                list = list.filter((id: string) => id !== memo.id);
                localStorage.setItem(k, JSON.stringify(list));
              }
            }
          } catch(e) {}
        }
      }
      
      const canonicalKey = `sales_memo_${memo.id}`;
      const memoDataStr = localStorage.getItem(canonicalKey) 
        || localStorage.getItem(`sales_memo_lot_${lotKey}_memo_${memo.id}`)
        || localStorage.getItem(`due_memo_${memo.id}`);

      if (memoDataStr) {
        moveToTrash({
          id: canonicalKey,
          type: 'sales_lot',
          title: `Sales Memo (Lot: ${lotKey}) - ${memo.name}`,
          data: JSON.parse(memoDataStr)
        });
      }
      
      // Remove all storage keys for this memo
      localStorage.removeItem(canonicalKey);
      localStorage.removeItem(`sales_memo_lot_${lotKey}_memo_${memo.id}`);
      localStorage.removeItem(`sales_memo_lot_unassigned_memo_${memo.id}`);
      for (let l = 1; l <= 50; l++) {
        localStorage.removeItem(`sales_memo_lot_${l}_memo_${memo.id}`);
      }
      localStorage.removeItem(`due_memo_${memo.id}`);
      
      setGlobalMemos(prev => prev.filter(m => m.id !== memo.id));
      window.dispatchEvent(new Event('storage'));
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

        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Total Lots</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{lots.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 152, 0, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#ff9800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Total Memos</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffb74d' }}>{globalMemos.length}</div>
          </div>
        </div>
      </div>

      <h3 className="screen-sub-container" style={{ margin: '1rem 0 0.5rem', opacity: 0.8, fontSize: '1.1rem' }}>ফোল্ডার / লটসমূহ</h3>
      <div className="lot-grid" style={{ marginBottom: '2rem' }}>
        {hasEditPermission && (
          <div className="lot-card add-lot-card" onClick={handleAddLot}>
          <div className="add-lot-content">
            <Package size={48} />
            <h3>ক্রিয়েট লট</h3>
          </div>
        </div>
        )}
        
        {lots.map((lot, idx) => (
              <ProtectedMemoWrapper key={`sales_lot_${lot}_${idx}`} passwordKey={`sales_lot_password_${lot}`} onAccessGranted={() => onSelectLot(lot)}>
              <div className="lot-card">
                    <div className="lot-card-header">
                      <Package size={40} className="lot-icon" />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="lot-status">{t('activeLot')}</span>
                      </div>
                      {hasEditPermission && (
                        <div className="card-top-actions">
                        <button className="btn-icon delete-btn" onClick={(e) => handleDeleteLot(lot, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
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
      
      {/* 12 Monthly Folders Ribbon/Grid */}
      <div className="screen-sub-container" style={{ margin: '1.5rem 0 1.2rem', borderTop: lots.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: lots.length > 0 ? '1.5rem' : '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={22} style={{ color: '#72be44' }} />
            <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1.15rem', fontWeight: 'bold' }}>
              {language === 'bn' ? `মাসভিত্তিক ফোল্ডারসমূহ (${enToBnDigits(selectedYear)})` : `Monthly Folders (${selectedYear})`}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '8px' }}>
            <button 
              className="btn-icon" 
              style={{ padding: '2px 6px', margin: 0, fontSize: '0.85rem' }}
              onClick={() => setSelectedYear(prev => prev - 1)}
              title="পূর্ববর্তী বছর"
            >
              ◀
            </button>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', minWidth: '45px', textAlign: 'center' }}>
              {language === 'bn' ? enToBnDigits(selectedYear) : selectedYear}
            </span>
            <button 
              className="btn-icon" 
              style={{ padding: '2px 6px', margin: 0, fontSize: '0.85rem' }}
              onClick={() => setSelectedYear(prev => prev + 1)}
              title="পরবর্তী বছর"
            >
              ▶
            </button>
          </div>
        </div>

        {/* 12 Months Cards Scroll Container */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          overflowX: 'auto',
          paddingBottom: '0.8rem',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch'
        }}>
          {MONTHS.map(m => {
            const mStats = getMonthStats(m.index, selectedYear);
            return (
              <div
                key={m.index}
                onClick={() => onSelectMonth && onSelectMonth(m.index, selectedYear)}
                style={{
                  flex: '0 0 auto',
                  minWidth: '135px',
                  background: mStats.count > 0 
                    ? 'linear-gradient(135deg, rgba(20, 60, 40, 0.85), rgba(10, 35, 22, 0.95))' 
                    : 'rgba(255, 255, 255, 0.04)',
                  border: mStats.count > 0 
                    ? '1px solid rgba(114, 190, 68, 0.45)' 
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold' }}>
                    {language === 'bn' ? enToBnDigits(m.index.toString().padStart(2, '0')) : m.index.toString().padStart(2, '0')}
                  </span>
                  <Folder size={18} style={{ color: mStats.count > 0 ? '#72be44' : '#666' }} />
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '0.98rem', color: '#fff' }}>
                  {language === 'bn' ? m.nameBn : m.nameEn}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', color: mStats.count > 0 ? '#72be44' : '#666', fontWeight: 'bold' }}>
                    {language === 'bn' ? enToBnDigits(mStats.count) : mStats.count} {language === 'bn' ? 'টি মেমো' : 'memos'}
                  </span>
                  {mStats.totalAmount > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#ffb74d', fontWeight: 'bold' }}>
                      ৳{Math.round(mStats.totalAmount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h3 className="screen-sub-container" style={{ margin: '1rem 0 0.5rem', opacity: 0.8, fontSize: '1.1rem' }}>
        সকল মেমো (Global List)
      </h3>
      
      <div className="lot-grid">
        {hasEditPermission && (
          <div className="lot-card add-lot-card" onClick={handleAddMemo}>
          <div className="add-lot-content">
            <Plus size={48} />
            <h3>নতুন মেমো</h3>
          </div>
        </div>
        )}

        {globalMemos.map(memo => (
            <ProtectedMemoWrapper key={memo.uniqueKey} passwordKey={`memo_password_${memo.id}`} onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber)}>
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
                  <button className="btn-icon delete-btn" onClick={(e) => handleDeleteMemo(memo, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                    <Trash2 size={16} />
                  </button>
                      </div>
                    )}
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
              <h2 className="modal-title">নতুন লট ফোল্ডার তৈরি করুন</h2>
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <label>লট নম্বর</label>
              <input 
                type="number" 
                value={newLotNumber}
                onChange={(e) => setNewLotNumber(e.target.value)}
                placeholder="লট নম্বর লিখুন (যেমন: 1, 2, 3)"
                className="modal-input"
                min="1"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>পাসওয়ার্ড (ঐচ্ছিক)</label>
              <input 
                type="password" 
                value={newLotPassword}
                onChange={(e) => setNewLotPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন..."
                className="modal-input"
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



