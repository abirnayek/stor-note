import React, { useState, useEffect, useMemo } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Calendar, FileText, Trash2, Search, Filter } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { MONTHS, parseMemoMonthYear, enToBnDigits } from '../utils/dateUtils';
import { moveToTrash } from '../utils/trashUtils';

interface MonthlySalesScreenProps {
  onNavigate: (screen: Screen) => void;
  monthIndex: number;
  year: number;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
  onBack: () => void;
}

interface MonthlyMemo {
  id: string;
  name: string;
  lotNumber: number | null;
  status: 'paid' | 'due' | 'draft';
  statusText: string;
  statusColor: string;
  dateStr: string;
  timeStr: string;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  timestamp: number;
}

const MonthlySalesScreen: React.FC<MonthlySalesScreenProps> = ({
  monthIndex,
  year,
  onSelectMemo,
  onBack
}) => {
  const { language } = useLanguage();
  const [memos, setMemos] = useState<MonthlyMemo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'paid' | 'due'>('all');

  const monthObj = MONTHS.find(m => m.index === monthIndex) || MONTHS[0];
  const monthName = language === 'bn' ? monthObj.nameBn : monthObj.nameEn;
  const displayYear = language === 'bn' ? enToBnDigits(year) : year.toString();

  const loadMonthMemos = () => {
    const foundMemosMap = new Map<string, MonthlyMemo>();

    let localTimestamps: Record<string, number> = {};
    try {
      const tsRaw = localStorage.getItem('local_timestamps');
      if (tsRaw) localTimestamps = JSON.parse(tsRaw);
    } catch (e) {}

    const processItem = (id: string, rawData: any, sourceKey?: string) => {
      if (!id || !rawData) return;
      const memo = rawData.memoState || rawData;

      let ts = sourceKey && localTimestamps[sourceKey] ? Number(localTimestamps[sourceKey]) : 0;
      if (!ts && localTimestamps[`sales_memo_${id}`]) {
        ts = Number(localTimestamps[`sales_memo_${id}`]);
      }
      if (!ts && memo.updatedAt) {
        const p = Date.parse(memo.updatedAt);
        if (!isNaN(p)) ts = p;
      }
      if (!ts && !isNaN(Number(id)) && Number(id) > 1000000000) {
        ts = Number(id);
      }

      const { month: mIdx, year: mYear, dateStr, timeStr } = parseMemoMonthYear(memo, ts);

      // Filter by this month & year
      if (mIdx !== monthIndex || mYear !== year) {
        return;
      }

      const rawLot = (memo.lotNumberInput !== undefined && memo.lotNumberInput !== '')
        ? memo.lotNumberInput
        : (memo.lotNumber !== undefined && memo.lotNumber !== '' ? memo.lotNumber : null);
      const effectiveLot = (rawLot !== null && !isNaN(Number(rawLot)) && Number(rawLot) > 0)
        ? Number(rawLot)
        : null;

      let name = memo.customerName || memo.name || memo.supplierName || `Memo ${id}`;
      let totalBill = 0;

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
            totalBill += weightInKg * finalRate;
          }
        });
      }

      if (totalBill === 0 && memo.totalBill) {
        totalBill = Number(memo.totalBill) || 0;
      }

      const paidAmount = Number(memo.paidAmount !== undefined ? memo.paidAmount : (memo.deposit || 0));
      const dueAmount = Math.max(0, Math.round((totalBill - paidAmount) * 100) / 100);

      let status: 'paid' | 'due' | 'draft' = memo.status || 'draft';
      if (memo.status === 'paid' || memo.paidDate || (totalBill > 0 && dueAmount <= 0)) {
        status = 'paid';
      } else if (memo.status === 'due' || dueAmount > 0) {
        status = 'due';
      }

      let statusColor = '#aaa';
      let statusText = 'Draft';
      if (status === 'paid') {
        statusColor = '#72be44';
        statusText = 'Paid';
      } else if (status === 'due') {
        statusColor = '#ff9800';
        statusText = 'Due';
      }

      // If already processed, prefer canonical or newer
      if (foundMemosMap.has(id)) {
        const existing = foundMemosMap.get(id)!;
        if (sourceKey === `sales_memo_${id}`) {
          // Canonical takes precedence
        } else if (ts <= existing.timestamp) {
          return;
        }
      }

      foundMemosMap.set(id, {
        id,
        name,
        lotNumber: effectiveLot,
        status,
        statusText,
        statusColor,
        dateStr: dateStr || memo.createdAt || '',
        timeStr: timeStr || memo.createdAtTime || '',
        totalBill,
        paidAmount,
        dueAmount,
        timestamp: ts
      });
    };

    // 1. Scan canonical sales_memo_*
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
        const id = key.replace('sales_memo_', '');
        try {
          const raw = JSON.parse(localStorage.getItem(key) || '{}');
          processItem(id, raw, key);
        } catch (e) {}
      }
    }

    // 2. Scan lot keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sales_memo_lot_') && key.includes('_memo_')) {
        const parts = key.split('_memo_');
        if (parts.length === 2) {
          const id = parts[1];
          try {
            const raw = JSON.parse(localStorage.getItem(key) || '{}');
            processItem(id, raw, key);
          } catch (e) {}
        }
      }
    }

    // 3. Scan due_memo_*
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('due_memo_')) {
        const id = key.replace('due_memo_', '');
        try {
          const raw = JSON.parse(localStorage.getItem(key) || '{}');
          processItem(id, raw, key);
        } catch (e) {}
      }
    }

    const arr = Array.from(foundMemosMap.values());
    arr.sort((a, b) => {
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      const numA = Number(a.id);
      const numB = Number(b.id);
      if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
      return b.id.localeCompare(a.id);
    });

    setMemos(arr);
  };

  useEffect(() => {
    loadMonthMemos();
    window.addEventListener('storage', loadMonthMemos);
    return () => window.removeEventListener('storage', loadMonthMemos);
  }, [monthIndex, year]);

  // Statistics for this month
  const stats = useMemo(() => {
    let totalMemos = memos.length;
    let totalAmount = 0;
    let paidMemosCount = 0;
    let paidAmountTotal = 0;
    let dueMemosCount = 0;
    let dueAmountTotal = 0;

    memos.forEach(m => {
      totalAmount += m.totalBill;
      paidAmountTotal += m.paidAmount;
      dueAmountTotal += m.dueAmount;
      if (m.status === 'paid') {
        paidMemosCount++;
      } else if (m.status === 'due') {
        dueMemosCount++;
      }
    });

    return {
      totalMemos,
      totalAmount,
      paidMemosCount,
      paidAmountTotal,
      dueMemosCount,
      dueAmountTotal
    };
  }, [memos]);

  const handleDeleteMemo = (memo: MonthlyMemo, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${memo.name}" মেমোটি মুছে ট্র্যাশ বিনে সরাতে চান?`
      : `Are you sure you want to delete memo "${memo.name}"?`;

    if (window.confirm(confirmMsg)) {
      const canonicalKey = `sales_memo_${memo.id}`;
      const memoDataStr = localStorage.getItem(canonicalKey)
        || localStorage.getItem(`sales_memo_lot_${memo.lotNumber ?? 'unassigned'}_memo_${memo.id}`)
        || localStorage.getItem(`due_memo_${memo.id}`);

      if (memoDataStr) {
        moveToTrash({
          id: canonicalKey,
          type: 'sales_lot',
          title: `Sales Memo (${monthName} ${year}) - ${memo.name}`,
          data: JSON.parse(memoDataStr)
        });
      }

      // Clean up storage keys
      localStorage.removeItem(canonicalKey);
      localStorage.removeItem(`sales_memo_lot_${memo.lotNumber ?? 'unassigned'}_memo_${memo.id}`);
      localStorage.removeItem(`sales_memo_lot_unassigned_memo_${memo.id}`);
      for (let l = 1; l <= 50; l++) {
        localStorage.removeItem(`sales_memo_lot_${l}_memo_${memo.id}`);
      }
      localStorage.removeItem(`due_memo_${memo.id}`);

      // Clean up lists
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sales_memo_list_')) {
          try {
            const listStr = localStorage.getItem(k);
            if (listStr) {
              let list: string[] = JSON.parse(listStr);
              if (list.includes(memo.id)) {
                list = list.filter(id => id !== memo.id);
                localStorage.setItem(k, JSON.stringify(list));
              }
            }
          } catch (err) {}
        }
      }

      setMemos(prev => prev.filter(m => m.id !== memo.id));
      window.dispatchEvent(new Event('storage'));
    }
  };

  const filteredMemos = memos.filter(m => {
    if (filter === 'paid' && m.status !== 'paid') return false;
    if (filter === 'due' && m.status !== 'due') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchId = m.id.includes(q);
      const matchLot = m.lotNumber !== null && m.lotNumber.toString().includes(q);
      return matchName || matchId || matchLot;
    }
    return true;
  });

  return (
    <div className="lots-screen" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={onBack}>
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={22} style={{ color: '#72be44' }} />
              {monthName} {displayYear} - {language === 'bn' ? 'বিক্রয় মেমোসমূহ' : 'Sales Memos'}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '2px' }}>
              {language === 'bn' ? 'এই মাসে তৈরি হওয়া সকল মেমোর হিসাব' : 'All memos created in this month'}
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '4px 10px' }}>
          <Search size={16} opacity={0.6} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === 'bn' ? 'খুঁজুন...' : 'Search memos...'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              outline: 'none',
              fontSize: '0.85rem',
              width: '130px'
            }}
          />
        </div>
      </div>

      {/* Top Analytics Summary Banner */}
      <div className="screen-sub-container">
        <div className="monthly-summary-grid">
          {/* Card 1: Total Memos */}
          <div className="monthly-summary-card" style={{
            background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(21, 101, 192, 0.1))',
            border: '1px solid rgba(33, 150, 243, 0.3)'
          }}>
            <div className="monthly-summary-title" style={{ color: '#90caf9' }}>
              {language === 'bn' ? 'মোট মেমো তৈরি' : 'Total Memos Created'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#fff' }}>
              {language === 'bn' ? enToBnDigits(stats.totalMemos) : stats.totalMemos} {language === 'bn' ? 'টি' : 'memos'}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? 'মোট বিক্রয় মেমো' : 'Total sales memos'}
            </div>
          </div>

          {/* Card 2: Total Sales Amount */}
          <div className="monthly-summary-card" style={{
            background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(46, 125, 50, 0.1))',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}>
            <div className="monthly-summary-title" style={{ color: '#a5d6a7' }}>
              {language === 'bn' ? 'মোট বিক্রয় মূল্য' : 'Total Sales Amount'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#4caf50' }}>
              ৳ {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? 'এই মাসের মোট তৈরি বিল' : 'Total billed this month'}
            </div>
          </div>

          {/* Card 3: Paid / Cash Received */}
          <div className="monthly-summary-card" style={{
            background: 'linear-gradient(135deg, rgba(0, 150, 136, 0.15), rgba(0, 105, 92, 0.1))',
            border: '1px solid rgba(0, 150, 136, 0.3)'
          }}>
            <div className="monthly-summary-title" style={{ color: '#80cbc4' }}>
              {language === 'bn' ? 'হাতে নগদ পেয়েছি (পরিশোধিত)' : 'Paid / Cash Collected'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#26a69a' }}>
              ৳ {stats.paidAmountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? enToBnDigits(stats.paidMemosCount) : stats.paidMemosCount} {language === 'bn' ? 'টি সম্পূর্ণ পরিশোধিত' : 'fully paid memos'}
            </div>
          </div>

          {/* Card 4: Due / Remaining */}
          <div className="monthly-summary-card" style={{
            background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(239, 108, 0, 0.1))',
            border: '1px solid rgba(255, 152, 0, 0.3)'
          }}>
            <div className="monthly-summary-title" style={{ color: '#ffcc80' }}>
              {language === 'bn' ? 'এখনও বাকি আছে (বকেয়া)' : 'Due / Remaining Amount'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#ffa726' }}>
              ৳ {stats.dueAmountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? enToBnDigits(stats.dueMemosCount) : stats.dueMemosCount} {language === 'bn' ? 'টি বকেয়া রয়েছে' : 'due memos'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="screen-sub-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                background: filter === 'all' ? '#72be44' : 'rgba(255,255,255,0.06)',
                color: filter === 'all' ? '#000' : '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {language === 'bn' ? 'সকল' : 'All'} ({memos.length})
            </button>
            <button
              onClick={() => setFilter('paid')}
              style={{
                background: filter === 'paid' ? '#4caf50' : 'rgba(255,255,255,0.06)',
                color: filter === 'paid' ? '#000' : '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {language === 'bn' ? 'পরিশোধিত' : 'Paid'} ({stats.paidMemosCount})
            </button>
            <button
              onClick={() => setFilter('due')}
              style={{
                background: filter === 'due' ? '#ff9800' : 'rgba(255,255,255,0.06)',
                color: filter === 'due' ? '#000' : '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {language === 'bn' ? 'বকেয়া' : 'Due'} ({stats.dueMemosCount})
            </button>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} />
            {language === 'bn' ? 'প্রদর্শিত:' : 'Showing:'} {filteredMemos.length}
          </div>
        </div>
      </div>

      {/* Memos Grid */}
      {filteredMemos.length === 0 ? (
        <div className="screen-sub-container">
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px dashed rgba(255,255,255,0.1)'
          }}>
            <Calendar size={48} style={{ opacity: 0.3, marginBottom: '0.8rem', color: '#72be44' }} />
            <h3 style={{ margin: '0 0 0.5rem', opacity: 0.8 }}>
              {language === 'bn'
                ? `${monthName} ${displayYear} মাসে কোনো মেমো পাওয়া যায়নি`
                : `No memos found for ${monthName} ${year}`}
            </h3>
            <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
              {language === 'bn'
                ? 'বিক্রয় মেমো তৈরি করার সময় তারিখ অনুযায়ী স্বয়ংক্রিয়ভাবে এই ফোল্ডারে যুক্ত হবে।'
                : 'Sales memos created in this month will automatically appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="lot-grid">
          {filteredMemos.map(memo => (
            <ProtectedMemoWrapper
              key={memo.id}
              passwordKey={`memo_password_${memo.id}`}
              onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber)}
            >
              <div className="lot-card" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
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
                      <span style={{
                        fontSize: '0.8rem',
                        background: 'rgba(255,255,255,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        Lot: {memo.lotNumber !== null ? memo.lotNumber : 'N/A'}
                      </span>
                      {memo.totalBill > 0 && (
                        <span style={{
                          fontSize: '0.8rem',
                          background: 'rgba(76, 175, 80, 0.1)',
                          color: '#4caf50',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          ৳ {memo.totalBill.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Date and Time badge */}
                    <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={12} opacity={0.7} />
                      <span>{memo.dateStr}</span>
                      {memo.timeStr && <span>({memo.timeStr})</span>}
                    </div>

                    {/* Paid & Due breakdown */}
                    {memo.totalBill > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#bbb', display: 'flex', gap: '0.6rem', marginTop: '2px' }}>
                        <span>নগদ: ৳{memo.paidAmount.toFixed(0)}</span>
                        {memo.dueAmount > 0 && (
                          <span style={{ color: '#ffb74d' }}>বাকি: ৳{memo.dueAmount.toFixed(0)}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="card-top-actions">
                    <button
                      className="btn-icon delete-btn"
                      onClick={e => handleDeleteMemo(memo, e)}
                      style={{ padding: '4px', margin: 0, color: '#ff5252' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="card-bottom-actions" onClick={e => e.stopPropagation()}>
                    <MemoLockIcon passwordKey={`memo_password_${memo.id}`} />
                  </div>
                </div>
              </div>
            </ProtectedMemoWrapper>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonthlySalesScreen;
