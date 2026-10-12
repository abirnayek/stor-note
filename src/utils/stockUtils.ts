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

  // 1. Fetch Purchase Lot Data
  let purchaseData: any = null;
  const directKey = `memo_lot_${normLot}`;
  const rawPurchase = localStorage.getItem(directKey) || localStorage.getItem(`memo_lot_${String(normLot).padStart(2, '0')}`);
  if (rawPurchase) {
    try {
      purchaseData = JSON.parse(rawPurchase);
    } catch (e) {}
  }

  // Fallback check in due_memo_purchase_lot_*
  if (!purchaseData) {
    const duePurchase = localStorage.getItem(`due_memo_purchase_lot_${normLot}`);
    if (duePurchase) {
      try {
        const parsed = JSON.parse(duePurchase);
        purchaseData = parsed.memoState || parsed;
      } catch (e) {}
    }
  }

  const supplierName = purchaseData?.supplierName || purchaseData?.name || '';
  const date = purchaseData?.createdAt || purchaseData?.date || '';
  const purchaseEntries: any[] = Array.isArray(purchaseData?.entries) ? purchaseData.entries : [];

  // 2. Fetch All Sales Memos for this Lot
  const salesMemosMap = new Map<string, any>();

  // Check sales_memo_list_*
  const listKeys = [`sales_memo_list_${normLot}`, `sales_memo_list_lot_${normLot}`];
  listKeys.forEach(listKey => {
    const listStr = localStorage.getItem(listKey);
    if (listStr) {
      try {
        const memoIds: string[] = JSON.parse(listStr);
        memoIds.forEach(id => {
          const mKey = `sales_memo_lot_${normLot}_memo_${id}`;
          const mStr = localStorage.getItem(mKey);
          if (mStr) {
            try { salesMemosMap.set(id, JSON.parse(mStr)); } catch(e) {}
          }
        });
      } catch (e) {}
    }
  });

  // Direct scan of all sales_memo_lot_${normLot}_memo_*
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(`sales_memo_lot_${normLot}_memo_`) || key.startsWith(`sales_memo_lot_${String(normLot).padStart(2, '0')}_memo_`))) {
      const parts = key.split('_memo_');
      if (parts.length === 2) {
        const memoId = parts[1];
        if (!salesMemosMap.has(memoId)) {
          try {
            salesMemosMap.set(memoId, JSON.parse(localStorage.getItem(key) || '{}'));
          } catch (e) {}
        }
      }
    }
  }

  // Also check due_memo_*
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('due_memo_')) {
      const memoId = key.replace('due_memo_', '');
      if (!salesMemosMap.has(memoId)) {
        try {
          const dueObj = JSON.parse(localStorage.getItem(key) || '{}');
          const lotNum = dueObj.lotNumber ? parseInt(dueObj.lotNumber, 10) : null;
          if (lotNum === normLot && (dueObj.type === 'regular' || dueObj.type === 'permanent')) {
            salesMemosMap.set(memoId, dueObj.memoState || dueObj);
          }
        } catch (e) {}
      }
    }
  }

  // 3. Aggregate Sales by fish name & serialNo
  const soldBySerial = new Map<number, number>();
  const soldByName = new Map<string, number>();

  salesMemosMap.forEach(memo => {
    const entries: any[] = Array.isArray(memo.entries) ? memo.entries : [];
    entries.forEach(entry => {
      let weight = Number(entry.totalKg) || 0;
      if (entry.weightUnit === 'g') {
        weight = weight / 1000;
      }
      if (weight <= 0) return;

      const serialNo = Number(entry.serialNo);
      const name = (entry.name || '').trim().toLowerCase();

      if (!isNaN(serialNo) && serialNo > 0) {
        soldBySerial.set(serialNo, (soldBySerial.get(serialNo) || 0) + weight);
      }
      if (name) {
        soldByName.set(name, (soldByName.get(name) || 0) + weight);
      }
    });
  });

  // 4. Calculate Stock for each purchased fish entry
  let totalPurchasedKg = 0;
  let totalSoldKg = 0;
  let totalRemainingKg = 0;

  const items: FishStockItem[] = purchaseEntries.map((entry, index) => {
    const serialNo = index + 1;
    const name = (entry.name || '').trim();
    const nameKey = name.toLowerCase();

    let purchasedKg = Number(entry.totalKg) || 0;
    if (entry.weightUnit === 'g') {
      purchasedKg = purchasedKg / 1000;
    }

    // Determine sold amount: check match by serialNo first, then by name
    let soldKg = 0;
    if (soldBySerial.has(serialNo)) {
      soldKg = soldBySerial.get(serialNo) || 0;
    } else if (nameKey && soldByName.has(nameKey)) {
      soldKg = soldByName.get(nameKey) || 0;
    }

    // Avoid rounding floating point quirks
    purchasedKg = Math.round(purchasedKg * 100) / 100;
    soldKg = Math.round(soldKg * 100) / 100;
    const remainingKg = Math.max(0, Math.round((purchasedKg - soldKg) * 100) / 100);

    totalPurchasedKg += purchasedKg;
    totalSoldKg += soldKg;
    totalRemainingKg += remainingKg;

    let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (remainingKg <= 0.001) {
      status = 'out_of_stock';
    } else if (remainingKg <= purchasedKg * 0.25) {
      status = 'low_stock';
    }

    const buyPrice = Number(entry.totalPrice) || 0;
    const buyRate = purchasedKg > 0 ? Math.round((buyPrice / purchasedKg) * 100) / 100 : 0;

    return {
      id: entry.id || String(serialNo),
      serialNo,
      name: name || `মাছ ${serialNo}`,
      purchasedKg,
      soldKg,
      remainingKg,
      buyRate,
      unit: entry.weightUnit || 'kg',
      status
    };
  });

  return {
    lotNumber: normLot,
    supplierName,
    date,
    totalPurchasedKg: Math.round(totalPurchasedKg * 100) / 100,
    totalSoldKg: Math.round(totalSoldKg * 100) / 100,
    totalRemainingKg: Math.round(totalRemainingKg * 100) / 100,
    items
  };
};

/**
 * Calculates stock across all purchase lots
 */
export const getAllLotsStock = (): LotStockSummary[] => {
  const lotNumbersSet = new Set<number>();

  // Read saved purchase lots list
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

  // Scan all memo_lot_* keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('memo_lot_')) {
      const lotStr = key.replace('memo_lot_', '');
      const num = normalizeLotNumber(lotStr);
      if (num) lotNumbersSet.add(num);
    }
  }

  // Default to at least Lot 1 if nothing found
  if (lotNumbersSet.size === 0) {
    lotNumbersSet.add(1);
  }

  const sortedLots = Array.from(lotNumbersSet).sort((a, b) => a - b);
  return sortedLots.map(lotNum => getLotStock(lotNum));
};
