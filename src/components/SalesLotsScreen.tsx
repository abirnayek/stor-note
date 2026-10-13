import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { Plus, ChevronLeft, Package, Calendar, Trash2, FileText, Folder } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';
import { MONTHS, parseMemoMonthYear, enToBnDigits } from '../utils/dateUtils';

interface SalesLotsScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectLot: (lotNumber: number) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
  onSelectMonth?: (monthIndex: number, year: number) => void;
}

interface GlobalMemo {
  uniqueKey: string;
  id: string;
  lotNumber: number | null;
  name: string;
  statusText: string;
  statusColor: string;
  timestamp: number;
  totalAmount: number;
  sourceKey?: string;
  month?: number;
  year?: number;
  dateStr?: string;
  timeStr?: string;
}

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
      const allMemosMap = new Map<string, GlobalMemo>();

      // Read local_timestamps for exact, stable save timestamps
      let localTimestamps: Record<string, number> = {};
      try {
        const tsRaw = localStorage.getItem('local_timestamps');
        if (tsRaw) localTimestamps = JSON.parse(tsRaw);
      } catch (e) {}

      const bnToEn = (str: string) => {
        const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
        let s = str;
        bnDigits.forEach((d, i) => { s = s.split(d).join(i.toString()); });
        const months: Record<string, string> = {
          'জানু': 'Jan', 'ফেব': 'Feb', 'মার্চ': 'Mar', 'এপ্রি': 'Apr', 'মে': 'May', 'জুন': 'Jun',
          'জুল': 'Jul', 'আগ': 'Aug', 'সেপ্টে': 'Sep', 'অক্টো': 'Oct', 'নভে': 'Nov', 'ডিসে': 'Dec'
        };
        Object.entries(months).forEach(([bn, en]) => { s = s.split(bn).join(en); });
        return s;
      };

      const processMemo = (memoId: string, lotKey: number | null, memoObj: any, sourceKey?: string) => {
        if (!memoId || !memoObj) return;

        const rawLot = (memoObj.lotNumberInput !== undefined && memoObj.lotNumberInput !== '') 
          ? memoObj.lotNumberInput 
          : (memoObj.lotNumber !== undefined && memoObj.lotNumber !== '' ? memoObj.lotNumber : lotKey);
        const parsedLot = (rawLot !== null && !isNaN(Number(rawLot)) && Number(rawLot) > 0) ? Number(rawLot) : null;
        const effectiveLot = parsedLot;

        // Determine stable timestamp
        let timestamp = 0;
        if (sourceKey && localTimestamps[sourceKey]) {
          timestamp = Number(localTimestamps[sourceKey]);
        }
        if (!timestamp && localTimestamps[`sales_memo_${memoId}`]) {
          timestamp = Number(localTimestamps[`sales_memo_${memoId}`]);
        }
        if (!timestamp && effectiveLot !== null && localTimestamps[`sales_memo_lot_${effectiveLot}_memo_${memoId}`]) {
          timestamp = Number(localTimestamps[`sales_memo_lot_${effectiveLot}_memo_${memoId}`]);
        }
        if (!timestamp && localTimestamps[`due_memo_${memoId}`]) {
          timestamp = Number(localTimestamps[`due_memo_${memoId}`]);
        }
        if (!timestamp && memoObj.updatedAt) {
          const parsed = Date.parse(memoObj.updatedAt);
          if (!isNaN(parsed)) timestamp = parsed;
        }
        if (!timestamp && (memoObj.createdAt || memoObj.date)) {
          const rawDate = String(memoObj.createdAt || memoObj.date);
          const parsed = Date.parse(rawDate);
          if (!isNaN(parsed)) timestamp = parsed;
          else {
            const enParsed = Date.parse(bnToEn(rawDate));
            if (!isNaN(enParsed)) timestamp = enParsed;
          }
        }
        if (!timestamp && !isNaN(Number(memoId)) && Number(memoId) > 1000000000) {
          timestamp = Number(memoId);
        }
        if (!timestamp) {
          const numId = Number(memoId);
          timestamp = !isNaN(numId) ? numId : 0;
        }

        // Deduplicate strictly by memoId:
        if (allMemosMap.has(memoId)) {
          const existing = allMemosMap.get(memoId)!;
          // If existing came from canonical sales_memo_${memoId}, canonical is the authoritative master!
          if (existing.sourceKey === `sales_memo_${memoId}`) {
            return;
          }
          if (sourceKey === `sales_memo_${memoId}`) {
            // Canonical takes precedence over secondary keys
          } else if (existing.lotNumber === null && effectiveLot !== null) {
            // Prefer version with lot number over unassigned
          } else if (existing.lotNumber !== null && effectiveLot === null) {
            return; // Keep existing with lot assigned
          } else if (timestamp <= existing.timestamp) {
            return; // Keep existing newer
          }
        }

        let name = memoObj.customerName || memoObj.name || memoObj.supplierName || `Memo ${memoId}`;
        let statusColor = '#aaa';
        let statusText = 'Draft';
        let totalAmount = 0;

        if (memoObj.status === 'paid' || memoObj.paidDate) {
          statusColor = '#72be44';
          statusText = 'Paid';
        } else if (memoObj.status === 'due' || memoObj.deposit !== undefined || memoObj.dueId) {
          statusColor = '#ff9800';
          statusText = 'Due';
        }

        if (memoObj.entries && Array.isArray(memoObj.entries)) {
          memoObj.entries.forEach((entry: any) => {
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

        if (totalAmount === 0 && memoObj.totalBill) {
          totalAmount = Number(memoObj.totalBill) || 0;
        }

        const { month: mIdx, year: mYear, dateStr, timeStr } = parseMemoMonthYear(memoObj, timestamp);

        allMemosMap.set(memoId, {
          uniqueKey: memoId,
          id: memoId,
          lotNumber: effectiveLot,
          name,
          statusText,
          statusColor,
          timestamp,
          totalAmount,
          sourceKey,
          month: mIdx,
          year: mYear,
          dateStr: dateStr || memoObj.createdAt || '',
          timeStr: timeStr || memoObj.createdAtTime || ''
        });
      };

      // 1. Scan canonical sales_memo_* keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
          const memoId = key.replace('sales_memo_', '');
          try {
            const memoObj = JSON.parse(localStorage.getItem(key) || '{}');
            processMemo(memoId, null, memoObj, key);
          } catch(e) {}
        }
      }

      // 2. Scan direct sales_memo_lot_*_memo_* keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sales_memo_lot_') && key.includes('_memo_')) {
          const parts = key.split('_memo_');
          if (parts.length === 2) {
            const memoId = parts[1];
            try {
              const memoObj = JSON.parse(localStorage.getItem(key) || '{}');
              let lotNum: number | null = null;
              const lotPart = parts[0].replace('sales_memo_lot_', '');
              if (lotPart !== 'unassigned' && !isNaN(Number(lotPart))) {
                lotNum = Number(lotPart);
              }
              processMemo(memoId, lotNum, memoObj, key);
            } catch(e) {}
          }
        }
      }

      // 3. Scan sales_memo_list_* keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        if (key.startsWith('sales_memo_list_')) {
          try {
            const listStr = localStorage.getItem(key);
            if (listStr) {
              const memoIds: string[] = JSON.parse(listStr);
              let lotKeyNum: number | null = null;
              const rawLotStr = key.replace('sales_memo_list_lot_', '').replace('sales_memo_list_', '');
              if (rawLotStr !== 'unassigned' && !isNaN(Number(rawLotStr))) {
                lotKeyNum = Number(rawLotStr);
              }

              memoIds.forEach(memoId => {
                if (allMemosMap.has(memoId)) return;
                const possibleDataKeys = [
                  `sales_memo_${memoId}`,
                  `sales_memo_lot_${lotKeyNum ?? 'unassigned'}_memo_${memoId}`,
                  `sales_memo_lot_unassigned_memo_${memoId}`,
                  `due_memo_${memoId}`
                ];
                for (let l = 1; l <= 50; l++) {
                  possibleDataKeys.push(`sales_memo_lot_${l}_memo_${memoId}`);
                }

                let foundData: any = null;
                let foundKey = '';
                for (const dKey of possibleDataKeys) {
                  const str = localStorage.getItem(dKey);
                  if (str) {
                    try { 
                      foundData = JSON.parse(str); 
                      foundKey = dKey;
                      break; 
                    } catch(e) {}
                  }
                }

                if (foundData) {
                  processMemo(memoId, lotKeyNum, foundData, foundKey);
                } else {
                  const dueStr = localStorage.getItem(`due_memo_${memoId}`);
                  if (dueStr) {
                    try { processMemo(memoId, lotKeyNum, JSON.parse(dueStr), `due_memo_${memoId}`); } catch(e) {}
                  }
                }
              });
            }
          } catch(e) {}
        }
      }

      // 4. Direct scan of all due_memo_* keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('due_memo_')) {
          const memoId = key.replace('due_memo_', '');
          try {
            const dueObj = JSON.parse(localStorage.getItem(key) || '{}');
            if (dueObj.type === 'regular' || dueObj.type === 'permanent' || dueObj.customerName || (dueObj.name && dueObj.type !== 'purchase')) {
              let lotNum: number | null = null;
              if (dueObj.lotNumber && !isNaN(Number(dueObj.lotNumber))) {
                lotNum = Number(dueObj.lotNumber);
              }
              processMemo(memoId, lotNum, dueObj.memoState || dueObj, key);
            }
          } catch(e) {}
        }
      }

      // 5. Scan dues_regular and dues_permanent arrays
      ['dues_regular', 'dues_permanent'].forEach(dueType => {
        const duesStr = localStorage.getItem(dueType);
        if (duesStr) {
          try {
            const dueIds: string[] = JSON.parse(duesStr);
            dueIds.forEach(dueId => {
              const dueDataStr = localStorage.getItem(`due_memo_${dueId}`);
              if (dueDataStr) {
                try {
                  const dueObj = JSON.parse(dueDataStr);
                  processMemo(dueId, null, dueObj.memoState || dueObj, `due_memo_${dueId}`);
                } catch(e) {}
              }
            });
          } catch(e) {}
        }
      });

      const allMemos = Array.from(allMemosMap.values());
      
      // Deterministic 4-level stable sorting: prevents any jumping/shuffling
      allMemos.sort((a, b) => {
        // 1. Primary: descending by timestamp (newest first)
        if (b.timestamp !== a.timestamp) {
          return b.timestamp - a.timestamp;
        }
        // 2. Secondary tie-breaker: Lot Number (Lot 2 before Lot 1)
        const lotA = a.lotNumber ?? -1;
        const lotB = b.lotNumber ?? -1;
        if (lotB !== lotA) {
          return lotB - lotA;
        }
        // 3. Tertiary tie-breaker: Memo ID descending
        if (a.id !== b.id) {
          const numA = Number(a.id);
          const numB = Number(b.id);
          if (!isNaN(numA) && !isNaN(numB)) {
            return numB - numA;
          }
          return b.id.localeCompare(a.id, undefined, { numeric: true });
        }
        // 4. Quaternary tie-breaker: Name alphabetical
        return a.name.localeCompare(b.name);
      });

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

      <h3 style={{ margin: '1rem 0', opacity: 0.8, fontSize: '1.1rem' }}>ফোল্ডার / লটসমূহ</h3>
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
      <div style={{ margin: '1.5rem 0 1.2rem', borderTop: lots.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: lots.length > 0 ? '1.5rem' : '0' }}>
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

      <h3 style={{ margin: '1rem 0', opacity: 0.8, fontSize: '1.1rem' }}>
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



