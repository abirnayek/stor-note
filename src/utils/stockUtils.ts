import { isMemoDeleted } from './syncEngine';
import { getMemoExactTimestamp } from './dateUtils';

export interface FishStockItem {
  id: string;
  serialNo: number;
  name: string;
  purchasedKg: number;
  soldKg: number;
  remainingKg: number;
  buyRate: number;
  unit: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface LotStockSummary {
  lotNumber: number;
  supplierName: string;
  date: string;
  totalPurchasedKg: number;
  totalSoldKg: number;
  totalRemainingKg: number;
  items: FishStockItem[];
}

/**
 * Normalizes lot number to an integer
 */
export const normalizeLotNumber = (lot: any): number | null => {
  if (lot === null || lot === undefined || lot === '') return null;
  const num = parseInt(String(lot), 10);
  return !isNaN(num) && num > 0 ? num : null;
};

export const normalizeFishKey = (name: string): string => {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]/g, '');
};

/**
 * Intelligent fish matching supporting aliases, Bengali transliterations, and seafood types
 */
export const matchesFish = (soldName: string, purchaseName: string): boolean => {
  const s = (soldName || '').trim().toLowerCase();
  const p = (purchaseName || '').trim().toLowerCase();
  if (!s || !p) return false;

  // 1. Exact string match
  if (s === p) return true;

  const sNorm = normalizeFishKey(s);
  const pNorm = normalizeFishKey(p);
  if (sNorm === pNorm) return true;

  // Check Jhatka (জাটকা) distinction
  const isJhatkaS = sNorm.includes('jhatka') || sNorm.includes('zatka') || sNorm.includes('jatka') || s.includes('জাটকা');
  const isJhatkaP = pNorm.includes('jhatka') || pNorm.includes('zatka') || pNorm.includes('jatka') || p.includes('জাটকা');
  if (isJhatkaS !== isJhatkaP) return false;

  // Size/number digits distinction (e.g. 4-5 vs 2 vs 1)
  const sDigits = (s.match(/\d+[\-\/]?\d*/g) || []).join('');
  const pDigits = (p.match(/\d+[\-\/]?\d*/g) || []).join('');
  if (sDigits && pDigits && sDigits !== pDigits) return false;
  if ((sDigits && !pDigits) || (!sDigits && pDigits)) {
    // If one specifies size/grade and the other does not, they are distinct grades
    if (sNorm.includes('elish') || pNorm.includes('elish') || sNorm.includes('tuna') || pNorm.includes('tuna') || sNorm.includes('koral') || pNorm.includes('koral')) {
      return false;
    }
  }

  // 2. Specific seafood aliases & root synonyms
  // Elish (ইলিশ)
  const isElishS = sNorm.includes('elish') || sNorm.includes('ilish') || sNorm.includes('hilsha') || sNorm.includes('hilsa') || s.includes('ইলিশ');
  const isElishP = pNorm.includes('elish') || pNorm.includes('ilish') || pNorm.includes('hilsha') || pNorm.includes('hilsa') || p.includes('ইলিশ');
  if (isElishS && isElishP) {
    if (isJhatkaS && isJhatkaP) return true;
    if (!isJhatkaS && !isJhatkaP && sDigits === pDigits) return true;
    return false;
  }

  // Blue swimmer crab (blue swem / blur kakra / kakra blue / blue swimmer)
  const isBlueCrabS = (sNorm.includes('blue') || sNorm.includes('blur')) && (sNorm.includes('kakra') || sNorm.includes('swem') || sNorm.includes('crab'));
  const isBlueCrabP = (pNorm.includes('blue') || pNorm.includes('blur')) || (pNorm.includes('swem'));
  if (isBlueCrabS && isBlueCrabP) return true;

  // Bele / Bayla (বেলে / বায়লা)
  const isBaylaS = sNorm.includes('bele') || sNorm.includes('bayla') || sNorm.includes('baela');
  const isBaylaP = pNorm.includes('bele') || pNorm.includes('bayla') || pNorm.includes('baela');
  if (isBaylaS && isBaylaP) return true;

  // Rupchanda / Rupchada (রূপচাঁদা / rupchda)
  const isRupS = sNorm.includes('rup') && (sNorm.includes('chad') || sNorm.includes('chd'));
  const isRupP = pNorm.includes('rup') && (pNorm.includes('chad') || pNorm.includes('chd'));
  if (isRupS && isRupP) return true;

  // Kalo Chada (কালো চাঁদা)
  const isKaloS = sNorm.includes('kalo') && (sNorm.includes('chad') || sNorm.includes('chd'));
  const isKaloP = pNorm.includes('kalo') && (pNorm.includes('chad') || pNorm.includes('chd'));
  if (isKaloS && isKaloP) return true;

  // General Crab / Kakra (kakra, mad kakra, kakra boro, kakra choto, kakra mad, kakra kalo, redy cook kakra, redy cook)
  const isKakraS = sNorm.includes('kakra') || sNorm.includes('cook');
  const isKakraP = pNorm.includes('kakra') || pNorm.includes('cook');
  if (isKakraS && isKakraP && !isBlueCrabS && !isBlueCrabP) return true;

  // Koral: Koy Koral vs Datina Koral
  if (sNorm.includes('koy') && sNorm.includes('koral') && pNorm.includes('koy') && pNorm.includes('koral')) return true;
  if (sNorm.includes('datina') && sNorm.includes('koral') && pNorm.includes('datina') && pNorm.includes('koral')) return true;
  if (sNorm.includes('koral') && !sNorm.includes('datina') && pNorm.includes('koy') && pNorm.includes('koral')) return true;

  // Poya: Lal Poya Choto vs Lalpoya vs Poya / Sada Poya
  const isLalPoyaS = (sNorm.includes('lal') && sNorm.includes('poya')) || sNorm.includes('lalpoya');
  const isLalPoyaP = (pNorm.includes('lal') && pNorm.includes('poya')) || pNorm.includes('lalpoya');
  if (isLalPoyaS && isLalPoyaP) return true;
  const isGeneralPoyaS = sNorm.includes('poya') && !isLalPoyaS;
  const isGeneralPoyaP = pNorm.includes('poya') && !isLalPoyaP;
  if (isGeneralPoyaS && isGeneralPoyaP) return true;
  if (sNorm.includes('poya') && pNorm.includes('poya')) return true;

  // Chingri: Chingri Desi vs Chingri general (bagda, golda)
  const isDesiS = sNorm.includes('desi') && sNorm.includes('chingri');
  const isDesiP = pNorm.includes('desi') && pNorm.includes('chingri');
  if (isDesiS && isDesiP) return true;
  const isChingriS = sNorm.includes('chingri') || sNorm.includes('bagda') || sNorm.includes('golda');
  const isChingriP = pNorm.includes('chingri') || pNorm.includes('bagda') || pNorm.includes('golda');
  if (isChingriS && isChingriP) return true;

  // Tuna
  if (sNorm.includes('tuna') && pNorm.includes('tuna')) {
    if (sDigits === pDigits) return true;
    return false;
  }

  // Surma
  if (sNorm.includes('surma') && pNorm.includes('surma')) return true;

  // Loytta
  if (sNorm.includes('loytta') && pNorm.includes('loytta')) return true;

  // Octopus / Oqtopas
  if ((sNorm.includes('octo') || sNorm.includes('oqto')) && (pNorm.includes('octo') || pNorm.includes('oqto'))) return true;

  // Kapila / Kapila bayam
  if (sNorm.includes('kapila') && pNorm.includes('kapila')) return true;

  // Sada bata
  if (sNorm.includes('bata') && pNorm.includes('bata')) return true;

  // Chela
  if (sNorm.includes('chela') && pNorm.includes('chela')) return true;

  // Kata
  if (sNorm.includes('kata') && pNorm.includes('kata')) return true;

  // Mix
  if (sNorm.includes('mix') && pNorm.includes('mix')) return true;

  // Squid / Qatl
  if ((sNorm.includes('squi') || sNorm.includes('qatl')) && (pNorm.includes('squi') || pNorm.includes('qatl'))) return true;

  // Word token matching: only if all meaningful words match
  const sWords = s.split(/[\s\-_,\.\/]+/).filter(w => w.length >= 3);
  const pWords = p.split(/[\s\-_,\.\/]+/).filter(w => w.length >= 3);
  if (sWords.length > 0 && pWords.length > 0 && sWords.length === pWords.length) {
    if (sWords.every((w, i) => pWords[i] === w || pWords[i].includes(w) || w.includes(pWords[i]))) {
      return true;
    }
  }

  return false;
};

export interface ActiveSalesMemoEntry {
  id?: string;
  serialNo?: string;
  name: string;
  totalKg: number | string;
  weightUnit?: string;
  buyRate?: number;
  profitPercent?: number | '';
  manualSaleRate?: number | '';
}

export interface ActiveSalesMemo {
  id: string;
  lotNumber: number | null;
  customerName: string;
  customerType?: string;
  mobile?: string;
  timestamp: number;
  date: string;
  time?: string;
  folderId?: string;
  folderName?: string;
  entries: ActiveSalesMemoEntry[];
}

/**
 * Retrieves all active non-purchase sales memos across all storage keys
 */
export const getAllActiveSalesMemos = (): ActiveSalesMemo[] => {
  const memosMap = new Map<string, ActiveSalesMemo>();

  const processMemo = (memoId: string, explicitLot: number | null, rawObj: any) => {
    if (!memoId || isMemoDeleted(memoId) || !rawObj) return;

    const inner = rawObj.memoState || rawObj;

    // Strict exclusion of purchase memos
    const isPurchase =
      rawObj.type === 'purchase' ||
      inner.type === 'purchase' ||
      rawObj.customerType === 'purchase' ||
      inner.customerType === 'purchase' ||
      memoId.startsWith('purchase_') ||
      (inner.supplierName && !inner.customerName && rawObj.type !== 'regular' && rawObj.type !== 'permanent' && rawObj.type !== 'reseller');

    if (isPurchase) return;

    const rawLot = (inner.lotNumberInput !== undefined && inner.lotNumberInput !== '')
      ? inner.lotNumberInput
      : (inner.lotNumber !== undefined && inner.lotNumber !== '' ? inner.lotNumber : explicitLot);
    const lotNumber = normalizeLotNumber(rawLot);

    const entries = Array.isArray(inner.entries) ? inner.entries : [];

    const timestamp = getMemoExactTimestamp(rawObj);
    const date = inner.createdAt || inner.date || rawObj.date || '';
    const time = inner.createdAtTime || rawObj.createdAtTime || '';
    const customerName = inner.customerName || inner.name || rawObj.name || '';
    const customerType = inner.customerType || rawObj.customerType || 'regular';
    const mobile = inner.mobile || rawObj.mobile || '';
    const folderId = inner.folderId || rawObj.folderId || '';
    const folderName = inner.folderName || rawObj.folderName || '';

    if (memosMap.has(memoId)) {
      const existing = memosMap.get(memoId)!;
      if (existing.lotNumber === null && lotNumber !== null) {
        existing.lotNumber = lotNumber;
      }
      if (entries.length > existing.entries.length) {
        existing.entries = entries;
      }
      if (!existing.timestamp && timestamp) {
        existing.timestamp = timestamp;
      }
      if (!existing.customerName && customerName) existing.customerName = customerName;
      if (!existing.time && time) existing.time = time;
      if (!existing.folderId && folderId) { existing.folderId = folderId; existing.folderName = folderName; }
      return;
    }

    memosMap.set(memoId, {
      id: memoId,
      lotNumber,
      customerName,
      customerType,
      mobile,
      timestamp,
      date,
      time,
      folderId,
      folderName,
      entries
    });
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // 1. Canonical sales memos: sales_memo_*
    if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
      const id = key.replace('sales_memo_', '');
      try {
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        processMemo(id, null, obj);
      } catch (e) {}
    }
    // 2. Direct lot-specific sales memos: sales_memo_lot_*_memo_*
    else if (key.startsWith('sales_memo_lot_') && key.includes('_memo_')) {
      const parts = key.split('_memo_');
      if (parts.length === 2) {
        const id = parts[1];
        const lotPart = parts[0].replace('sales_memo_lot_', '');
        const lotNum = normalizeLotNumber(lotPart);
        try {
          const obj = JSON.parse(localStorage.getItem(key) || '{}');
          processMemo(id, lotNum, obj);
        } catch (e) {}
      }
    }
    // 3. Due memos: due_memo_*
    else if (key.startsWith('due_memo_')) {
      const id = key.replace('due_memo_', '');
      try {
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        const lotNum = normalizeLotNumber(obj.lotNumber);
        processMemo(id, lotNum, obj);
      } catch (e) {}
    }
  }

  return Array.from(memosMap.values());
};

const getAvailableLotNumbers = (): number[] => {
  const lotNumbersSet = new Set<number>();
  const saved = localStorage.getItem('purchase_lots_list');
  if (saved) {
    try {
      const list: any[] = JSON.parse(saved);
      list.forEach(item => {
        const num = normalizeLotNumber(item);
        if (num) lotNumbersSet.add(num);
      });
    } catch (e) {}
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('memo_lot_')) {
      const lotStr = key.replace('memo_lot_', '');
      const num = normalizeLotNumber(lotStr);
      if (num) lotNumbersSet.add(num);
    }
  }
  if (lotNumbersSet.size === 0) {
    lotNumbersSet.add(1);
  }
  return Array.from(lotNumbersSet).sort((a, b) => a - b);
};

const getRawPurchaseData = (lotNumber: number): any => {
  let purchaseData: any = null;
  const directKey = `memo_lot_${lotNumber}`;
  const rawPurchase = localStorage.getItem(directKey) || localStorage.getItem(`memo_lot_${String(lotNumber).padStart(2, '0')}`);
  if (rawPurchase) {
    try { purchaseData = JSON.parse(rawPurchase); } catch (e) {}
  }
  if (!purchaseData) {
    const duePurchase = localStorage.getItem(`due_memo_purchase_lot_${lotNumber}`);
    if (duePurchase) {
      try {
        const parsed = JSON.parse(duePurchase);
        purchaseData = parsed.memoState || parsed;
      } catch (e) {}
    }
  }
  return purchaseData;
};

/**
 * Calculates stock across all purchase lots using intelligent multi-lot FIFO allocation
 */
export const getAllLotsStock = (): LotStockSummary[] => {
  const lotNumbers = getAvailableLotNumbers();

  interface LotInternalItem {
    id: string;
    serialNo: number;
    name: string;
    purchasedKg: number;
    soldKg: number;
    buyRate: number;
    unit: string;
  }

  interface LotInternalData {
    lotNumber: number;
    supplierName: string;
    date: string;
    timestamp: number;
    items: LotInternalItem[];
  }

  const lotsMap = new Map<number, LotInternalData>();

  lotNumbers.forEach(normLot => {
    const purchaseData = getRawPurchaseData(normLot);
    const supplierName = purchaseData?.supplierName || purchaseData?.name || '';
    const date = purchaseData?.createdAt || purchaseData?.date || '';
    const timestamp = getMemoExactTimestamp(purchaseData);
    const purchaseEntries: any[] = Array.isArray(purchaseData?.entries) ? purchaseData.entries : [];

    const items: LotInternalItem[] = purchaseEntries.map((entry, index) => {
      const serialNo = index + 1;
      const name = (entry.name || '').trim();
      let purchasedKg = Number(entry.totalKg) || 0;
      if (entry.weightUnit === 'g') {
        purchasedKg = purchasedKg / 1000;
      }
      purchasedKg = Math.round(purchasedKg * 100) / 100;
      const buyPrice = Number(entry.totalPrice) || 0;
      const buyRate = purchasedKg > 0 ? Math.round((buyPrice / purchasedKg) * 100) / 100 : 0;

      return {
        id: entry.id || String(serialNo),
        serialNo,
        name: name || `মাছ ${serialNo}`,
        purchasedKg,
        soldKg: 0,
        buyRate,
        unit: entry.weightUnit || 'kg'
      };
    });

    lotsMap.set(normLot, {
      lotNumber: normLot,
      supplierName,
      date,
      timestamp,
      items
    });
  });

  // Fetch all active sales memos
  const salesMemos = getAllActiveSalesMemos();

  // Phase 1: Memos with explicit lot number
  salesMemos.forEach(memo => {
    if (memo.lotNumber !== null && lotsMap.has(memo.lotNumber)) {
      const lotObj = lotsMap.get(memo.lotNumber)!;
      memo.entries.forEach(entry => {
        const name = (entry.name || '').trim();
        let weight = Number(entry.totalKg) || 0;
        if (entry.weightUnit === 'g') weight /= 1000;
        if (weight <= 0 || !name) return;

        const matchedItem = lotObj.items.find(item => matchesFish(name, item.name));
        if (matchedItem) {
          matchedItem.soldKg += weight;
        }
      });
    }
  });

  // Phase 2: Unassigned memos (lotNumber === null)
  // Allocate to lot containing that fish, using FIFO across lots (Lot 1, Lot 2, ...)
  const sortedLotNums = Array.from(lotsMap.keys()).sort((a, b) => a - b);

  salesMemos.forEach(memo => {
    if (memo.lotNumber === null) {
      memo.entries.forEach(entry => {
        const name = (entry.name || '').trim();
        let weight = Number(entry.totalKg) || 0;
        if (entry.weightUnit === 'g') weight /= 1000;
        if (weight <= 0 || !name) return;

        // Find candidate items across lots in FIFO order
        // STRICT TEMPORAL GUARD: Unassigned sales can ONLY deduct from lots that existed on or before the sale date!
        const candidateItems: LotInternalItem[] = [];
        sortedLotNums.forEach(lNum => {
          const lObj = lotsMap.get(lNum)!;
          // If memo has timestamp and lot has timestamp, past sale cannot consume from a future lot!
          const isLotExisting = !memo.timestamp || !lObj.timestamp || memo.timestamp >= (lObj.timestamp - 24 * 60 * 60 * 1000);
          if (isLotExisting) {
            const found = lObj.items.find(item => matchesFish(name, item.name));
            if (found) {
              candidateItems.push(found);
            }
          }
        });

        if (candidateItems.length === 0) return;

        let weightToDeduct = weight;
        for (const item of candidateItems) {
          const availableStock = Math.max(0, item.purchasedKg - item.soldKg);
          if (availableStock > 0) {
            const take = Math.min(weightToDeduct, availableStock);
            item.soldKg += take;
            weightToDeduct -= take;
            if (weightToDeduct <= 0.0001) break;
          }
        }
        // Do not force overflow onto lots if stock was not available
      });
    }
  });

  // Build final LotStockSummary
  const result: LotStockSummary[] = [];

  sortedLotNums.forEach(lNum => {
    const lotObj = lotsMap.get(lNum)!;
    let totalPurchasedKg = 0;
    let totalSoldKg = 0;
    let totalRemainingKg = 0;

    const items: FishStockItem[] = lotObj.items.map(item => {
      const purchasedKg = Math.round(item.purchasedKg * 100) / 100;
      const soldKg = Math.round(item.soldKg * 100) / 100;
      const remainingKg = Math.max(0, Math.round((purchasedKg - soldKg) * 100) / 100);

      totalPurchasedKg += purchasedKg;
      totalSoldKg += soldKg;
      totalRemainingKg += remainingKg;

      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (remainingKg <= 0.001) {
        status = 'out_of_stock';
      } else if (remainingKg <= purchasedKg * 0.25 || (purchasedKg >= 10 && remainingKg <= 5) || (remainingKg <= 3 && purchasedKg > 3)) {
        status = 'low_stock';
      }

      return {
        id: item.id,
        serialNo: item.serialNo,
        name: item.name,
        purchasedKg,
        soldKg,
        remainingKg,
        buyRate: item.buyRate,
        unit: item.unit,
        status
      };
    });

    result.push({
      lotNumber: lNum,
      supplierName: lotObj.supplierName,
      date: lotObj.date,
      totalPurchasedKg: Math.round(totalPurchasedKg * 100) / 100,
      totalSoldKg: Math.round(totalSoldKg * 100) / 100,
      totalRemainingKg: Math.round(totalRemainingKg * 100) / 100,
      items
    });
  });

  return result;
};

/**
 * Calculates stock for a specific purchase lot
 */
export const getLotStock = (lotNumber: number): LotStockSummary => {
  const normLot = normalizeLotNumber(lotNumber);
  if (!normLot) {
    return {
      lotNumber: 0,
      supplierName: '',
      date: '',
      totalPurchasedKg: 0,
      totalSoldKg: 0,
      totalRemainingKg: 0,
      items: []
    };
  }

  const allLots = getAllLotsStock();
  const matched = allLots.find(l => l.lotNumber === normLot);
  if (matched) return matched;

  return {
    lotNumber: normLot,
    supplierName: '',
    date: '',
    totalPurchasedKg: 0,
    totalSoldKg: 0,
    totalRemainingKg: 0,
    items: []
  };
};

export interface LotPurchaseFishItem {
  id: string;
  serialNo: number;
  lotNumber: number;
  name: string;
  purchasedKg: number;
  remainingKg: number;
  baseBuyRate: number;
  costPercent: number;
  effectiveCostRate: number; // ক্রয় এবং খরচ হওয়া মোট দাম
  suggestedSaleRate: number;
  profitPercent: number;
}

/**
 * Fetches purchased fish items for a lot with effective cost and suggested sale rate
 */
export const getLotPurchaseItems = (lotNumber: number | null): LotPurchaseFishItem[] => {
  const normLot = normalizeLotNumber(lotNumber);
  if (!normLot) return [];

  const stockSummary = getLotStock(normLot);

  let purchaseData: any = null;
  const rawPurchase = localStorage.getItem(`memo_lot_${normLot}`) || localStorage.getItem(`memo_lot_${String(normLot).padStart(2, '0')}`);
  if (rawPurchase) {
    try { purchaseData = JSON.parse(rawPurchase); } catch (e) {}
  }
  if (!purchaseData) {
    const duePurchase = localStorage.getItem(`due_memo_purchase_lot_${normLot}`);
    if (duePurchase) {
      try {
        const parsed = JSON.parse(duePurchase);
        purchaseData = parsed.memoState || parsed;
      } catch (e) {}
    }
  }

  const purchaseEntries: any[] = Array.isArray(purchaseData?.entries) ? purchaseData.entries : [];
  const totalPriceMain = Number(purchaseData?.totalPriceMain) || 0;
  const totalCostMain = Number(purchaseData?.totalCostMain) || 0;
  const costPercent = (totalPriceMain > 0 && totalCostMain > 0) ? (totalCostMain / totalPriceMain) * 100 : 0;
  const globalProfitPercent = Number(purchaseData?.globalProfitPercent) || 0;

  return purchaseEntries.map((entry, index) => {
    const serialNo = index + 1;
    const name = (entry.name || '').trim();
    let purchasedKg = Number(entry.totalKg) || 0;
    if (entry.weightUnit === 'g') {
      purchasedKg = purchasedKg / 1000;
    }
    const buyPrice = Number(entry.totalPrice) || 0;
    const baseBuyRate = purchasedKg > 0 ? (buyPrice / purchasedKg) : 0;
    const effectiveCostRate = Math.round((baseBuyRate + (baseBuyRate * costPercent / 100)) * 100) / 100;
    const profitPercent = Number(entry.profitPercent !== undefined && entry.profitPercent !== '' ? entry.profitPercent : globalProfitPercent) || 0;
    const suggestedSaleRate = Math.round((effectiveCostRate + (effectiveCostRate * profitPercent / 100)) * 100) / 100;

    const stockItem = stockSummary.items.find(it => matchesFish(name, it.name));
    const remainingKg = stockItem ? stockItem.remainingKg : Math.max(0, purchasedKg);

    return {
      id: entry.id || String(serialNo),
      serialNo,
      lotNumber: normLot,
      name,
      purchasedKg,
      remainingKg,
      baseBuyRate: Math.round(baseBuyRate * 100) / 100,
      costPercent: Math.round(costPercent * 100) / 100,
      effectiveCostRate,
      suggestedSaleRate,
      profitPercent
    };
  }).filter(item => Boolean(item.name));
};

/**
 * Combines purchase items across all lots
 */
export const getAllPurchaseItems = (): LotPurchaseFishItem[] => {
  const allSummaries = getAllLotsStock();
  const items: LotPurchaseFishItem[] = [];
  allSummaries.forEach(summary => {
    const lotItems = getLotPurchaseItems(summary.lotNumber);
    items.push(...lotItems);
  });
  return items;
};

export interface FishMemoSaleDetail {
  memoId: string;
  lotNumber: number | null;
  customerName: string;
  customerType: string;
  mobile: string;
  date: string;
  time: string;
  timestamp: number;
  weightKg: number;
  buyRate: number;
  saleRate: number;
  totalSalePrice: number;
  totalCostPrice: number;
  profit: number;
  isLoss: boolean;
  folderId?: string;
  folderName?: string;
}

export interface FishSalesSummary {
  fishName: string;
  lotNumber: number;
  supplierName: string;
  lotDate: string;
  purchasedKg: number;
  remainingKg: number;
  lotBuyRate: number;
  totalSoldKg: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  avgSaleRate: number;
  memos: FishMemoSaleDetail[];
}

/**
 * Retrieves the complete sales breakdown and memo history for a specific fish in a lot
 */
export const getFishSalesBreakdown = (targetFishName: string, targetLotNumber: number): FishSalesSummary => {
  const normTargetLot = normalizeLotNumber(targetLotNumber) || 1;
  const cleanTargetName = (targetFishName || '').trim();

  // 1. Purchase lot info
  const purchaseData = getRawPurchaseData(normTargetLot);
  const supplierName = purchaseData?.supplierName || purchaseData?.name || '';
  const lotDate = purchaseData?.createdAt || purchaseData?.date || '';
  const lotItems = getLotPurchaseItems(normTargetLot);
  const matchedLotItem = lotItems.find(it => matchesFish(cleanTargetName, it.name) || it.name === cleanTargetName);

  const purchasedKg = matchedLotItem ? matchedLotItem.purchasedKg : 0;
  const lotBuyRate = matchedLotItem ? (matchedLotItem.effectiveCostRate > 0 ? matchedLotItem.effectiveCostRate : matchedLotItem.baseBuyRate) : 0;

  // 2. Set up multi-lot tracking for accurate FIFO allocation across lots
  const lotNumbers = getAvailableLotNumbers();
  interface LotTrackItem {
    name: string;
    purchasedKg: number;
    soldKg: number;
    buyRate: number;
    suggestedSaleRate: number;
  }
  interface LotTrack {
    lotNumber: number;
    timestamp: number;
    items: LotTrackItem[];
  }

  const lotsMap = new Map<number, LotTrack>();
  lotNumbers.forEach(lNum => {
    const pData = getRawPurchaseData(lNum);
    const pItems = getLotPurchaseItems(lNum);
    const items: LotTrackItem[] = pItems.map(pi => ({
      name: pi.name,
      purchasedKg: pi.purchasedKg,
      soldKg: 0,
      buyRate: pi.effectiveCostRate > 0 ? pi.effectiveCostRate : pi.baseBuyRate,
      suggestedSaleRate: pi.suggestedSaleRate
    }));
    lotsMap.set(lNum, {
      lotNumber: lNum,
      timestamp: getMemoExactTimestamp(pData),
      items
    });
  });

  const salesMemos = getAllActiveSalesMemos();
  const matchedMemoSales: FishMemoSaleDetail[] = [];

  const addMemoRecord = (
    memo: ActiveSalesMemo,
    entry: ActiveSalesMemoEntry,
    weightKg: number,
    costRate: number,
    suggestedSaleRate: number
  ) => {
    if (weightKg <= 0) return;
    const currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
    
    let saleRate = 0;
    if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
      const manualRateNum = Number(entry.manualSaleRate) || 0;
      saleRate = manualRateNum + (manualRateNum * currentProfitPercent / 100);
    } else if (suggestedSaleRate > 0) {
      saleRate = suggestedSaleRate + (suggestedSaleRate * currentProfitPercent / 100);
    } else if (costRate > 0) {
      saleRate = costRate + (costRate * currentProfitPercent / 100);
    }
    saleRate = Math.round(saleRate * 100) / 100;
    const effectiveCost = Math.round(costRate * 100) / 100;

    const totalSalePrice = Math.round((weightKg * saleRate) * 100) / 100;
    const totalCostPrice = Math.round((weightKg * effectiveCost) * 100) / 100;
    const profit = Math.round((totalSalePrice - totalCostPrice) * 100) / 100;

    matchedMemoSales.push({
      memoId: memo.id,
      lotNumber: normTargetLot,
      customerName: memo.customerName || '',
      customerType: memo.customerType || 'regular',
      mobile: memo.mobile || '',
      date: memo.date || '',
      time: memo.time || '',
      timestamp: memo.timestamp || 0,
      weightKg: Math.round(weightKg * 100) / 100,
      buyRate: effectiveCost,
      saleRate,
      totalSalePrice,
      totalCostPrice,
      profit,
      isLoss: profit < 0,
      folderId: memo.folderId,
      folderName: memo.folderName
    });
  };

  // Phase 1: Memos with explicit lot number
  salesMemos.forEach(memo => {
    if (memo.lotNumber !== null && lotsMap.has(memo.lotNumber)) {
      const lotObj = lotsMap.get(memo.lotNumber)!;
      memo.entries.forEach(entry => {
        const name = (entry.name || '').trim();
        let weight = Number(entry.totalKg) || 0;
        if (entry.weightUnit === 'g') weight /= 1000;
        if (weight <= 0 || !name) return;

        const matchedItem = lotObj.items.find(item => matchesFish(name, item.name));
        if (matchedItem) {
          matchedItem.soldKg += weight;
          if (memo.lotNumber === normTargetLot && (matchesFish(name, cleanTargetName) || matchesFish(cleanTargetName, matchedItem.name))) {
            const cost = Number(entry.buyRate) > 0 ? Number(entry.buyRate) : matchedItem.buyRate;
            addMemoRecord(memo, entry, weight, cost, matchedItem.suggestedSaleRate);
          }
        }
      });
    }
  });

  // Phase 2: Unassigned memos (lotNumber === null) - FIFO across lots
  const sortedLotNums = Array.from(lotsMap.keys()).sort((a, b) => a - b);
  salesMemos.forEach(memo => {
    if (memo.lotNumber === null) {
      memo.entries.forEach(entry => {
        const name = (entry.name || '').trim();
        let weight = Number(entry.totalKg) || 0;
        if (entry.weightUnit === 'g') weight /= 1000;
        if (weight <= 0 || !name) return;

        // Find candidate items across lots
        const candidateItems: { lotNum: number; item: LotTrackItem }[] = [];
        sortedLotNums.forEach(lNum => {
          const lObj = lotsMap.get(lNum)!;
          const isLotExisting = !memo.timestamp || !lObj.timestamp || memo.timestamp >= (lObj.timestamp - 24 * 60 * 60 * 1000);
          if (isLotExisting) {
            const found = lObj.items.find(item => matchesFish(name, item.name));
            if (found) {
              candidateItems.push({ lotNum: lNum, item: found });
            }
          }
        });

        if (candidateItems.length === 0) return;

        let weightToDeduct = weight;
        for (const candidate of candidateItems) {
          const availableStock = Math.max(0, candidate.item.purchasedKg - candidate.item.soldKg);
          if (availableStock > 0) {
            const take = Math.min(weightToDeduct, availableStock);
            candidate.item.soldKg += take;
            weightToDeduct -= take;

            if (candidate.lotNum === normTargetLot && (matchesFish(name, cleanTargetName) || matchesFish(cleanTargetName, candidate.item.name))) {
              const cost = Number(entry.buyRate) > 0 ? Number(entry.buyRate) : candidate.item.buyRate;
              addMemoRecord(memo, entry, take, cost, candidate.item.suggestedSaleRate);
            }

            if (weightToDeduct <= 0.0001) break;
          }
        }
      });
    }
  });

  // Sort memos newest first
  matchedMemoSales.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const totalSoldKg = Math.round(matchedMemoSales.reduce((sum, m) => sum + m.weightKg, 0) * 100) / 100;
  const totalRevenue = Math.round(matchedMemoSales.reduce((sum, m) => sum + m.totalSalePrice, 0) * 100) / 100;
  const totalCost = Math.round(matchedMemoSales.reduce((sum, m) => sum + m.totalCostPrice, 0) * 100) / 100;
  const totalProfit = Math.round(matchedMemoSales.filter(m => m.profit > 0).reduce((sum, m) => sum + m.profit, 0) * 100) / 100;
  const totalLoss = Math.round(matchedMemoSales.filter(m => m.profit < 0).reduce((sum, m) => sum + Math.abs(m.profit), 0) * 100) / 100;
  const netProfit = Math.round((totalRevenue - totalCost) * 100) / 100;
  const avgSaleRate = totalSoldKg > 0 ? Math.round((totalRevenue / totalSoldKg) * 100) / 100 : 0;
  const remainingKg = Math.max(0, Math.round((purchasedKg - totalSoldKg) * 100) / 100);

  return {
    fishName: cleanTargetName,
    lotNumber: normTargetLot,
    supplierName,
    lotDate,
    purchasedKg,
    remainingKg,
    lotBuyRate,
    totalSoldKg,
    totalRevenue,
    totalCost,
    totalProfit,
    totalLoss,
    netProfit,
    avgSaleRate,
    memos: matchedMemoSales
  };
};
