import React, { useState, useEffect, useMemo } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Calendar, FileText, Trash2, Search, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { MONTHS, parseMemoMonthYear, enToBnDigits } from '../utils/dateUtils';
import { deleteSalesMemoCompletely } from '../utils/dueSyncUtils';
import { getLotPurchaseItems, getAllPurchaseItems } from '../utils/stockUtils';

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
  totalProfit: number;
  cashProfit: number;
  dueProfit: number;
  totalLoss: number;
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
  const [filter, setFilter] = useState<'all' | 'paid' | 'due' | 'loss'>('all');

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

    let purchaseDueIds: Set<string> = new Set();
    try {
      const dp = localStorage.getItem('dues_purchase');
      if (dp) JSON.parse(dp).forEach((x: string) => purchaseDueIds.add(String(x)));
      const pdp = localStorage.getItem('paid_dues_purchase');
      if (pdp) JSON.parse(pdp).forEach((x: string) => purchaseDueIds.add(String(x)));
    } catch (e) {}

    const processItem = (id: string, rawData: any, sourceKey?: string) => {
      if (!id || !rawData) return;
      const memo = rawData.memoState || rawData;

      // STRICT FILTER: Monthly Sales Screen is strictly for SALES memos.
      // Purchase memos belong strictly to purchase lots and dues_purchase, NEVER sales.
      const isPurchase =
        purchaseDueIds.has(String(id)) ||
        rawData.type === 'purchase' ||
        memo.type === 'purchase' ||
        rawData.customerType === 'purchase' ||
        memo.customerType === 'purchase' ||
        (sourceKey && sourceKey.startsWith('due_memo_purchase_')) ||
        id.startsWith('purchase_') ||
        (memo.totalPriceMain !== undefined && memo.totalCostMain !== undefined && !memo.customerName) ||
        (Boolean(memo.supplierName) && !memo.customerName && rawData.type !== 'regular' && rawData.type !== 'permanent' && rawData.type !== 'reseller');

      if (isPurchase) {
        return;
      }

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
      let memoProfit = 0;
      let memoLoss = 0;

      const lotPurchaseItems = effectiveLot ? getLotPurchaseItems(effectiveLot) : getAllPurchaseItems();

      if (memo.entries && Array.isArray(memo.entries)) {
        memo.entries.forEach((entry: any) => {
          let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;

          const matchedItem = (entry.name && entry.name.trim() !== '')
            ? lotPurchaseItems.find(it => it.name.trim().toLowerCase() === entry.name.trim().toLowerCase())
            : null;
          // Extra products are those not found in lot purchase items
          const isExtra = !matchedItem && (entry.name || '').trim() !== '';

          let saleRate = 0;
          if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
            let manualRateNum = Number(entry.manualSaleRate) || 0;
            saleRate = manualRateNum + (manualRateNum * currentProfitPercent / 100);
          } else if (matchedItem) {
            let base = matchedItem.suggestedSaleRate > 0 ? matchedItem.suggestedSaleRate : matchedItem.effectiveCostRate;
            saleRate = base + (base * currentProfitPercent / 100);
          } else if (entry.buyRate && Number(entry.buyRate) > 0) {
            let base = Number(entry.buyRate);
            saleRate = base + (base * currentProfitPercent / 100);
          }

          let weightInKg = 0;
          let totalKgNum = Number(entry.totalKg) || 0;
          if (totalKgNum > 0) {
            weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
          }

          if (weightInKg > 0 && saleRate > 0) {
            const entrySaleAmount = weightInKg * saleRate;
            totalBill += entrySaleAmount;

            // Extra products are strictly and completely EXCLUDED from profit and loss
            let costRate = 0;
            if (!isExtra && matchedItem && matchedItem.effectiveCostRate > 0) {
              costRate = matchedItem.effectiveCostRate;
            }

            if (costRate > 0) {
              const entryCostAmount = weightInKg * costRate;
              const diff = entrySaleAmount - entryCostAmount;
              if (diff >= 0) {
                memoProfit += diff;
              } else {
                memoLoss += Math.abs(diff);
              }
            }
          }
        });
      }

      if (totalBill === 0 && memo.totalBill) {
        totalBill = Number(memo.totalBill) || 0;
      }

      const rawDeductions = (memo.deductions && Array.isArray(memo.deductions))
        ? memo.deductions
        : ((rawData.deductions && Array.isArray(rawData.deductions)) ? rawData.deductions : []);
      const totalDeductions = rawDeductions.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
      if (totalDeductions > 0) {
        totalBill = Math.max(0, totalBill - totalDeductions);
        memoProfit = Math.max(0, memoProfit - totalDeductions);
      }

      // Commission handling
      let rawCommVal = memo.commissionValue !== undefined ? memo.commissionValue : rawData.commissionValue;
      if (typeof rawCommVal === 'object' && rawCommVal !== null) {
        rawCommVal = rawCommVal.value ?? rawCommVal.amount ?? '';
      }
      const commVal = Number(rawCommVal) || 0;
      const commType = memo.commissionType || rawData.commissionType || 'percent';
      const commOp = memo.commissionOperation || rawData.commissionOperation || 'subtract';
      if (commVal > 0) {
        const commAmt = commType === 'flat' ? commVal : Math.round((totalBill * commVal / 100) * 100) / 100;
        if (commAmt > 0) {
          if (commOp === 'add') {
            totalBill = Math.round((totalBill + commAmt) * 100) / 100;
            memoProfit = Math.round((memoProfit + commAmt) * 100) / 100;
          } else {
            totalBill = Math.max(0, Math.round((totalBill - commAmt) * 100) / 100);
            if (commAmt > memoProfit) {
              memoLoss = Math.round((memoLoss + (commAmt - memoProfit)) * 100) / 100;
              memoProfit = 0;
            } else {
              memoProfit = Math.round((memoProfit - commAmt) * 100) / 100;
            }
          }
        }
      }

      const rawPaid = (memo.paidAmount !== undefined && memo.paidAmount !== '')
        ? memo.paidAmount
        : ((rawData.paidAmount !== undefined && rawData.paidAmount !== '')
          ? rawData.paidAmount
          : ((memo.deposit !== undefined && memo.deposit !== '')
            ? memo.deposit
            : (rawData.deposit !== undefined && rawData.deposit !== '' ? rawData.deposit : 0)));
      let paidAmount = Number(rawPaid) || 0;

      let status: 'paid' | 'due' | 'draft' = memo.status || rawData.status || 'draft';
      const isExplicitlyPaid = memo.status === 'paid' || rawData.status === 'paid' || Boolean(memo.paidDate) || Boolean(rawData.paidDate);
      if (isExplicitlyPaid || (totalBill > 0 && paidAmount >= totalBill)) {
        status = 'paid';
        if (totalBill > 0 && paidAmount < totalBill) {
          paidAmount = totalBill;
        }
      } else if (status === 'due' || (totalBill > 0 && totalBill > paidAmount)) {
        status = 'due';
      }

      const dueAmount = status === 'paid' ? 0 : Math.max(0, Math.round((totalBill - paidAmount) * 100) / 100);

      let cashProfit = 0;
      let dueProfit = 0;
      if (memoProfit > 0) {
        if (status === 'paid') {
          cashProfit = memoProfit;
          dueProfit = 0;
        } else if (totalBill > 0) {
          const ratio = Math.min(1, Math.max(0, paidAmount / totalBill));
          cashProfit = Math.round(memoProfit * ratio * 100) / 100;
          dueProfit = Math.round((memoProfit - cashProfit) * 100) / 100;
        } else {
          cashProfit = memoProfit;
          dueProfit = 0;
        }
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
        totalProfit: Math.round(memoProfit * 100) / 100,
        cashProfit,
        dueProfit,
        totalLoss: Math.round(memoLoss * 100) / 100,
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

    // 3. Scan due_memo_* (strictly sales only, never purchase)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('due_memo_') && !key.startsWith('due_memo_purchase_')) {
        const id = key.replace('due_memo_', '');
        if (purchaseDueIds.has(id)) continue;
        try {
          const raw = JSON.parse(localStorage.getItem(key) || '{}');
          const inner = raw.memoState || raw;
          if (raw.type === 'purchase' || inner.type === 'purchase' || raw.customerType === 'purchase' || inner.customerType === 'purchase') {
            continue;
          }
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
    let totalProfit = 0;
    let cashProfit = 0;
    let dueProfit = 0;
    let totalLoss = 0;
    let lossMemosCount = 0;

    memos.forEach(m => {
      totalAmount += m.totalBill;
      paidAmountTotal += m.paidAmount;
      dueAmountTotal += m.dueAmount;
      totalProfit += m.totalProfit;
      cashProfit += m.cashProfit;
      dueProfit += m.dueProfit;
      totalLoss += m.totalLoss;
      if (m.totalLoss > 0) {
        lossMemosCount++;
      }
      if (m.status === 'paid') {
        paidMemosCount++;
      } else if (m.status === 'due') {
        dueMemosCount++;
      }
    });

    const netProfit = Math.round((totalProfit - totalLoss) * 100) / 100;

    return {
      totalMemos,
      totalAmount,
      paidMemosCount,
      paidAmountTotal,
      dueMemosCount,
      dueAmountTotal,
      totalProfit,
      cashProfit,
      dueProfit,
      totalLoss,
      lossMemosCount,
      netProfit
    };
  }, [memos]);

  const handleDeleteMemo = (memo: MonthlyMemo, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${memo.name || 'মেমো #' + memo.id}" মেমোটি মুছে ট্র্যাশ বিনে সরাতে চান?`
      : `Are you sure you want to delete memo "${memo.name || '#' + memo.id}"?`;

    if (window.confirm(confirmMsg)) {
      deleteSalesMemoCompletely(memo.id, { name: memo.name, lotNumber: memo.lotNumber });
      setMemos(prev => prev.filter(m => m.id !== memo.id));
    }
  };

  const filteredMemos = memos.filter(m => {
    if (filter === 'paid' && m.status !== 'paid') return false;
    if (filter === 'due' && m.status !== 'due') return false;
    if (filter === 'loss' && !(m.totalLoss > 0)) return false;
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
          <div
            className={`monthly-summary-card clickable ${filter === 'all' ? 'active-filter' : ''}`}
            onClick={() => setFilter('all')}
            title={language === 'bn' ? 'সকল মেমো দেখতে ক্লিক করুন' : 'Click to show all memos'}
            style={{
              background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.15), rgba(21, 101, 192, 0.1))',
              border: filter === 'all' ? '2px solid rgba(33, 150, 243, 0.85)' : '1px solid rgba(33, 150, 243, 0.3)',
              boxShadow: filter === 'all' ? '0 0 12px rgba(33, 150, 243, 0.25)' : 'none',
              cursor: 'pointer'
            }}
          >
            <div className="monthly-summary-title" style={{ color: '#90caf9' }}>
              {language === 'bn' ? 'মোট মেমো তৈরি' : 'Total Memos Created'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#fff' }}>
              {language === 'bn' ? enToBnDigits(stats.totalMemos) : stats.totalMemos} {language === 'bn' ? 'টি' : 'memos'}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? 'মোট বিক্রয় মেমো (ক্লিক করুন)' : 'Total sales memos (Click)'}
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
          <div
            className="monthly-summary-card clickable"
            onClick={() => setFilter(prev => prev === 'paid' ? 'all' : 'paid')}
            title={language === 'bn' ? 'পরিশোধিত মেমোগুলো দেখতে ক্লিক করুন' : 'Click to filter paid memos'}
            style={{
              background: 'linear-gradient(135deg, rgba(0, 150, 136, 0.15), rgba(0, 105, 92, 0.1))',
              border: filter === 'paid' ? '2px solid #26a69a' : '1px solid rgba(0, 150, 136, 0.3)',
              boxShadow: filter === 'paid' ? '0 0 14px rgba(38, 166, 154, 0.45)' : 'none',
              cursor: 'pointer'
            }}
          >
            <div className="monthly-summary-title" style={{ color: '#80cbc4' }}>
              {language === 'bn' ? 'হাতে নগদ পেয়েছি (পরিশোধিত)' : 'Paid / Cash Collected'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#26a69a' }}>
              ৳ {stats.paidAmountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? enToBnDigits(stats.paidMemosCount) : stats.paidMemosCount} {language === 'bn' ? 'টি সম্পূর্ণ পরিশোধিত (ক্লিক করুন)' : 'fully paid memos (Click)'}
            </div>
          </div>

          {/* Card 4: Due / Remaining */}
          <div
            className="monthly-summary-card clickable"
            onClick={() => setFilter(prev => prev === 'due' ? 'all' : 'due')}
            title={language === 'bn' ? 'বকেয়া মেমোগুলো দেখতে ক্লিক করুন' : 'Click to filter due memos'}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.15), rgba(239, 108, 0, 0.1))',
              border: filter === 'due' ? '2px solid #ffa726' : '1px solid rgba(255, 152, 0, 0.3)',
              boxShadow: filter === 'due' ? '0 0 14px rgba(255, 167, 38, 0.45)' : 'none',
              cursor: 'pointer'
            }}
          >
            <div className="monthly-summary-title" style={{ color: '#ffcc80' }}>
              {language === 'bn' ? 'এখনও বাকি আছে (বকেয়া)' : 'Due / Remaining Amount'}
            </div>
            <div className="monthly-summary-value" style={{ color: '#ffa726' }}>
              ৳ {stats.dueAmountTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="monthly-summary-sub">
              {language === 'bn' ? enToBnDigits(stats.dueMemosCount) : stats.dueMemosCount} {language === 'bn' ? 'টি বকেয়া রয়েছে (ক্লিক করুন)' : 'due memos (Click)'}
            </div>
          </div>

          {/* Card 5: Monthly Profit Portion (বর্তমান মাসে লাভের অংশ) */}
          <div className="monthly-summary-card" style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(5, 150, 105, 0.1))',
            border: '1px solid rgba(16, 185, 129, 0.35)'
          }}>
            <div className="monthly-summary-title" style={{ color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TrendingUp size={13} style={{ color: '#10b981' }} />
              {language === 'bn' ? 'বর্তমান মাসে লাভের অংশ' : 'Monthly Profit Portion'}
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 'bold' }}>
                {language === 'bn' ? 'মোট লাভ' : 'Total Profit'}
              </div>
              <div className="monthly-summary-value" style={{ color: '#10b981' }}>
                ৳ {stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Sub-breakdown: Cash Profit, Due Profit & Net Profit */}
            <div className="profit-sub-breakdown">
              <div title={language === 'bn' ? `হাতে নগদ লাভ: ৳ ${stats.cashProfit}` : `Cash Profit: ৳ ${stats.cashProfit}`}>
                <div className="profit-sub-label" style={{ color: '#a7f3d0' }}>
                  {language === 'bn' ? 'হাতে নগদ লাভ' : 'Cash Profit'}
                </div>
                <div className="profit-sub-value" style={{ color: '#34d399' }}>
                  ৳ {stats.cashProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: '4px' }} title={language === 'bn' ? `বাকিতে লাভ: ৳ ${stats.dueProfit}` : `Due Profit: ৳ ${stats.dueProfit}`}>
                <div className="profit-sub-label" style={{ color: '#fed7aa' }}>
                  {language === 'bn' ? 'বাকিতে লাভ' : 'Due Profit'}
                </div>
                <div className="profit-sub-value" style={{ color: '#fb923c' }}>
                  ৳ {stats.dueProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: '4px' }} title={language === 'bn' ? `নিট লাভ (লাভ - লস): ৳ ${stats.netProfit}` : `Net Profit (Profit - Loss): ৳ ${stats.netProfit}`}>
                <div className="profit-sub-label" style={{ color: '#93c5fd' }}>
                  {language === 'bn' ? 'নিট লাভ' : 'Net Profit'}
                </div>
                <div className="profit-sub-value" style={{ color: stats.netProfit >= 0 ? '#60a5fa' : '#ef5350' }}>
                  {stats.netProfit < 0 ? '- ' : ''}৳ {Math.abs(stats.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 6: Monthly Loss Portion (বর্তমান মাসে লসের অংশ) - Clickable Filter */}
          <div
            className="monthly-summary-card clickable"
            onClick={() => setFilter(prev => prev === 'loss' ? 'all' : 'loss')}
            title={language === 'bn' ? 'লসের মেমোগুলো দেখতে ক্লিক করুন' : 'Click to filter loss memos'}
            style={{
              background: filter === 'loss'
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(185, 28, 28, 0.22))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.16), rgba(185, 28, 28, 0.1))',
              border: filter === 'loss' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.35)',
              boxShadow: filter === 'loss' ? '0 0 16px rgba(239, 68, 68, 0.5)' : 'none',
              cursor: 'pointer'
            }}
          >
            <div className="monthly-summary-title" style={{ color: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingDown size={13} style={{ color: '#ef4444' }} />
                {language === 'bn' ? 'বর্তমান মাসে লসের অংশ' : 'Monthly Loss Portion'}
              </span>
              {filter === 'loss' && (
                <span style={{
                  fontSize: '0.62rem',
                  background: '#ef4444',
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  letterSpacing: '0.2px'
                }}>
                  {language === 'bn' ? 'সক্রিয় ✓' : 'Active ✓'}
                </span>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.3px', fontWeight: 'bold' }}>
                {language === 'bn' ? 'মোট লস' : 'Total Loss'}
              </div>
              <div className="monthly-summary-value" style={{ color: '#ef5350' }}>
                ৳ {stats.totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="monthly-summary-sub" style={{ color: stats.totalLoss > 0 ? '#fca5a5' : '#888' }}>
              {stats.totalLoss > 0
                ? (language === 'bn' ? `${enToBnDigits(stats.lossMemosCount)} টি মেমোতে লস (ক্লিক করুন)` : `${stats.lossMemosCount} memos with loss (Click)`)
                : (language === 'bn' ? 'এই মাসে কোনো লস নেই' : 'No loss this month')}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="screen-sub-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            <button
              onClick={() => setFilter(prev => prev === 'loss' ? 'all' : 'loss')}
              style={{
                background: filter === 'loss' ? '#ef4444' : 'rgba(239,68,68,0.12)',
                color: filter === 'loss' ? '#fff' : '#fca5a5',
                border: filter === 'loss' ? '1px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <TrendingDown size={14} />
              {language === 'bn' ? 'লসের মেমো' : 'Loss Memos'} ({language === 'bn' ? enToBnDigits(stats.lossMemosCount) : stats.lossMemosCount})
            </button>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Filter size={14} />
            {language === 'bn' ? 'প্রদর্শিত:' : 'Showing:'} {filteredMemos.length}
          </div>
        </div>

        {/* Loss Filter Alert Banner */}
        {filter === 'loss' && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(239,68,68,0.18), rgba(239,68,68,0.08))',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '0.85rem' }}>
              <TrendingDown size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
              <span>
                {language === 'bn'
                  ? `শুধুমাত্র লস হওয়া মেমোগুলো ফিল্টার করা হয়েছে (মোট ${enToBnDigits(stats.lossMemosCount)} টি মেমো, সর্বমোট লস: ৳ ${stats.totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                  : `Filtered by loss memos only (${stats.lossMemosCount} memos, Total Loss: ৳ ${stats.totalLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`}
              </span>
            </div>
            <button
              onClick={() => setFilter('all')}
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '6px',
                color: '#fff',
                padding: '4px 10px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {language === 'bn' ? 'সব মেমো দেখুন ✕' : 'Clear Filter ✕'}
            </button>
          </div>
        )}
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
            {filter === 'loss' ? (
              <>
                <TrendingDown size={48} style={{ opacity: 0.4, marginBottom: '0.8rem', color: '#ef4444' }} />
                <h3 style={{ margin: '0 0 0.5rem', opacity: 0.9, color: '#fca5a5' }}>
                  {language === 'bn'
                    ? `${monthName} ${displayYear} মাসে কোনো লসের মেমো পাওয়া যায়নি`
                    : `No memos with loss found for ${monthName} ${year}`}
                </h3>
                <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 1.2rem' }}>
                  {language === 'bn'
                    ? 'এই মাসে সকল মেমো লাভজনক অথবা কোনো লস হিসাব করা হয়নি।'
                    : 'All memos in this month are profitable or have no recorded losses.'}
                </p>
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    background: '#72be44',
                    color: '#000',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '8px 18px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {language === 'bn' ? 'সকল মেমো দেখুন' : 'Show All Memos'}
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
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
              <div
                className="lot-card"
                style={{
                  cursor: 'pointer',
                  border: filter === 'loss' ? '1px solid rgba(239, 68, 68, 0.45)' : undefined,
                  background: filter === 'loss' ? 'rgba(239, 68, 68, 0.04)' : undefined,
                  boxShadow: filter === 'loss' ? '0 4px 12px rgba(239, 68, 68, 0.1)' : undefined
                }}
              >
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

                    {/* Paid & Due & Profit breakdown */}
                    {memo.totalBill > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#bbb', display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '2px', alignItems: 'center' }}>
                        <span>নগদ: ৳{memo.paidAmount.toFixed(0)}</span>
                        {memo.dueAmount > 0 && (
                          <span style={{ color: '#ffb74d' }}>বাকি: ৳{memo.dueAmount.toFixed(0)}</span>
                        )}
                        {memo.totalProfit > 0 && (
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>লাভ: ৳{memo.totalProfit.toFixed(0)}</span>
                        )}
                        {memo.totalLoss > 0 && (
                          <span style={{
                            color: filter === 'loss' ? '#fff' : '#ef5350',
                            background: filter === 'loss' ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            লস: ৳{memo.totalLoss.toFixed(2)}
                          </span>
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
