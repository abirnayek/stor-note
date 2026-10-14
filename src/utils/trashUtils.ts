import { unmarkMemoDeleted } from './syncEngine';

export interface TrashedItem {
  id: string;
  type: 'purchase_lot' | 'sales_lot' | 'due_memo' | 'investor_folder' | 'aratdar_folder' | 'reseller_folder';
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
    if (!isNaN(lotNum)) {
      if (!existingLots.includes(lotNum)) {
        localStorage.setItem('purchase_lots_list', JSON.stringify([...existingLots, lotNum].sort((a,b) => a-b)));
      }
      localStorage.setItem(`memo_lot_${lotNum}`, JSON.stringify(item.data));
    }
  } else if (item.type === 'sales_lot') {
    if (item.id.startsWith('sales_memo_')) {
      const memoId = item.id.replace('sales_memo_', '');
      unmarkMemoDeleted(memoId);
      localStorage.setItem(`sales_memo_${memoId}`, JSON.stringify(item.data));
      const lot = item.data?.lotNumber || item.data?.memoState?.lotNumberInput;
      if (lot) {
        localStorage.setItem(`sales_memo_lot_${lot}_memo_${memoId}`, JSON.stringify(item.data));
      }
    } else if (item.id.startsWith('sales_lot_')) {
      const existingLotsStr = localStorage.getItem('sales_lots_list');
      const existingLots: number[] = existingLotsStr ? JSON.parse(existingLotsStr) : [];
      const lotNum = parseInt(item.id.replace('sales_lot_', ''));
      if (!isNaN(lotNum)) {
        if (!existingLots.includes(lotNum)) {
          localStorage.setItem('sales_lots_list', JSON.stringify([...existingLots, lotNum].sort((a,b) => a-b)));
        }
        localStorage.setItem(`sales_memo_lot_${lotNum}`, JSON.stringify(item.data));
      }
    }
  } else if (item.type === 'due_memo') {
    const rawId = item.id.replace('due_memo_', '');
    unmarkMemoDeleted(rawId);
    const dueType = item.data?.type || 'regular';
    const existingDuesStr = localStorage.getItem(`dues_${dueType}`);
    const existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
    if (!existingDues.includes(rawId)) {
      localStorage.setItem(`dues_${dueType}`, JSON.stringify([...existingDues, rawId]));
    }
    localStorage.setItem(`due_memo_${rawId}`, JSON.stringify(item.data));
    localStorage.setItem(`sales_memo_${rawId}`, JSON.stringify(item.data));
  } else if (item.type === 'aratdar_folder') {
    const rawFolders = localStorage.getItem('aratdar_folders');
    const folders: any[] = rawFolders ? JSON.parse(rawFolders) : [];
    if (!folders.some(f => f.id === item.id)) {
      folders.push(item.data);
      localStorage.setItem('aratdar_folders', JSON.stringify(folders));
    }
  } else if (item.type === 'reseller_folder') {
    const rawFolders = localStorage.getItem('reseller_folders');
    const folders: any[] = rawFolders ? JSON.parse(rawFolders) : [];
    if (!folders.some(f => f.id === item.id)) {
      folders.push(item.data);
      localStorage.setItem('reseller_folders', JSON.stringify(folders));
    }
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
