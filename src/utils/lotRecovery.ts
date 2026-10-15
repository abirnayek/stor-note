import { pushUnsyncedLocalData } from './syncEngine';
import { getTrashItems, permanentlyDeleteFromTrash } from './trashUtils';

export const RECOVERED_LOT_2_MEMO = {
  supplierName: "Emon v",
  supplierPhone: "",
  totalPriceMain: 39379,
  totalCostMain: "",
  globalProfitPercent: "",
  paidAmount: "",
  status: "due",
  createdAt: "১১ অক্টো, ২০২৬",
  updatedAt: "১৩ অক্টো, ২০২৬",
  entries: [
    {
      id: "1791709631251",
      name: "kakra kalo",
      totalKg: 60,
      weightUnit: "kg",
      totalPrice: 6550,
      profitPercent: ""
    },
    {
      id: "1791710259231",
      name: "blue swem",
      totalKg: 19.6,
      weightUnit: "kg",
      totalPrice: 6000,
      profitPercent: ""
    },
    {
      id: "1791710434318",
      name: "poya ",
      totalKg: 8.6,
      weightUnit: "kg",
      totalPrice: 1370,
      profitPercent: ""
    },
    {
      id: "1791710464637",
      name: "chingri ",
      totalKg: 12.2,
      weightUnit: "kg",
      totalPrice: 2320,
      profitPercent: ""
    },
    {
      id: "1791710481534",
      name: "surma ",
      totalKg: 21.7,
      weightUnit: "kg",
      totalPrice: 6293,
      profitPercent: ""
    },
    {
      id: "1791710602221",
      name: "lalpoya",
      totalKg: 12.4,
      weightUnit: "kg",
      totalPrice: 4340,
      profitPercent: ""
    },
    {
      id: "1791710629046",
      name: "kalo chada",
      totalKg: 2.2,
      weightUnit: "kg",
      totalPrice: 550,
      profitPercent: ""
    },
    {
      id: "1791710674015",
      name: "loytta",
      totalKg: 22,
      weightUnit: "kg",
      totalPrice: 2376,
      profitPercent: ""
    },
    {
      id: "1791710874632",
      name: "tuna 2",
      totalKg: 10,
      weightUnit: "kg",
      totalPrice: 2400,
      profitPercent: ""
    },
    {
      id: "1791711217934",
      name: "Koy koral",
      totalKg: 5.7,
      weightUnit: "kg",
      totalPrice: 2680,
      profitPercent: ""
    },
    {
      id: "1791711422400",
      name: "rup chada",
      totalKg: 10,
      weightUnit: "kg",
      totalPrice: 4500,
      profitPercent: ""
    }
  ]
};

export const RECOVERED_LOT_2_DUE = {
  id: "purchase_lot_2",
  type: "purchase",
  name: "Emon v",
  address: "",
  mobile: "",
  lotNumber: "2",
  deposit: 0,
  date: "১১ অক্টো, ২০২৬",
  entries: RECOVERED_LOT_2_MEMO.entries.map((e, index) => ({
    id: e.id,
    serialNo: (index + 1).toString(),
    name: e.name,
    totalKg: e.totalKg,
    weightUnit: e.weightUnit,
    buyRate: e.totalPrice,
    profitPercent: "",
    manualSaleRate: e.totalPrice
  }))
};

/**
 * Checks if a stored memo object is completely blank/empty (no real data).
 */
export function isMemoEmpty(memo: any): boolean {
  if (!memo) return true;
  const hasSupplier = Boolean(memo.supplierName && memo.supplierName.trim());
  const hasEntries = Array.isArray(memo.entries) && memo.entries.some((e: any) => e && (e.name?.trim() || e.totalKg || e.totalPrice));
  const hasTotal = Boolean(Number(memo.totalPriceMain) > 0);
  return !hasSupplier && !hasEntries && !hasTotal;
}

/**
 * Recovers Lot 2 data automatically if it was lost or emptied.
 */
export function runLotRecovery(): boolean {
  try {
    const rawMemo2 = localStorage.getItem('memo_lot_2');
    const rawMemo02 = localStorage.getItem('memo_lot_02');
    const rawDue2 = localStorage.getItem('due_memo_purchase_lot_2');

    let memo2Obj = null;
    let memo02Obj = null;
    let due2Obj = null;

    try { if (rawMemo2) memo2Obj = JSON.parse(rawMemo2); } catch (e) {}
    try { if (rawMemo02) memo02Obj = JSON.parse(rawMemo02); } catch (e) {}
    try { if (rawDue2) due2Obj = JSON.parse(rawDue2); } catch (e) {}

    const is2Empty = isMemoEmpty(memo2Obj);
    const is02Empty = isMemoEmpty(memo02Obj);
    const isDueEmpty = isMemoEmpty(due2Obj);

    // If any valid memo exists already, we don't need to force overwrite
    if (!is2Empty) {
      return false;
    }

    let restoredData = null;

    // 1. Check if 02 has valid data
    if (!is02Empty && memo02Obj) {
      restoredData = memo02Obj;
    }

    // 2. Check if due_memo_purchase_lot_2 has valid data
    if (!restoredData && !isDueEmpty && due2Obj) {
      if (due2Obj.memoState && !isMemoEmpty(due2Obj.memoState)) {
        restoredData = due2Obj.memoState;
      }
    }

    // 3. Check trash_items
    if (!restoredData) {
      const trashItems = getTrashItems();
      const trashMatch = trashItems.find(t => 
        t.id === 'lot_2' || 
        t.id === 'purchase_lot_2' || 
        t.id === 'sales_memo_lot_2_memo_purchase_lot_2' || 
        t.id === 'sales_memo_purchase_lot_2' ||
        (t.title && (t.title.includes('Lot: 2') || t.title.includes('Lot 2')) && t.data?.entries?.length > 1)
      );

      if (trashMatch && trashMatch.data && !isMemoEmpty(trashMatch.data)) {
        const d = trashMatch.data;
        // Transform if it has customerName instead of supplierName
        restoredData = {
          supplierName: d.supplierName || d.customerName || "Emon v",
          supplierPhone: d.supplierPhone || d.mobile || "",
          totalPriceMain: d.totalPriceMain || d.entries?.reduce((s: number, e: any) => s + (Number(e.totalPrice) || 0), 0) || 39379,
          totalCostMain: d.totalCostMain || "",
          globalProfitPercent: d.globalProfitPercent || "",
          paidAmount: d.paidAmount || "",
          status: d.status || "due",
          createdAt: d.createdAt || "১১ অক্টো, ২০২৬",
          updatedAt: d.updatedAt || "১৩ অক্টো, ২০২৬",
          entries: d.entries || RECOVERED_LOT_2_MEMO.entries
        };
        // Remove from trash since it is restored
        permanentlyDeleteFromTrash(trashMatch.id);
      }
    }

    // 4. Fallback to recovered payload if still empty
    if (!restoredData) {
      restoredData = RECOVERED_LOT_2_MEMO;
    }

    console.log('[LotRecovery] Restoring Lot 2 purchase memo...', restoredData);

    const memoJson = JSON.stringify(restoredData);
    localStorage.setItem('memo_lot_2', memoJson);
    localStorage.setItem('memo_lot_02', memoJson);

    // Save due memo
    const dueMemo = {
      ...RECOVERED_LOT_2_DUE,
      name: restoredData.supplierName || "Emon v",
      date: restoredData.createdAt || "১১ অক্টো, ২০২৬",
      entries: (restoredData.entries || []).map((e: any, idx: number) => ({
        id: e.id || String(Date.now() + idx),
        serialNo: (idx + 1).toString(),
        name: e.name || `পণ্য ${idx + 1}`,
        totalKg: e.totalKg,
        weightUnit: e.weightUnit || 'kg',
        buyRate: e.totalPrice || '',
        profitPercent: e.profitPercent !== undefined ? e.profitPercent : '',
        manualSaleRate: e.totalPrice || ''
      }))
    };
    const dueJson = JSON.stringify(dueMemo);
    localStorage.setItem('due_memo_purchase_lot_2', dueJson);
    localStorage.setItem('due_memo_purchase_lot_02', dueJson);

    // Ensure purchase_lots_list includes 2
    try {
      const pLotsStr = localStorage.getItem('purchase_lots_list');
      const pLots: number[] = pLotsStr ? JSON.parse(pLotsStr) : [];
      if (!pLots.includes(2)) {
        const updatedLots = [...pLots, 2].sort((a, b) => a - b);
        localStorage.setItem('purchase_lots_list', JSON.stringify(updatedLots));
      }
    } catch (e) {}

    // Ensure dues_purchase includes purchase_lot_2
    try {
      const duesStr = localStorage.getItem('dues_purchase');
      const dues: string[] = duesStr ? JSON.parse(duesStr) : [];
      if (!dues.includes('purchase_lot_2')) {
        dues.push('purchase_lot_2');
        localStorage.setItem('dues_purchase', JSON.stringify(dues));
      }
    } catch (e) {}

    // Clean trash of any dangling lot 2 purchase records
    permanentlyDeleteFromTrash('sales_memo_lot_2_memo_purchase_lot_2');
    permanentlyDeleteFromTrash('sales_memo_purchase_lot_2');

    // Trigger background sync to Supabase
    pushUnsyncedLocalData(false);

    window.dispatchEvent(new Event('storage'));
    return true;
  } catch (err) {
    console.error('[LotRecovery] Error running recovery:', err);
    return false;
  }
}
