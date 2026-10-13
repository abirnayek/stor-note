import { parseMemoMonthYear } from './dateUtils';
import { moveToTrash } from './trashUtils';

export interface NormalizedDueMemo {
  id: string;
  name: string;
  mobile: string;
  address: string;
  lotNumber: number | null;
  customerType: 'regular' | 'permanent' | 'purchase';
  status: 'due' | 'paid' | 'draft';
  dateStr: string;
  timeStr: string;
  totalBill: number;
  paidAmount: number;
  dueAmount: number;
  paidDate?: number;
  autoMessage?: {
    scheduledFor: number;
    type: 'whatsapp' | 'sms';
    status: 'pending' | 'sent' | 'failed';
  };
  timestamp: number;
  raw: any;
}

/**
 * Calculates total bill, paid amount, and due amount for any memo shape.
 */
export const calculateMemoTotals = (memoData: any): { totalBill: number; paidAmount: number; dueAmount: number } => {
  if (!memoData) return { totalBill: 0, paidAmount: 0, dueAmount: 0 };
  const memo = memoData.memoState || memoData;

  let totalBill = 0;
  const entries = memo.entries && Array.isArray(memo.entries) ? memo.entries : (memoData.entries && Array.isArray(memoData.entries) ? memoData.entries : []);

  if (entries.length > 0) {
    entries.forEach((entry: any) => {
      let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
      let buyRateNum = Number(entry.buyRate) || 0;
      let calculatedSalePriceAuto = buyRateNum > 0 ? buyRateNum + (buyRateNum * currentProfitPercent / 100) : 0;

      let saleRate = 0;
      if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
        let manualRateNum = Number(entry.manualSaleRate);
        saleRate = manualRateNum + (manualRateNum * currentProfitPercent / 100);
      } else {
        saleRate = calculatedSalePriceAuto;
      }

      let weightInKg = 0;
      let totalKgNum = Number(entry.totalKg) || 0;
      if (totalKgNum > 0) {
        weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
      }

      if (weightInKg > 0 && saleRate > 0) {
        totalBill += weightInKg * saleRate;
      } else if (typeof entry.totalPrice === 'number' && entry.totalPrice > 0) {
        totalBill += entry.totalPrice;
      }
    });
  }

  // Fallback for purchase memo or root total price
  if (totalBill === 0) {
    if (memo.totalPriceMain && Number(memo.totalPriceMain) > 0) {
      totalBill = Number(memo.totalPriceMain);
    } else if (memoData.totalPriceMain && Number(memoData.totalPriceMain) > 0) {
      totalBill = Number(memoData.totalPriceMain);
    } else if (memo.totalBill && Number(memo.totalBill) > 0) {
      totalBill = Number(memo.totalBill);
    } else if (memoData.totalBill && Number(memoData.totalBill) > 0) {
      totalBill = Number(memoData.totalBill);
    }
  }

  const deposit = Number(memo.deposit !== undefined ? memo.deposit : (memoData.deposit !== undefined ? memoData.deposit : 0)) || 0;
  const paid = Number(memo.paidAmount !== undefined ? memo.paidAmount : (memoData.paidAmount !== undefined ? memoData.paidAmount : 0)) || 0;
  const paidAmount = Math.max(deposit, paid);

  const dueAmount = Math.max(0, Math.round((totalBill - paidAmount) * 100) / 100);

  return {
    totalBill: Math.round(totalBill * 100) / 100,
    paidAmount,
    dueAmount
  };
};

/**
 * Loads and normalizes a memo by ID from localStorage, checking all possible keys.
 */
export const getNormalizedMemo = (memoId: string): NormalizedDueMemo => {
  let canonicalData: any = null;
  let dueData: any = null;
  let lotData: any = null;

  // 1. Check canonical sales memo
  const canonicalStr = localStorage.getItem(`sales_memo_${memoId}`);
  if (canonicalStr) {
    try { canonicalData = JSON.parse(canonicalStr); } catch (e) {}
  }

  // 2. Check due memo
  const dueStr = localStorage.getItem(`due_memo_${memoId}`);
  if (dueStr) {
    try { dueData = JSON.parse(dueStr); } catch (e) {}
  }

  // 3. Check lot keys if canonical not found
  if (!canonicalData) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sales_memo_lot_') && k.endsWith(`_memo_${memoId}`)) {
        try {
          lotData = JSON.parse(localStorage.getItem(k) || '');
          break;
        } catch (e) {}
      }
    }
  }

  const primary = canonicalData || lotData || dueData || {};
  const innerMemo = primary.memoState || (dueData && dueData.memoState) || primary;

  // Name resolution
  const name = primary.customerName || innerMemo.customerName || primary.name || innerMemo.name || primary.supplierName || 'Unknown';
  const mobile = primary.mobile || innerMemo.mobile || (dueData && dueData.mobile) || '';
  const address = primary.address || innerMemo.address || (dueData && dueData.address) || '';

  // Lot number resolution
  let lotNumber: number | null = null;
  const rawLot = primary.lotNumberInput ?? innerMemo.lotNumberInput ?? primary.lotNumber ?? innerMemo.lotNumber ?? (dueData && (dueData.lotNumber || dueData.memoState?.lotNumberInput));
  if (rawLot !== null && rawLot !== undefined && rawLot !== '' && !isNaN(Number(rawLot)) && Number(rawLot) > 0) {
    lotNumber = Number(rawLot);
  }

  // Customer Type resolution ('regular' | 'permanent' | 'purchase')
  let customerType: 'regular' | 'permanent' | 'purchase' = 'regular';
  const rawType = primary.customerType || innerMemo.customerType || primary.type || innerMemo.type || (dueData && dueData.type);
  if (rawType === 'permanent') {
    customerType = 'permanent';
  } else if (rawType === 'purchase') {
    customerType = 'purchase';
  } else {
    customerType = 'regular';
  }

  // Auto message config
  const autoMessage = (dueData && dueData.autoMessage) || primary.autoMessage || innerMemo.autoMessage;

  // Paid date
  const paidDate = (dueData && dueData.paidDate) || primary.paidDate || innerMemo.paidDate;

  // Status
  let status: 'due' | 'paid' | 'draft' = primary.status || innerMemo.status || (dueData && dueData.status) || 'draft';

  // Calculate totals
  const { totalBill, paidAmount, dueAmount } = calculateMemoTotals({
    ...primary,
    memoState: innerMemo,
    deposit: (dueData && dueData.deposit) ?? primary.deposit ?? innerMemo.deposit,
    paidAmount: primary.paidAmount ?? innerMemo.paidAmount ?? (dueData && dueData.paidAmount)
  });

  if (dueAmount > 0) {
    status = 'due';
  } else if (totalBill > 0 && dueAmount <= 0) {
    status = 'paid';
  }

  // Timestamp & Date resolution
  let timestamp = 0;
  try {
    const tsStr = localStorage.getItem('local_timestamps');
    if (tsStr) {
      const tsMap = JSON.parse(tsStr);
      timestamp = tsMap[`sales_memo_${memoId}`] || tsMap[`due_memo_${memoId}`] || 0;
    }
  } catch (e) {}

  if (!timestamp && !isNaN(Number(memoId)) && Number(memoId) > 1000000000) {
    timestamp = Number(memoId);
  }

  const { dateStr, timeStr } = parseMemoMonthYear(innerMemo, timestamp);

  return {
    id: memoId,
    name,
    mobile,
    address,
    lotNumber,
    customerType,
    status,
    dateStr: dateStr || innerMemo.createdAt || primary.date || '',
    timeStr: timeStr || innerMemo.createdAtTime || '',
    totalBill,
    paidAmount,
    dueAmount,
    paidDate,
    autoMessage,
    timestamp: timestamp || Date.now(),
    raw: primary
  };
};

/**
 * Master sync function that scans all sales and due memos, aligns dues lists,
 * resolves categories, ensures two-way linkages, and removes obsolete entries.
 */
export const syncAllDueAccounts = (): {
  regularDues: string[];
  permanentDues: string[];
  purchaseDues: string[];
  paidRegularDues: string[];
  paidPermanentDues: string[];
  paidPurchaseDues: string[];
} => {
  const allCandidateIds = new Set<string>();

  // 1. Scan canonical sales_memo_*
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
      const id = key.replace('sales_memo_', '');
      if (id) allCandidateIds.add(id);
    } else if (key.startsWith('due_memo_')) {
      const id = key.replace('due_memo_', '');
      if (id) allCandidateIds.add(id);
    }
  }

  // 2. Scan existing dues lists
  const readList = (key: string): string[] => {
    try {
      const str = localStorage.getItem(key);
      return str ? JSON.parse(str) : [];
    } catch (e) {
      return [];
    }
  };

  const curRegular = readList('dues_regular');
  const curPermanent = readList('dues_permanent');
  const curPurchase = readList('dues_purchase');
  const curPaidRegular = readList('paid_dues_regular');
  const curPaidPermanent = readList('paid_dues_permanent');
  const curPaidPurchase = readList('paid_dues_purchase');

  curRegular.forEach(id => allCandidateIds.add(id));
  curPermanent.forEach(id => allCandidateIds.add(id));
  curPurchase.forEach(id => allCandidateIds.add(id));
  curPaidRegular.forEach(id => allCandidateIds.add(id));
  curPaidPermanent.forEach(id => allCandidateIds.add(id));
  curPaidPurchase.forEach(id => allCandidateIds.add(id));

  const regularDuesMap = new Map<string, number>();
  const permanentDuesMap = new Map<string, number>();
  const purchaseDuesMap = new Map<string, number>();

  const paidRegularDuesMap = new Map<string, number>();
  const paidPermanentDuesMap = new Map<string, number>();
  const paidPurchaseDuesMap = new Map<string, number>();

  allCandidateIds.forEach(id => {
    const memo = getNormalizedMemo(id);

    // If completely empty draft with no entries, no name and 0 total, check if it was in user's active dues
    const isEmptyDraft = memo.totalBill === 0 && memo.paidAmount === 0 && (!memo.name || memo.name === 'Unknown');
    if (isEmptyDraft && !curRegular.includes(id) && !curPermanent.includes(id) && !curPurchase.includes(id)) {
      return;
    }

    const wasTrackedAsDue = curRegular.includes(id) || curPermanent.includes(id) || curPurchase.includes(id) ||
      curPaidRegular.includes(id) || curPaidPermanent.includes(id) || curPaidPurchase.includes(id) ||
      Boolean(memo.paidDate) || memo.status === 'due' || memo.status === 'paid' || memo.dueAmount > 0;

    if (memo.customerType === 'purchase') {
      if (memo.dueAmount > 0) {
        purchaseDuesMap.set(id, memo.timestamp);
      } else if (wasTrackedAsDue && (memo.paidDate || memo.status === 'paid' || memo.totalBill > 0)) {
        paidPurchaseDuesMap.set(id, memo.timestamp);
      }
    } else if (memo.customerType === 'permanent') {
      if (memo.dueAmount > 0) {
        permanentDuesMap.set(id, memo.timestamp);
      } else if (wasTrackedAsDue && (memo.paidDate || memo.status === 'paid' || memo.totalBill > 0)) {
        paidPermanentDuesMap.set(id, memo.timestamp);
      }
    } else {
      // Default to regular
      if (memo.dueAmount > 0) {
        regularDuesMap.set(id, memo.timestamp);
      } else if (wasTrackedAsDue && (memo.paidDate || memo.status === 'paid' || memo.totalBill > 0)) {
        paidRegularDuesMap.set(id, memo.timestamp);
      }
    }

    // Keep due_memo_${id} fully in sync with canonical sales memo data
    if (wasTrackedAsDue || memo.dueAmount > 0) {
      const existingDueStr = localStorage.getItem(`due_memo_${id}`);
      let existingDueObj: any = {};
      if (existingDueStr) {
        try { existingDueObj = JSON.parse(existingDueStr); } catch (e) {}
      }

      const syncedDueData = {
        ...existingDueObj,
        id: memo.id,
        name: memo.name,
        customerName: memo.name,
        mobile: memo.mobile,
        address: memo.address,
        lotNumber: memo.lotNumber ? memo.lotNumber.toString() : '',
        deposit: memo.paidAmount,
        paidAmount: memo.paidAmount,
        type: memo.customerType,
        status: memo.dueAmount > 0 ? 'due' : 'paid',
        date: memo.dateStr,
        createdAt: memo.dateStr,
        createdAtTime: memo.timeStr,
        paidDate: memo.dueAmount <= 0 ? (memo.paidDate || existingDueObj.paidDate || Date.now()) : undefined,
        autoMessage: memo.autoMessage,
        entries: memo.raw?.entries || existingDueObj.entries || [],
        memoState: {
          ...(memo.raw?.memoState || memo.raw || existingDueObj.memoState || {}),
          customerName: memo.name,
          mobile: memo.mobile,
          address: memo.address,
          lotNumberInput: memo.lotNumber ? memo.lotNumber.toString() : '',
          paidAmount: memo.paidAmount,
          customerType: memo.customerType,
          status: memo.dueAmount > 0 ? 'due' : 'paid',
          entries: memo.raw?.entries || existingDueObj.entries || []
        }
      };

      try {
        localStorage.setItem(`due_memo_${id}`, JSON.stringify(syncedDueData));
      } catch (e) {}
    }
  });

  // Sort each list: newest timestamp first
  const sortByTs = (map: Map<string, number>): string[] => {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  };

  const regularDues = sortByTs(regularDuesMap);
  const permanentDues = sortByTs(permanentDuesMap);
  const purchaseDues = sortByTs(purchaseDuesMap);

  const paidRegularDues = sortByTs(paidRegularDuesMap);
  const paidPermanentDues = sortByTs(paidPermanentDuesMap);
  const paidPurchaseDues = sortByTs(paidPurchaseDuesMap);

  // Write updated arrays to localStorage
  try {
    localStorage.setItem('dues_regular', JSON.stringify(regularDues));
    localStorage.setItem('dues_permanent', JSON.stringify(permanentDues));
    localStorage.setItem('dues_purchase', JSON.stringify(purchaseDues));

    localStorage.setItem('paid_dues_regular', JSON.stringify(paidRegularDues));
    localStorage.setItem('paid_dues_permanent', JSON.stringify(paidPermanentDues));
    localStorage.setItem('paid_dues_purchase', JSON.stringify(paidPurchaseDues));
  } catch (e) {}

  return {
    regularDues,
    permanentDues,
    purchaseDues,
    paidRegularDues,
    paidPermanentDues,
    paidPurchaseDues
  };
};

/**
 * Removes a due memo from all due lists, sales keys (if applicable), and archives to trash.
 */
export const deleteDueMemo = (dueId: string, _dueType?: 'regular' | 'permanent' | 'purchase', isPaid: boolean = false) => {
  const memoData = getNormalizedMemo(dueId);

  moveToTrash({
    id: `due_memo_${dueId}`,
    type: 'due_memo',
    title: `${isPaid ? 'Paid' : 'Due'} Memo (${memoData.name || 'Unknown'})`,
    data: memoData.raw
  });

  const cleanList = (key: string) => {
    try {
      const str = localStorage.getItem(key);
      if (str) {
        const list: string[] = JSON.parse(str);
        const filtered = list.filter(id => id !== dueId);
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    } catch (e) {}
  };

  cleanList('dues_regular');
  cleanList('dues_permanent');
  cleanList('dues_purchase');
  cleanList('paid_dues_regular');
  cleanList('paid_dues_permanent');
  cleanList('paid_dues_purchase');

  localStorage.removeItem(`due_memo_${dueId}`);

  window.dispatchEvent(new Event('storage'));
};
