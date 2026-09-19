export interface TrashedItem {
  id: string;
  type: 'purchase_lot' | 'sales_lot' | 'due_memo' | 'investor_folder';
  title: string;
  data: any;
  deletedAt: number;
}

const TRASH_STORAGE_KEY = 'trash_items';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const getTrashItems = (): TrashedItem[] => {
  const saved = localStorage.getItem(TRASH_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return [];
    }
  }
  return [];
};

export const moveToTrash = (item: Omit<TrashedItem, 'deletedAt'>) => {
  const currentTrash = getTrashItems();
  const newItem: TrashedItem = {
    ...item,
    deletedAt: Date.now()
  };
  localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify([...currentTrash, newItem]));
};

export const restoreFromTrash = (item: TrashedItem) => {
  // Add item back to its respective place
  if (item.type === 'purchase_lot') {
    const existingLotsStr = localStorage.getItem('purchase_lots_list');
    const existingLots: number[] = existingLotsStr ? JSON.parse(existingLotsStr) : [];
    const lotNum = parseInt(item.id.replace('lot_', ''));
    if (!existingLots.includes(lotNum)) {
      localStorage.setItem('purchase_lots_list', JSON.stringify([...existingLots, lotNum].sort((a,b) => a-b)));
    }
    localStorage.setItem(`memo_lot_${lotNum}`, JSON.stringify(item.data));
  } else if (item.type === 'sales_lot') {
    const existingLotsStr = localStorage.getItem('sales_lots_list');
    const existingLots: number[] = existingLotsStr ? JSON.parse(existingLotsStr) : [];
    const lotNum = parseInt(item.id.replace('sales_lot_', ''));
    if (!existingLots.includes(lotNum)) {
      localStorage.setItem('sales_lots_list', JSON.stringify([...existingLots, lotNum].sort((a,b) => a-b)));
    }
    localStorage.setItem(`sales_memo_lot_${lotNum}`, JSON.stringify(item.data));
  } else if (item.type === 'due_memo') {
    const dueType = item.data.type || 'regular';
    const existingDuesStr = localStorage.getItem(`dues_${dueType}`);
    const existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
    if (!existingDues.includes(item.id)) {
      localStorage.setItem(`dues_${dueType}`, JSON.stringify([...existingDues, item.id]));
    }
    localStorage.setItem(`due_memo_${item.id}`, JSON.stringify(item.data));
  }

  // Remove from trash
  permanentlyDeleteFromTrash(item.id);
};

export const permanentlyDeleteFromTrash = (id: string) => {
  const currentTrash = getTrashItems();
  const newTrash = currentTrash.filter(item => item.id !== id);
  localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
};

export const cleanupTrash = () => {
  const currentTrash = getTrashItems();
  const now = Date.now();
  let hasExpired = false;

  const newTrash = currentTrash.filter(item => {
    if (now - item.deletedAt >= THIRTY_DAYS_MS) {
      hasExpired = true;
      return false; // Remove expired items
    }
    return true;
  });

  if (hasExpired) {
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
  }
};
