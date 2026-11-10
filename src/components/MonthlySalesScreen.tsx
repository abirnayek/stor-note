import React, { useState, useEffect, useMemo } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Calendar, FileText, Trash2, Search, Filter, TrendingUp, TrendingDown } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { MONTHS, enToBnDigits } from '../utils/dateUtils';
import { deleteSalesMemoCompletely, getAllGlobalSalesMemos, purgeCorruptedPurchaseMemosFromSales } from '../utils/dueSyncUtils';
import { getLotPurchaseItems, getAllPurchaseItems, matchesFish } from '../utils/stockUtils';

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
  customerType?: 'regular' | 'permanent' | 'reseller' | '';
  folderId?: string;
  folderName?: string;
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
  const [memoTypeFilter, setMemoTypeFilter] = useState<'all' | 'lots' | 'aratdar' | 'reseller'>('all');

  const monthObj = MONTHS.find(m => m.index === monthIndex) || MONTHS[0];
  const monthName = language === 'bn' ? monthObj.nameBn : monthObj.nameEn;
  const displayYear = language === 'bn' ? enToBnDigits(year) : year.toString();

  const loadMonthMemos = () => {
    purgeCorruptedPurchaseMemosFromSales(true);

    // Use the exact same single source of truth as the SalesLotsScreen folders
    const allGlobal = getAllGlobalSalesMemos();
    const monthGlobal = allGlobal.filter(m => m.month === monthIndex && m.year === year);

    const foundMemosMap = new Map<string, MonthlyMemo>();

    monthGlobal.forEach(globalItem => {
      // Fetch full memo object to calculate profit/loss from entries
      let rawData: any = null;
      try {
        if (globalItem.sourceKey && localStorage.getItem(globalItem.sourceKey)) {
          rawData = JSON.parse(localStorage.getItem(globalItem.sourceKey) || '{}');
        } else if (localStorage.getItem(`sales_memo_${globalItem.id}`)) {
          rawData = JSON.parse(localStorage.getItem(`sales_memo_${globalItem.id}`) || '{}');
        } else if (localStorage.getItem(`due_memo_${globalItem.id}`)) {
          rawData = JSON.parse(localStorage.getItem(`due_memo_${globalItem.id}`) || '{}');
        }
      } catch (e) {}

      const memo = rawData ? (rawData.memoState || rawData) : {};
      const effectiveLot = globalItem.lotNumber;
      const lotPurchaseItems = effectiveLot ? getLotPurchaseItems(effectiveLot) : getAllPurchaseItems();

      let memoProfit = 0;
      let memoLoss = 0;

      if (memo.entries && Array.isArray(memo.entries)) {
        memo.entries.forEach((entry: any) => {
          let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;

          const entryCleanName = (entry.name || '').trim();
          const matchedItem = entryCleanName !== ''
            ? lotPurchaseItems.find(it => it.name.trim().toLowerCase() === entryCleanName.toLowerCase() || matchesFish(entryCleanName, it.name))
            : null;

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
          } else if (entry.saleRate && Number(entry.saleRate) > 0) {
            saleRate = Number(entry.saleRate);
          } else if (entry.rate && Number(entry.rate) > 0) {
            saleRate = Number(entry.rate);
          }

          let weightInKg = 0;
          let totalKgNum = Number(entry.totalKg) || 0;
          if (totalKgNum > 0) {
            weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
          }

          if (weightInKg > 0 && saleRate > 0) {
            const entrySaleAmount = weightInKg * saleRate;

            let costRate = 0;
            if (matchedItem && matchedItem.effectiveCostRate > 0) {
              costRate = matchedItem.effectiveCostRate;
            } else if (entry.buyRate && Number(entry.buyRate) > 0) {
              costRate = Number(entry.buyRate);
            } else if (entry.costRate && Number(entry.costRate) > 0) {
              costRate = Number(entry.costRate);
            } else if (currentProfitPercent > 0) {
              // Reconstruct cost from saleRate and profitPercent
              costRate = Math.round((saleRate / (1 + currentProfitPercent / 100)) * 100) / 100;
            }

            if (costRate > 0) {
              const entryCostAmount = weightInKg * costRate;
              const diff = entrySaleAmount - entryCostAmount;
              if (diff > 0) {
                memoProfit += diff;
              } else if (diff < 0) {
                memoLoss += Math.abs(diff);
              }
            }
          }
        });
      }

      // Deductions
      const rawDeductions = (memo.deductions && Array.isArray(memo.deductions))
        ? memo.deductions
        : ((rawData && rawData.deductions && Array.isArray(rawData.deductions)) ? rawData.deductions : []);
      const totalDeductions = rawDeductions.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
      if (totalDeductions > 0) {
        memoProfit = Math.max(0, memoProfit - totalDeductions);
      }

      // Commission handling
      let rawCommVal = memo.commissionValue !== undefined ? memo.commissionValue : (rawData ? rawData.commissionValue : undefined);
      if (typeof rawCommVal === 'object' && rawCommVal !== null) {
        rawCommVal = rawCommVal.value ?? rawCommVal.amount ?? '';
      }
      const commVal = Number(rawCommVal) || 0;
      const commType = memo.commissionType || (rawData ? rawData.commissionType : 'percent');
      const commOp = memo.commissionOperation || (rawData ? rawData.commissionOperation : 'subtract');
      if (commVal > 0) {
        const commAmt = commType === 'flat' ? commVal : Math.round((globalItem.totalAmount * commVal / 100) * 100) / 100;
        if (commAmt > 0) {
          if (commOp === 'add') {
            memoProfit = Math.round((memoProfit + commAmt) * 100) / 100;
          } else {
            if (commAmt > memoProfit) {
              memoLoss = Math.round((memoLoss + (commAmt - memoProfit)) * 100) / 100;
              memoProfit = 0;
            } else {
              memoProfit = Math.round((memoProfit - commAmt) * 100) / 100;
            }
          }
        }
      }

      let cashProfit = 0;
      let dueProfit = 0;
      if (memoProfit > 0) {
        if (globalItem.status === 'paid') {
          cashProfit = memoProfit;
          dueProfit = 0;
        } else if (globalItem.totalAmount > 0) {
          const ratio = Math.min(1, Math.max(0, globalItem.paidAmount / globalItem.totalAmount));
          cashProfit = Math.round(memoProfit * ratio * 100) / 100;
          dueProfit = Math.round((memoProfit - cashProfit) * 100) / 100;
        } else {
          cashProfit = memoProfit;
          dueProfit = 0;
        }
      }

      foundMemosMap.set(globalItem.id, {
        id: globalItem.id,
        name: globalItem.name,
        lotNumber: globalItem.lotNumber,
        status: globalItem.status,
        statusText: globalItem.statusText,
        statusColor: globalItem.statusColor,
        dateStr: globalItem.dateStr,
        timeStr: globalItem.timeStr,
        totalBill: globalItem.totalAmount,
        paidAmount: globalItem.paidAmount,
        dueAmount: globalItem.dueAmount,
        totalProfit: Math.round(memoProfit * 100) / 100,
        cashProfit,
        dueProfit,
        totalLoss: Math.round(memoLoss * 100) / 100,
        timestamp: globalItem.timestamp,
        customerType: globalItem.customerType,
        folderId: globalItem.folderId,
        folderName: globalItem.folderName
      });
    });

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

  // Type counts
  const aratdarMemosCount = memos.filter(m => m.customerType === 'permanent').length;
  const resellerMemosCount = memos.filter(m => m.customerType === 'reseller').length;
  const lotsMemosCount = memos.filter(m => m.customerType !== 'permanent' && m.customerType !== 'reseller').length;

  const filteredMemos = memos.filter(m => {
    if (filter === 'paid' && m.status !== 'paid') return false;
    if (filter === 'due' && m.status !== 'due') return false;
    if (filter === 'loss' && !(m.totalLoss > 0)) return false;
    if (memoTypeFilter === 'lots' && (m.customerType === 'permanent' || m.customerType === 'reseller')) return false;
    if (memoTypeFilter === 'aratdar' && m.customerType !== 'permanent') return false;
    if (memoTypeFilter === 'reseller' && m.customerType !== 'reseller') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchId = m.id.includes(q);
      const matchLot = m.lotNumber !== null && m.lotNumber.toString().includes(q);
      const matchFolder = m.folderName ? m.folderName.toLowerCase().includes(q) : false;
      return matchName || matchId || matchLot || matchFolder;
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
              {language === 'bn' ? 'এই মাসে তৈরি হওয়া সাধারণ, আড়তদার ও রিসেলার সহ সকল মেমোর কেন্দ্রীয় হিসাব' : 'Unified monthly record of all general, aratdar & reseller memos'}
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

      {/* Category Selection Tabs (সব মেমো / লট বিক্রয় / আড়তদার / রিসেলার) */}
      <div className="screen-sub-container" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setMemoTypeFilter('all')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: memoTypeFilter === 'all' ? '#72be44' : 'transparent',
              color: memoTypeFilter === 'all' ? '#000' : '#ccc',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            {language === 'bn' ? 'সব মেমো' : 'All Memos'} ({memos.length})
          </button>
          <button
            onClick={() => setMemoTypeFilter('lots')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: memoTypeFilter === 'lots' ? '#72be44' : 'transparent',
              color: memoTypeFilter === 'lots' ? '#000' : '#ccc',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            {language === 'bn' ? 'সাধারণ/লট মেমো' : 'General/Lots'} ({lotsMemosCount})
          </button>
          <button
            onClick={() => setMemoTypeFilter('aratdar')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: memoTypeFilter === 'aratdar' ? '#ab47bc' : 'transparent',
              color: memoTypeFilter === 'aratdar' ? '#fff' : '#ccc',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            {language === 'bn' ? 'আড়তদার মেমো' : 'Aratdar'} ({aratdarMemosCount})
          </button>
          <button
            onClick={() => setMemoTypeFilter('reseller')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: memoTypeFilter === 'reseller' ? '#2196f3' : 'transparent',
              color: memoTypeFilter === 'reseller' ? '#fff' : '#ccc',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            {language === 'bn' ? 'রিসেলার মেমো' : 'Reseller'} ({resellerMemosCount})
          </button>
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
              name={memo.name || `মেমো #${memo.id}`}
              type="memo"
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
                      {memo.customerType === 'permanent' && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(171, 71, 188, 0.25)', color: '#ce93d8', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(171, 71, 188, 0.4)' }}>
                          আড়তদার
                        </span>
                      )}
                      {memo.customerType === 'reseller' && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(33, 150, 243, 0.25)', color: '#90caf9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(33, 150, 243, 0.4)' }}>
                          রিসেলার
                        </span>
                      )}
                      {memo.folderName && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.08)', color: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                          📁 {memo.folderName}
                        </span>
                      )}
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
