import { parseMemoMonthYear } from './dateUtils';
import { moveToTrash } from './trashUtils';
import { markMemoDeleted, isMemoDeleted } from './syncEngine';

export interface NormalizedDueMemo {
  id: string;
  name: string;
  mobile: string;
  address: string;
  lotNumber: number | null;
  customerType: 'regular' | 'permanent' | 'purchase' | 'reseller';
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

  const isPurchase = memo.type === 'purchase' || memoData.type === 'purchase' || memo.customerType === 'purchase' || memoData.customerType === 'purchase' || String(memoData.id || '').startsWith('purchase_');

  if (isPurchase) {
    let purchaseTotal = 0;
    if (entries.length > 0) {
      entries.forEach((entry: any) => {
        purchaseTotal += Number(entry.totalPrice) || 0;
      });
    }
    if (purchaseTotal === 0) {
      purchaseTotal = Number(memo.totalPriceMain) || Number(memoData.totalPriceMain) || Number(memo.totalBill) || Number(memoData.totalBill) || 0;
    }
    totalBill = purchaseTotal;
  } else if (entries.length > 0) {
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

  // Fallback for root total price
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

  const grossTotal = totalBill;

  // Subtract any custom memo deductions (e.g., ice cost, transport, etc.)
  const rawDeductions = (memo.deductions && Array.isArray(memo.deductions))
    ? memo.deductions
    : ((memoData.deductions && Array.isArray(memoData.deductions)) ? memoData.deductions : []);
  const totalDeductions = rawDeductions.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
  if (totalDeductions > 0) {
    totalBill = Math.max(0, totalBill - totalDeductions);
  }

  // Commission handling (subtract or add)
  let rawCommVal = memo.commissionValue !== undefined ? memo.commissionValue : memoData.commissionValue;
  if (typeof rawCommVal === 'object' && rawCommVal !== null) {
    rawCommVal = rawCommVal.target?.value ?? rawCommVal.value ?? rawCommVal.amount ?? '';
  }
  const commVal = typeof rawCommVal === 'string' 
    ? (Number(rawCommVal.replace(/[০-৯]/g, (d: string) => (d.charCodeAt(0) - 0x09e6).toString())) || 0) 
    : (Number(rawCommVal) || 0);
  const commType = memo.commissionType || memoData.commissionType || 'percent';
  const commOp = memo.commissionOperation || memoData.commissionOperation || 'subtract';
  if (commVal > 0) {
    const commAmt = commType === 'flat' ? commVal : Math.round((grossTotal * commVal / 100) * 100) / 100;
    if (commAmt > 0) {
      if (commOp === 'add') {
        totalBill = Math.round((totalBill + commAmt) * 100) / 100;
      } else {
        totalBill = Math.max(0, Math.round((totalBill - commAmt) * 100) / 100);
      }
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

  // 3. Check purchase memo if memoId starts with purchase_lot_ or purchase_
  if (memoId.startsWith('purchase_lot_') || memoId.startsWith('purchase_')) {
    const lotPart = memoId.replace('purchase_lot_', '').replace('purchase_', '');
    const pStr = localStorage.getItem(`memo_lot_${lotPart}`) || localStorage.getItem(`memo_lot_${String(lotPart).padStart(2, '0')}`);
    if (pStr) {
      try {
        const rawP = JSON.parse(pStr);
        lotData = {
          ...rawP,
          id: memoId,
          type: 'purchase',
          customerType: 'purchase',
          name: rawP.supplierName || `লট ${lotPart} সাপ্লায়ার`,
          lotNumber: Number(lotPart)
        };
      } catch (e) {}
    }
  }

  // 4. Check lot keys if canonical not found
  if (!canonicalData && !lotData) {
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

  // Combine entries from all available sources so entries are never lost
  const combinedEntries = (innerMemo.entries && Array.isArray(innerMemo.entries) && innerMemo.entries.length > 0)
    ? innerMemo.entries
    : ((primary.entries && Array.isArray(primary.entries) && primary.entries.length > 0)
      ? primary.entries
      : ((dueData?.entries && Array.isArray(dueData.entries) && dueData.entries.length > 0)
        ? dueData.entries
        : ((dueData?.memoState?.entries && Array.isArray(dueData.memoState.entries))
          ? dueData.memoState.entries
          : [])));

  // Name resolution
  const name = primary.customerName || innerMemo.customerName || primary.name || innerMemo.name || dueData?.name || primary.supplierName || 'Unknown';
  const mobile = primary.mobile || innerMemo.mobile || (dueData && dueData.mobile) || '';
  const address = primary.address || innerMemo.address || (dueData && dueData.address) || '';

  // Lot number resolution
  let lotNumber: number | null = null;
  const rawLot = primary.lotNumberInput ?? innerMemo.lotNumberInput ?? primary.lotNumber ?? innerMemo.lotNumber ?? (dueData && (dueData.lotNumber || dueData.memoState?.lotNumberInput));
  if (rawLot !== null && rawLot !== undefined && rawLot !== '' && !isNaN(Number(rawLot)) && Number(rawLot) > 0) {
    lotNumber = Number(rawLot);
  }

  // Customer Type resolution ('regular' | 'permanent' | 'purchase' | 'reseller')
  let customerType: 'regular' | 'permanent' | 'purchase' | 'reseller' = 'regular';
  const rawType = primary.customerType || innerMemo.customerType || primary.type || innerMemo.type || (dueData && (dueData.customerType || dueData.type));
  if (rawType === 'permanent') {
    customerType = 'permanent';
  } else if (rawType === 'purchase') {
    customerType = 'purchase';
  } else if (rawType === 'reseller') {
    customerType = 'reseller';
  } else {
    customerType = 'regular';
  }

  // Auto message config
  const autoMessage = (dueData && dueData.autoMessage) || primary.autoMessage || innerMemo.autoMessage;

  // Paid date
  const paidDate = (dueData && dueData.paidDate) || primary.paidDate || innerMemo.paidDate;

  // Status
  let status: 'due' | 'paid' | 'draft' = primary.status || innerMemo.status || (dueData && dueData.status) || 'draft';

  // Calculate totals with combined entries
  const { totalBill, paidAmount, dueAmount } = calculateMemoTotals({
    ...primary,
    entries: combinedEntries,
    memoState: { ...innerMemo, entries: combinedEntries },
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
    dateStr: (innerMemo.isOriginalDate === false && innerMemo.customDate) ? innerMemo.customDate : (dateStr || innerMemo.createdAt || primary.date || ''),
    timeStr: timeStr || innerMemo.createdAtTime || '',
    totalBill,
    paidAmount,
    dueAmount,
    paidDate,
    autoMessage,
    timestamp: timestamp || Date.now(),
    raw: {
      ...primary,
      customerName: name,
      mobile,
      address,
      entries: combinedEntries,
      deductions: (innerMemo.deductions && Array.isArray(innerMemo.deductions))
        ? innerMemo.deductions
        : ((primary.deductions && Array.isArray(primary.deductions)) ? primary.deductions : (dueData?.deductions || [])),
      memoState: {
        ...innerMemo,
        customerName: name,
        mobile,
        address,
        entries: combinedEntries,
        deductions: (innerMemo.deductions && Array.isArray(innerMemo.deductions))
          ? innerMemo.deductions
          : ((primary.deductions && Array.isArray(primary.deductions)) ? primary.deductions : (dueData?.deductions || []))
      }
    }
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
  resellerDues: string[];
  paidRegularDues: string[];
  paidPermanentDues: string[];
  paidPurchaseDues: string[];
  paidResellerDues: string[];
} => {
  const allCandidateIds = new Set<string>();

  // 1. Scan canonical sales_memo_*, due_memo_*, and lot-specific sales memos
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
      const id = key.replace('sales_memo_', '');
      if (id) allCandidateIds.add(id);
    } else if (key.startsWith('due_memo_')) {
      const id = key.replace('due_memo_', '');
      if (id) allCandidateIds.add(id);
    } else if (key.startsWith('sales_memo_lot_') && key.includes('_memo_')) {
      const parts = key.split('_memo_');
      if (parts[1]) allCandidateIds.add(parts[1]);
    } else if (key.startsWith('memo_lot_')) {
      const lotStr = key.replace('memo_lot_', '');
      if (lotStr && !isNaN(Number(lotStr))) {
        allCandidateIds.add(`purchase_lot_${lotStr}`);
      }
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
  const curReseller = readList('dues_reseller');
  const curPaidRegular = readList('paid_dues_regular');
  const curPaidPermanent = readList('paid_dues_permanent');
  const curPaidPurchase = readList('paid_dues_purchase');
  const curPaidReseller = readList('paid_dues_reseller');

  curRegular.forEach(id => allCandidateIds.add(id));
  curPermanent.forEach(id => allCandidateIds.add(id));
  curPurchase.forEach(id => allCandidateIds.add(id));
  curReseller.forEach(id => allCandidateIds.add(id));
  curPaidRegular.forEach(id => allCandidateIds.add(id));
  curPaidPermanent.forEach(id => allCandidateIds.add(id));
  curPaidPurchase.forEach(id => allCandidateIds.add(id));
  curPaidReseller.forEach(id => allCandidateIds.add(id));

  const regularDuesMap = new Map<string, number>();
  const permanentDuesMap = new Map<string, number>();
  const purchaseDuesMap = new Map<string, number>();
  const resellerDuesMap = new Map<string, number>();

  const paidRegularDuesMap = new Map<string, number>();
  const paidPermanentDuesMap = new Map<string, number>();
  const paidPurchaseDuesMap = new Map<string, number>();
  const paidResellerDuesMap = new Map<string, number>();

  allCandidateIds.forEach(id => {
    if (isMemoDeleted(id)) {
      localStorage.removeItem(`due_memo_${id}`);
      localStorage.removeItem(`sales_memo_${id}`);
      return;
    }

    const memo = getNormalizedMemo(id);

    // If completely empty draft with no entries, no name and 0 total, check if it was in user's active dues
    const isEmptyDraft = memo.totalBill === 0 && memo.paidAmount === 0 && (!memo.name || memo.name === 'Unknown');
    if (isEmptyDraft && !curRegular.includes(id) && !curPermanent.includes(id) && !curPurchase.includes(id)) {
      return;
    }

    const wasTrackedAsDue = curRegular.includes(id) || curPermanent.includes(id) || curPurchase.includes(id) || curReseller.includes(id) ||
      curPaidRegular.includes(id) || curPaidPermanent.includes(id) || curPaidPurchase.includes(id) || curPaidReseller.includes(id) ||
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
    } else if (memo.customerType === 'reseller') {
      if (memo.dueAmount > 0) {
        resellerDuesMap.set(id, memo.timestamp);
      } else if (wasTrackedAsDue && (memo.paidDate || memo.status === 'paid' || memo.totalBill > 0)) {
        paidResellerDuesMap.set(id, memo.timestamp);
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

      const entriesToSave = (memo.raw?.entries && Array.isArray(memo.raw.entries) && memo.raw.entries.length > 0)
        ? memo.raw.entries
        : ((memo.raw?.memoState?.entries && Array.isArray(memo.raw.memoState.entries) && memo.raw.memoState.entries.length > 0)
          ? memo.raw.memoState.entries
          : (existingDueObj.entries || existingDueObj.memoState?.entries || []));

      const deductionsToSave = (memo.raw?.deductions && Array.isArray(memo.raw.deductions))
        ? memo.raw.deductions
        : ((memo.raw?.memoState?.deductions && Array.isArray(memo.raw.memoState.deductions))
          ? memo.raw.memoState.deductions
          : (existingDueObj.deductions || existingDueObj.memoState?.deductions || []));

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
        customerType: memo.customerType,
        status: memo.dueAmount > 0 ? 'due' : 'paid',
        date: memo.dateStr,
        createdAt: memo.dateStr,
        createdAtTime: memo.timeStr,
        paidDate: memo.dueAmount <= 0 ? (memo.paidDate || existingDueObj.paidDate || Date.now()) : undefined,
        autoMessage: memo.autoMessage,
        entries: entriesToSave,
        deductions: deductionsToSave,
        memoState: {
          ...(memo.raw?.memoState || memo.raw || existingDueObj.memoState || {}),
          customerName: memo.name,
          mobile: memo.mobile,
          address: memo.address,
          lotNumberInput: memo.lotNumber ? memo.lotNumber.toString() : '',
          paidAmount: memo.paidAmount,
          customerType: memo.customerType,
          status: memo.dueAmount > 0 ? 'due' : 'paid',
          entries: entriesToSave,
          deductions: deductionsToSave
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
  const resellerDues = sortByTs(resellerDuesMap);

  const paidRegularDues = sortByTs(paidRegularDuesMap);
  const paidPermanentDues = sortByTs(paidPermanentDuesMap);
  const paidPurchaseDues = sortByTs(paidPurchaseDuesMap);
  const paidResellerDues = sortByTs(paidResellerDuesMap);

  // Write updated arrays to localStorage
  try {
    localStorage.setItem('dues_regular', JSON.stringify(regularDues));
    localStorage.setItem('dues_permanent', JSON.stringify(permanentDues));
    localStorage.setItem('dues_purchase', JSON.stringify(purchaseDues));
    localStorage.setItem('dues_reseller', JSON.stringify(resellerDues));

    localStorage.setItem('paid_dues_regular', JSON.stringify(paidRegularDues));
    localStorage.setItem('paid_dues_permanent', JSON.stringify(paidPermanentDues));
    localStorage.setItem('paid_dues_purchase', JSON.stringify(paidPurchaseDues));
    localStorage.setItem('paid_dues_reseller', JSON.stringify(paidResellerDues));
  } catch (e) {}

  return {
    regularDues,
    permanentDues,
    purchaseDues,
    resellerDues,
    paidRegularDues,
    paidPermanentDues,
    paidPurchaseDues,
    paidResellerDues
  };
};

/**
 * Changes customer type of a due memo between 'regular' and 'permanent'
 * and immediately updates all corresponding localStorage keys and lists.
 */
export const changeDueCustomerType = (dueId: string, newType: 'regular' | 'permanent' | 'purchase' | 'reseller') => {
  // 1. Update due_memo_${dueId}
  const dueKey = `due_memo_${dueId}`;
  const dueStr = localStorage.getItem(dueKey);
  if (dueStr) {
    try {
      const obj = JSON.parse(dueStr);
      obj.type = newType;
      obj.customerType = newType;
      if (obj.memoState) {
        obj.memoState.customerType = newType;
      }
      localStorage.setItem(dueKey, JSON.stringify(obj));
    } catch (e) {}
  }

  // 2. Update canonical sales_memo_${dueId}
  const canKey = `sales_memo_${dueId}`;
  const canStr = localStorage.getItem(canKey);
  if (canStr) {
    try {
      const obj = JSON.parse(canStr);
      obj.customerType = newType;
      if (obj.memoState) {
        obj.memoState.customerType = newType;
      }
      localStorage.setItem(canKey, JSON.stringify(obj));
    } catch (e) {}
  }

  // 3. Update any sales_memo_lot_*_memo_${dueId}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_lot_') && k.endsWith(`_memo_${dueId}`)) {
      try {
        const obj = JSON.parse(localStorage.getItem(k) || '');
        obj.customerType = newType;
        if (obj.memoState) obj.memoState.customerType = newType;
        localStorage.setItem(k, JSON.stringify(obj));
      } catch (e) {}
    }
  }

  // 4. Update memory & sync
  syncAllDueAccounts();
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('settingsChange'));
};

/**
 * Fully deletes a sales memo from all storage keys, lot lists, dues lists,
 * and moves a backup to the Trash bin. Dispatches storage event.
 */
export const deleteSalesMemoCompletely = (
  memoId: string,
  metadata?: { name?: string; lotNumber?: number | null }
) => {
  if (!memoId) return;

  const canonicalKey = `sales_memo_${memoId}`;
  let memoData: any = null;
  const canonicalStr = localStorage.getItem(canonicalKey);
  if (canonicalStr) {
    try { memoData = JSON.parse(canonicalStr); } catch (e) {}
  }
  if (!memoData) {
    const dueStr = localStorage.getItem(`due_memo_${memoId}`);
    if (dueStr) {
      try { memoData = JSON.parse(dueStr); } catch (e) {}
    }
  }
  if (!memoData) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sales_memo_lot_') && k.endsWith(`_memo_${memoId}`)) {
        try {
          memoData = JSON.parse(localStorage.getItem(k) || '');
          break;
        } catch (e) {}
      }
    }
  }

  const memoName = metadata?.name || memoData?.customerName || memoData?.name || `Memo #${memoId}`;
  const lotInfo = metadata?.lotNumber !== undefined
    ? metadata.lotNumber
    : (memoData?.lotNumber || memoData?.memoState?.lotNumberInput);

  moveToTrash({
    id: canonicalKey,
    type: 'sales_lot',
    title: `Sales Memo${lotInfo ? ` (Lot: ${lotInfo})` : ''} - ${memoName}`,
    data: memoData || {}
  });

  // 1. Mark memo tombstone across entire system first
  markMemoDeleted(memoId);

  // 2. Remove canonical & due keys
  localStorage.removeItem(canonicalKey);
  localStorage.removeItem(`due_memo_${memoId}`);
  localStorage.removeItem(`due_memo_regular_${memoId}`);
  localStorage.removeItem(`due_memo_permanent_${memoId}`);
  localStorage.removeItem(`due_memo_reseller_${memoId}`);
  localStorage.removeItem(`due_memo_purchase_${memoId}`);
  localStorage.removeItem(`sales_memo_lot_unassigned_memo_${memoId}`);
  localStorage.removeItem(`memo_password_sales_memo_${memoId}`);
  localStorage.removeItem(`memo_password_due_memo_${memoId}`);

  // 3. Scan and remove all lot-specific memo keys & passwords (sales_memo_lot_*_memo_${memoId})
  for (let l = 1; l <= 100; l++) {
    localStorage.removeItem(`sales_memo_lot_${l}_memo_${memoId}`);
    localStorage.removeItem(`memo_password_sales_memo_lot_${l}_memo_${memoId}`);
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.endsWith(`_memo_${memoId}`) || k.includes(`_${memoId}_`) || k.endsWith(`_${memoId}`))) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // 4. Clean up from all sales_memo_list_* keys
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_list_')) {
      try {
        const listStr = localStorage.getItem(k);
        if (listStr) {
          const list: string[] = JSON.parse(listStr);
          if (list.includes(memoId)) {
            localStorage.setItem(k, JSON.stringify(list.filter(id => id !== memoId)));
          }
        }
      } catch (e) {}
    }
  }

  // 5. Clean up from all due lists
  const dueLists = [
    'dues_regular', 'dues_permanent', 'dues_purchase', 'dues_reseller',
    'paid_dues_regular', 'paid_dues_permanent', 'paid_dues_purchase', 'paid_dues_reseller'
  ];
  dueLists.forEach(listKey => {
    try {
      const str = localStorage.getItem(listKey);
      if (str) {
        const list: string[] = JSON.parse(str);
        if (list.includes(memoId)) {
          localStorage.setItem(listKey, JSON.stringify(list.filter(id => id !== memoId)));
        }
      }
    } catch (e) {}
  });

  // 6. Resync dues to ensure clean state
  syncAllDueAccounts();

  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('settingsChange'));
};

/**
 * Removes a due memo from all due lists, sales keys (if applicable), and archives to trash.
 */
export const deleteDueMemo = (dueId: string, dueType?: 'regular' | 'permanent' | 'purchase' | 'reseller', isPaid: boolean = false) => {
  if (!dueId) return;
  const memoData = getNormalizedMemo(dueId);

  moveToTrash({
    id: `due_memo_${dueId}`,
    type: 'due_memo',
    title: `${isPaid ? 'Paid' : 'Due'} Memo (${memoData.name || 'Unknown'})`,
    data: memoData.raw
  });

  // 1. Mark memo tombstone across entire system
  markMemoDeleted(dueId);

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
  cleanList('dues_reseller');
  cleanList('paid_dues_regular');
  cleanList('paid_dues_permanent');
  cleanList('paid_dues_purchase');
  cleanList('paid_dues_reseller');

  // Remove due memo key
  localStorage.removeItem(`due_memo_${dueId}`);
  localStorage.removeItem(`due_memo_regular_${dueId}`);
  localStorage.removeItem(`due_memo_permanent_${dueId}`);
  localStorage.removeItem(`due_memo_reseller_${dueId}`);
  localStorage.removeItem(`due_memo_purchase_${dueId}`);

  // ALSO remove canonical sales memo and lot keys so syncAllDueAccounts does not recreate it!
  localStorage.removeItem(`sales_memo_${dueId}`);
  localStorage.removeItem(`sales_memo_lot_unassigned_memo_${dueId}`);
  for (let l = 1; l <= 100; l++) {
    localStorage.removeItem(`sales_memo_lot_${l}_memo_${dueId}`);
    localStorage.removeItem(`memo_password_sales_memo_lot_${l}_memo_${dueId}`);
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.endsWith(`_memo_${dueId}`) || k.includes(`_${dueId}_`) || k.endsWith(`_${dueId}`))) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // If purchase memo, also remove purchase lot key
  if (dueType === 'purchase') {
    localStorage.removeItem(`memo_lot_${dueId}`);
    try {
      const pListStr = localStorage.getItem('purchase_lots_list');
      if (pListStr) {
        const pList: any[] = JSON.parse(pListStr);
        const filtered = pList.filter(id => String(id) !== String(dueId));
        localStorage.setItem('purchase_lots_list', JSON.stringify(filtered));
      }
    } catch (e) {}
  }

  // Also clean from all sales_memo_list_*
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_list_')) {
      try {
        const listStr = localStorage.getItem(k);
        if (listStr) {
          const list: string[] = JSON.parse(listStr);
          if (list.includes(dueId)) {
            localStorage.setItem(k, JSON.stringify(list.filter(id => id !== dueId)));
          }
        }
      } catch (e) {}
    }
  }

  syncAllDueAccounts();
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('settingsChange'));
};

export const isInvalidMemoId = (id: string): boolean => {
  if (!id) return true;
  const lower = id.toLowerCase().trim();
  if (
    lower === 'lot_unassigned' ||
    lower === 'unassigned' ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower === '[object object]' ||
    lower.startsWith('lot_') ||
    lower.startsWith('list_') ||
    lower.startsWith('memo_list')
  ) {
    return true;
  }
  return false;
};

export interface SalesMemoGlobalItem {
  id: string;
  uniqueKey: string;
  name: string;
  lotNumber: number | null;
  status: 'paid' | 'due' | 'draft';
  statusColor: string;
  statusText: string;
  timestamp: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dateStr: string;
  timeStr: string;
  customerType?: 'regular' | 'permanent' | 'reseller' | '';
  sourceKey: string;
  month?: number;
  year?: number;
  folderId?: string;
  folderName?: string;
}

export const getAllGlobalSalesMemos = (): SalesMemoGlobalItem[] => {
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

  const allMemosMap = new Map<string, SalesMemoGlobalItem>();

  const processMemo = (memoId: string, lotKey: number | null, memoObj: any, sourceKey: string) => {
    if (isInvalidMemoId(memoId) || isMemoDeleted(memoId) || !memoObj) return;

    const inner = memoObj.memoState || memoObj;

    // Strict exclusion of purchase memos: Global Sales Memos are exclusively for sales
    const isPurchase =
      purchaseDueIds.has(String(memoId)) ||
      memoObj.type === 'purchase' ||
      inner.type === 'purchase' ||
      memoObj.customerType === 'purchase' ||
      inner.customerType === 'purchase' ||
      memoId.startsWith('purchase_') ||
      (sourceKey && sourceKey.startsWith('due_memo_purchase_')) ||
      (inner.totalPriceMain !== undefined && inner.totalCostMain !== undefined && !inner.customerName) ||
      (Boolean(inner.supplierName) && !inner.customerName && memoObj.type !== 'regular' && memoObj.type !== 'permanent' && memoObj.type !== 'reseller');

    if (isPurchase) return;
    const rawLot = (inner.lotNumberInput !== undefined && inner.lotNumberInput !== '')
      ? inner.lotNumberInput
      : (inner.lotNumber !== undefined && inner.lotNumber !== '' ? inner.lotNumber : lotKey);
    const effectiveLot = (rawLot !== null && rawLot !== undefined && rawLot !== '' && !isNaN(Number(rawLot)) && Number(rawLot) > 0)
      ? Number(rawLot)
      : null;

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
    if (!timestamp && inner.updatedAt) {
      const p = Date.parse(inner.updatedAt);
      if (!isNaN(p)) timestamp = p;
    }
    if (!timestamp && (inner.createdAt || inner.date)) {
      const p = Date.parse(String(inner.createdAt || inner.date));
      if (!isNaN(p)) timestamp = p;
    }
    if (!timestamp && !isNaN(Number(memoId)) && Number(memoId) > 1000000000) {
      timestamp = Number(memoId);
    }
    if (!timestamp) {
      const numId = Number(memoId);
      timestamp = !isNaN(numId) ? numId : 0;
    }

    if (allMemosMap.has(memoId)) {
      const existing = allMemosMap.get(memoId)!;
      if (existing.sourceKey === `sales_memo_${memoId}`) return;
      if (sourceKey === `sales_memo_${memoId}`) {
        // canonical takes precedence
      } else if (existing.lotNumber === null && effectiveLot !== null) {
        // prefer lot assigned
      } else if (existing.lotNumber !== null && effectiveLot === null) {
        return;
      } else if (timestamp <= existing.timestamp) {
        return;
      }
    }

    const name = inner.customerName || inner.name || memoObj.customerName || memoObj.name || `Memo ${memoId}`;
    const { totalBill, paidAmount, dueAmount } = calculateMemoTotals(memoObj);

    let status: 'paid' | 'due' | 'draft' = inner.status || memoObj.status || 'draft';
    let statusText = 'Draft';
    let statusColor = '#aaa';

    if (dueAmount > 0) {
      status = 'due';
      statusText = 'Due';
      statusColor = '#ff9800';
    } else if (totalBill > 0 && dueAmount <= 0) {
      status = 'paid';
      statusText = 'Paid';
      statusColor = '#72be44';
    } else if (inner.status === 'paid' || inner.paidDate || memoObj.paidDate) {
      status = 'paid';
      statusText = 'Paid';
      statusColor = '#72be44';
    } else if (inner.status === 'due') {
      status = 'due';
      statusText = 'Due';
      statusColor = '#ff9800';
    }

    const { month: mIdx, year: mYear, dateStr, timeStr } = parseMemoMonthYear(inner, timestamp);

    allMemosMap.set(memoId, {
      id: memoId,
      uniqueKey: `memo_${memoId}`,
      name,
      lotNumber: effectiveLot,
      status,
      statusText,
      statusColor,
      timestamp,
      totalAmount: totalBill,
      paidAmount,
      dueAmount,
      dateStr: (inner.isOriginalDate === false && inner.customDate) ? inner.customDate : (dateStr || inner.createdAt || ''),
      timeStr: timeStr || inner.createdAtTime || '',
      customerType: inner.customerType || memoObj.type || '',
      sourceKey,
      month: mIdx,
      year: mYear,
      folderId: inner.folderId || memoObj.folderId || '',
      folderName: inner.folderName || memoObj.folderName || ''
    });
  };

  // 1. Scan canonical sales_memo_* keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
      const id = key.replace('sales_memo_', '');
      if (isMemoDeleted(id)) continue;
      try {
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        processMemo(id, null, obj, key);
      } catch (e) {}
    }
  }

  // 2. Scan direct sales_memo_lot_*_memo_* keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sales_memo_lot_') && key.includes('_memo_')) {
      const parts = key.split('_memo_');
      if (parts.length === 2) {
        const id = parts[1];
        if (isMemoDeleted(id)) continue;
        try {
          const obj = JSON.parse(localStorage.getItem(key) || '{}');
          let lotNum: number | null = null;
          const lotPart = parts[0].replace('sales_memo_lot_', '');
          if (lotPart !== 'unassigned' && !isNaN(Number(lotPart))) {
            lotNum = Number(lotPart);
          }
          processMemo(id, lotNum, obj, key);
        } catch (e) {}
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
            if (isInvalidMemoId(memoId) || isMemoDeleted(memoId) || allMemosMap.has(memoId)) return;
            const canonical = localStorage.getItem(`sales_memo_${memoId}`);
            if (canonical) {
              try { processMemo(memoId, lotKeyNum, JSON.parse(canonical), `sales_memo_${memoId}`); } catch (e) {}
            } else {
              const lotStr = localStorage.getItem(`sales_memo_lot_${lotKeyNum ?? 'unassigned'}_memo_${memoId}`);
              if (lotStr) {
                try { processMemo(memoId, lotKeyNum, JSON.parse(lotStr), `sales_memo_lot_${lotKeyNum ?? 'unassigned'}_memo_${memoId}`); } catch (e) {}
              }
            }
          });
        }
      } catch (e) {}
    }
  }

  // 4. Scan due_memo_* keys (strictly sales only, not purchase)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('due_memo_') && !key.startsWith('due_memo_purchase_')) {
      const memoId = key.replace('due_memo_', '');
      if (isInvalidMemoId(memoId) || isMemoDeleted(memoId) || allMemosMap.has(memoId) || purchaseDueIds.has(memoId)) continue;
      try {
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        const inner = obj.memoState || obj;
        const isPurchase =
          obj.type === 'purchase' ||
          inner.type === 'purchase' ||
          obj.customerType === 'purchase' ||
          inner.customerType === 'purchase' ||
          (inner.supplierName && !inner.customerName && inner.customerType !== 'regular' && inner.customerType !== 'permanent' && inner.customerType !== 'reseller') ||
          (inner.totalPriceMain !== undefined && inner.totalCostMain !== undefined && !inner.customerName);

        if (!isPurchase && (obj.type === 'regular' || obj.type === 'permanent' || obj.type === 'reseller' || obj.customerType === 'reseller' || obj.customerName || inner.customerName || (obj.name && obj.type !== 'purchase'))) {
          let lotNum: number | null = null;
          if (obj.lotNumber && !isNaN(Number(obj.lotNumber))) {
            lotNum = Number(obj.lotNumber);
          }
          processMemo(memoId, lotNum, obj.memoState || obj, key);
        }
      } catch (e) {}
    }
  }

  const result = Array.from(allMemosMap.values());
  // Deterministic 4-level stable sorting: prevents jumping/shuffling
  result.sort((a, b) => {
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

  return result;
};

/**
 * Returns all sales memos that belong to the 'reseller' category.
 */
export const getResellerMemos = (): SalesMemoGlobalItem[] => {
  const all = getAllGlobalSalesMemos();
  return all.filter(m => m.customerType === 'reseller');
};

/**
 * Returns all sales memos that belong to the 'permanent' (Aratdar) category.
 */
export const getAratdarMemos = (): SalesMemoGlobalItem[] => {
  const all = getAllGlobalSalesMemos();
  return all.filter(m => m.customerType === 'permanent');
};

/**
 * Moves a sales memo into a specific folder (updating all relevant storage keys).
 * Preserves all memo amounts and data without any modification.
 */
export const moveSalesMemoToFolder = (memoId: string, folderId: string, folderName: string): { success: boolean; memoTitle: string } => {
  const cleanId = String(memoId).replace(/^sales_memo_/, '').replace(/^due_memo_/, '').trim();
  const memoKey = `sales_memo_${cleanId}`;
  let memoTitle = '#' + cleanId;

  // 1. Update canonical sales_memo_${cleanId}
  const memoStr = localStorage.getItem(memoKey);
  if (memoStr) {
    try {
      const parsed = JSON.parse(memoStr);
      if (parsed.customerName) memoTitle = parsed.customerName;
      parsed.folderId = folderId;
      parsed.folderName = folderName;
      if (parsed.memoState) {
        parsed.memoState.folderId = folderId;
        parsed.memoState.folderName = folderName;
      }
      localStorage.setItem(memoKey, JSON.stringify(parsed));
    } catch (e) {}
  }

  // 2. Update any sales_memo_lot_*_memo_${cleanId}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_lot_') && k.endsWith(`_memo_${cleanId}`)) {
      try {
        const obj = JSON.parse(localStorage.getItem(k) || '{}');
        obj.folderId = folderId;
        obj.folderName = folderName;
        if (obj.memoState) {
          obj.memoState.folderId = folderId;
          obj.memoState.folderName = folderName;
        }
        localStorage.setItem(k, JSON.stringify(obj));
      } catch (e) {}
    }
  }

  // 3. Update due_memo_${cleanId}
  const dueKey = `due_memo_${cleanId}`;
  const dueStr = localStorage.getItem(dueKey);
  if (dueStr) {
    try {
      const parsed = JSON.parse(dueStr);
      parsed.folderId = folderId;
      parsed.folderName = folderName;
      if (parsed.memoState) {
        parsed.memoState.folderId = folderId;
        parsed.memoState.folderName = folderName;
      }
      localStorage.setItem(dueKey, JSON.stringify(parsed));
    } catch (e) {}
  }

  // 4. Update sales_memo_list_*
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_list_')) {
      try {
        const listStr = localStorage.getItem(k);
        if (listStr) {
          const list = JSON.parse(listStr);
          if (Array.isArray(list)) {
            let changed = false;
            list.forEach((item: any) => {
              if (String(item.id) === cleanId) {
                item.folderId = folderId;
                item.folderName = folderName;
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem(k, JSON.stringify(list));
            }
          }
        }
      } catch (e) {}
    }
  }

  // 5. Update timestamp
  try {
    const tsRaw = localStorage.getItem('local_timestamps');
    let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
    tsMap[memoKey] = Date.now();
    localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
  } catch (err) {}

  window.dispatchEvent(new Event('storage'));
  return { success: true, memoTitle };
};

/**
 * Moves a sales memo to a specific lot number (updating all relevant storage keys).
 * If the memo had no lot or another lot number, updates it to newLotNumber.
 */
export const moveSalesMemoToLot = (memoId: string, newLotNumber: number): { success: boolean; memoTitle: string } => {
  const cleanId = String(memoId).replace(/^sales_memo_/, '').replace(/^due_memo_/, '').trim();
  const memoKey = `sales_memo_${cleanId}`;
  let memoTitle = '#' + cleanId;

  // 1. Read and update canonical sales_memo_${cleanId}
  const memoStr = localStorage.getItem(memoKey);
  if (memoStr) {
    try {
      const parsed = JSON.parse(memoStr);
      if (parsed.customerName) memoTitle = parsed.customerName;
      parsed.lotNumber = newLotNumber;
      parsed.lotNumberInput = String(newLotNumber);
      if (parsed.memoState) {
        parsed.memoState.lotNumber = newLotNumber;
        parsed.memoState.lotNumberInput = String(newLotNumber);
      }
      localStorage.setItem(memoKey, JSON.stringify(parsed));
    } catch (e) {}
  }

  // 2. Scan and migrate any existing sales_memo_lot_*_memo_${cleanId} keys
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_lot_') && k.endsWith(`_memo_${cleanId}`)) {
      try {
        const obj = JSON.parse(localStorage.getItem(k) || '{}');
        obj.lotNumber = newLotNumber;
        obj.lotNumberInput = String(newLotNumber);
        if (obj.memoState) {
          obj.memoState.lotNumber = newLotNumber;
          obj.memoState.lotNumberInput = String(newLotNumber);
        }
        localStorage.removeItem(k);
        localStorage.setItem(`sales_memo_lot_${newLotNumber}_memo_${cleanId}`, JSON.stringify(obj));
      } catch (e) {}
    }
  }

  // Ensure new lot key exists
  const targetLotKey = `sales_memo_lot_${newLotNumber}_memo_${cleanId}`;
  if (!localStorage.getItem(targetLotKey) && memoStr) {
    try {
      const parsed = JSON.parse(memoStr);
      parsed.lotNumber = newLotNumber;
      parsed.lotNumberInput = String(newLotNumber);
      localStorage.setItem(targetLotKey, JSON.stringify(parsed));
    } catch (e) {}
  }

  // 3. Update due_memo_${cleanId}
  const dueKey = `due_memo_${cleanId}`;
  const dueStr = localStorage.getItem(dueKey);
  if (dueStr) {
    try {
      const parsed = JSON.parse(dueStr);
      parsed.lotNumber = newLotNumber;
      parsed.lotNumberInput = String(newLotNumber);
      if (parsed.memoState) {
        parsed.memoState.lotNumber = newLotNumber;
        parsed.memoState.lotNumberInput = String(newLotNumber);
      }
      localStorage.setItem(dueKey, JSON.stringify(parsed));
    } catch (e) {}
  }

  // 4. Update sales_memo_list_* (remove from old, add/update in target)
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sales_memo_list_')) {
      try {
        const listStr = localStorage.getItem(k);
        if (listStr) {
          const list = JSON.parse(listStr);
          if (Array.isArray(list)) {
            const isTarget = k === `sales_memo_list_${newLotNumber}`;
            let filtered = list.filter((item: any) => String(item.id) !== cleanId);
            if (isTarget) {
              const itemToAdd = list.find((item: any) => String(item.id) === cleanId) || (memoStr ? JSON.parse(memoStr) : { id: cleanId });
              itemToAdd.lotNumber = newLotNumber;
              filtered.push(itemToAdd);
            }
            localStorage.setItem(k, JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    }
  }

  // 5. Update timestamps
  try {
    const tsRaw = localStorage.getItem('local_timestamps');
    let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
    tsMap[memoKey] = Date.now();
    tsMap[targetLotKey] = Date.now();
    localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
  } catch (err) {}

  window.dispatchEvent(new Event('storage'));
  return { success: true, memoTitle };
};


