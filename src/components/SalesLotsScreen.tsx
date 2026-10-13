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
  uniqueKey: string;
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
        const rawLot = lotKey !== null ? lotKey : (memoObj.lotNumberInput ? Number(memoObj.lotNumberInput) : (memoObj.lotNumber ? Number(memoObj.lotNumber) : null));
        const effectiveLot = (rawLot !== null && !isNaN(rawLot)) ? rawLot : null;
        
        // Globally unique identity per memo so different lots don't collide, and duplicate scans merge cleanly
        const uniqueKey = effectiveLot !== null ? `lot_${effectiveLot}_memo_${memoId}` : `unassigned_memo_${memoId}`;

        if (allMemosMap.has(uniqueKey)) return;

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

        // Determine stable timestamp (must be 100% deterministic, never dynamic Date.now())
        let timestamp = 0;

        // 1. Check local_timestamps
        if (sourceKey && localTimestamps[sourceKey]) {
          timestamp = Number(localTimestamps[sourceKey]);
        }
        if (!timestamp && effectiveLot !== null && localTimestamps[`sales_memo_lot_${effectiveLot}_memo_${memoId}`]) {
          timestamp = Number(localTimestamps[`sales_memo_lot_${effectiveLot}_memo_${memoId}`]);
        }
        if (!timestamp && localTimestamps[`due_memo_${memoId}`]) {
          timestamp = Number(localTimestamps[`due_memo_${memoId}`]);
        }

        // 2. Check memoObj.updatedAt
        if (!timestamp && memoObj.updatedAt) {
          const parsed = Date.parse(memoObj.updatedAt);
          if (!isNaN(parsed)) timestamp = parsed;
        }

        // 3. Check memoObj.createdAt or memoObj.date (with Bengali conversion)
        if (!timestamp && (memoObj.createdAt || memoObj.date)) {
          const rawDate = String(memoObj.createdAt || memoObj.date);
          const parsed = Date.parse(rawDate);
          if (!isNaN(parsed)) {
            timestamp = parsed;
          } else {
            const enParsed = Date.parse(bnToEn(rawDate));
            if (!isNaN(enParsed)) timestamp = enParsed;
          }
        }

        // 4. If memoId is a millisecond timestamp
        if (!timestamp && !isNaN(Number(memoId)) && Number(memoId) > 1000000000) {
          timestamp = Number(memoId);
        }

        // 5. Stable fallback: numeric ID or 0 (NEVER random Date.now())
        if (!timestamp) {
          const numId = Number(memoId);
          timestamp = !isNaN(numId) ? numId : 0;
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

        allMemosMap.set(uniqueKey, {
          uniqueKey,
          id: memoId,
          lotNumber: effectiveLot,
          name,
          statusText,
          statusColor,
          timestamp,
          totalAmount
        });
      };

      // 1. Scan all sales_memo_list_* keys
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
                const possibleDataKeys = [
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

      // 2. Direct scan of all sales_memo_lot_*_memo_* keys
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

      // 3. Direct scan of all due_memo_* keys
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

      // 4. Scan dues_regular and dues_permanent arrays
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
      
      <h3 style={{ margin: '1rem 0', opacity: 0.8, fontSize: '1.1rem', borderTop: lots.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: lots.length > 0 ? '1.5rem' : '0' }}>
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



