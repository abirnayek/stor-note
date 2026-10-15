import { MemoSignatureBox } from './MemoSignatureBox';
import { MathInput, DebouncedInput, parseMathOrNumber, focusNewTableRow } from './MathInput';
import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Undo, Redo, MessageCircle, Mail, Share2, Download, Plus, Trash2, Phone, Palette, MinusCircle, Calculator, Zap, Scale, Package, CheckCircle2, AlertCircle, FileText, Calendar, RotateCcw } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CallMenu from './CallMenu';
import { getLotStock, getLotPurchaseItems, getAllPurchaseItems, type LotStockSummary, type LotPurchaseFishItem } from '../utils/stockUtils';
import { parseMemoMonthYear, getMemoExactTimestamp, MONTHS, enToBnDigits, bnToEnDigits } from '../utils/dateUtils';

// Helper to convert date strings to YYYY-MM-DD for native <input type="date">
const getIsoDateForPicker = (dateStr?: string): string => {
  if (!dateStr) return '';
  const enStr = bnToEnDigits(dateStr).trim();
  const isoMatch = enStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return enStr;
  
  const dmyMatch = enStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  
  const parsed = parseMemoMonthYear({ customDate: dateStr, isOriginalDate: false });
  if (parsed.year && parsed.month) {
    const y = parsed.year.toString();
    const m = parsed.month.toString().padStart(2, '0');
    const d = (parsed.day || 1).toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};

// Formats YYYY-MM-DD from picker to standard DD-MM-YYYY
const formatPickerDateToDisplay = (isoStr: string): string => {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return isoStr;
};


interface SalesMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number | null;
  memoId: string;
  onLotChange?: (lot: any) => void;
  onBack?: () => void;
  defaultCustomerType?: 'regular' | 'permanent' | 'reseller';
}

export const HIGHLIGHT_PALETTE: { id: string; name: string; bg: string; border: string; dot: string }[] = [
  { id: 'yellow', name: 'হলুদ', bg: 'rgba(234, 179, 8, 0.18)', border: '#eab308', dot: '#facc15' },
  { id: 'green', name: 'সবুজ', bg: 'rgba(34, 197, 94, 0.18)', border: '#22c55e', dot: '#4ade80' },
  { id: 'orange', name: 'কমলা', bg: 'rgba(249, 115, 22, 0.18)', border: '#f97316', dot: '#fb923c' },
  { id: 'red', name: 'লাল', bg: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', dot: '#f87171' },
  { id: 'blue', name: 'নীল', bg: 'rgba(59, 130, 246, 0.18)', border: '#3b82f6', dot: '#60a5fa' },
  { id: 'purple', name: 'বেগুনি', bg: 'rgba(168, 85, 247, 0.18)', border: '#a855f7', dot: '#c084fc' },
];

export interface MemoDeduction {
  id: string;
  title: string;
  amount: number | '';
}

interface FishEntry {
  id: string;
  serialNo?: string;
  name: string;
  totalKg: number | '';
  weightUnit?: 'kg' | 'g';
  buyRate?: number; // Fetched from lot (acts as investment rate based on cost)
  profitPercent?: number | '';
  manualSaleRate?: number | '';
  highlightColor?: string;
}

interface MemoState {
  customerName: string;
  address: string;
  mobile: string;
  lotNumberInput: string;
  paidAmount: number | '';
  customerType?: 'regular' | 'permanent' | 'reseller' | '';
  status?: 'due' | 'paid' | 'draft';
  createdAt?: string;
  createdAtTime?: string;
  updatedAt?: string;
  updatedAtTime?: string;
  lastModified?: number;
  isOriginalDate?: boolean;
  customDate?: string;
  receiverSignature?: string;
  sellerSignature?: string;
  entries: FishEntry[];
  deductions?: MemoDeduction[];
  note?: string;
  commissionValue?: number | '';
  commissionType?: 'percent' | 'flat';
  commissionOperation?: 'subtract' | 'add';
  folderId?: string;
  folderName?: string;
}

const SalesMemoScreen: React.FC<SalesMemoScreenProps> = ({ onNavigate, lotNumber, memoId, onLotChange, onBack, defaultCustomerType }) => {
  const { t, language } = useLanguage();
  const memoRef = useRef<HTMLDivElement>(null);
  
  const now = new Date();
  const today = now.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const currentTime = now.toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

    const getInitialState = (): MemoState => {
    const hasValidEntries = (str: string | null): boolean => {
      if (!str) return false;
      try {
        const parsed = JSON.parse(str);
        const entries = parsed.entries || (parsed.memoState && parsed.memoState.entries);
        if (entries && Array.isArray(entries) && entries.length > 0) {
          return entries.some((e: any) => 
            (e.name && e.name.trim() !== '') || 
            (e.totalKg !== undefined && e.totalKg !== '' && Number(e.totalKg) > 0) || 
            (e.manualSaleRate !== undefined && e.manualSaleRate !== '' && Number(e.manualSaleRate) > 0) ||
            (e.buyRate !== undefined && e.buyRate !== '' && Number(e.buyRate) > 0)
          );
        }
      } catch(e) {}
      return false;
    };

    const keysToTry = [
      `sales_memo_${memoId}`,
      `sales_memo_lot_${lotNumber === null ? 'unassigned' : lotNumber}_memo_${memoId}`,
      `sales_memo_lot_unassigned_memo_${memoId}`,
    ];
    for (let i = 1; i <= 50; i++) {
      keysToTry.push(`sales_memo_lot_${i}_memo_${memoId}`);
    }

    let savedKey = keysToTry.find(k => hasValidEntries(localStorage.getItem(k)));
    let saved = savedKey ? localStorage.getItem(savedKey) : null;

    if (!saved) {
      savedKey = keysToTry.find(k => localStorage.getItem(k) !== null);
      saved = savedKey ? localStorage.getItem(savedKey) : null;
    }

    let dueData: any = null;
    const dueStr = localStorage.getItem(`due_memo_${memoId}`);
    if (dueStr) {
      try { 
        const parsed = JSON.parse(dueStr);
        // STRICT GUARD: Never import a purchase memo into sales memo!
        const isPurchaseDue = parsed.type === 'purchase' || parsed.customerType === 'purchase' || memoId.startsWith('purchase_') || (parsed.supplierName && !parsed.customerName);
        if (!isPurchaseDue) {
          dueData = parsed;
        }
      } catch(e) {}
    }

    let parsed: any = null;
    if (saved) {
      try { parsed = JSON.parse(saved); } catch(e) {}
    }

    if (parsed || dueData) {
      const src = parsed || dueData.memoState || dueData;
      if (!src.createdAt && dueData?.date) src.createdAt = dueData.date;
      if (!src.createdAt) src.createdAt = today;

      let createdTime = src.createdAtTime || dueData?.createdAtTime;
      if (!createdTime && !isNaN(Number(memoId)) && Number(memoId) > 1000000000) {
        createdTime = new Date(Number(memoId)).toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }

      const finalCustomerName = src.customerName || src.name || src.supplierName || dueData?.customerName || dueData?.name || '';
      const finalAddress = src.address || dueData?.address || '';
      const finalMobile = src.mobile || dueData?.mobile || '';
      const finalLotNumber = src.lotNumberInput || (src.lotNumber ? src.lotNumber.toString() : '') || (dueData?.lotNumber ? dueData.lotNumber.toString() : '') || (lotNumber ? lotNumber.toString() : '');
      const finalPaidAmount = src.paidAmount !== undefined && src.paidAmount !== ''
        ? src.paidAmount
        : (src.deposit !== undefined && src.deposit !== ''
          ? src.deposit
          : (dueData?.paidAmount !== undefined && dueData?.paidAmount !== ''
            ? dueData.paidAmount
            : (dueData?.deposit !== undefined ? dueData.deposit : '')));
      const finalCustomerType = src.customerType || src.type || dueData?.customerType || dueData?.type || defaultCustomerType || 'regular';

      const rawEntries = (src.entries && Array.isArray(src.entries) && src.entries.some((e: any) => e.name || e.totalKg || e.manualSaleRate || e.buyRate))
        ? src.entries
        : ((dueData?.entries && Array.isArray(dueData.entries) && dueData.entries.length > 0)
          ? dueData.entries
          : ((dueData?.memoState?.entries && Array.isArray(dueData.memoState.entries) && dueData.memoState.entries.length > 0)
            ? dueData.memoState.entries
            : (src.entries || [])));

      const entriesToSet = (rawEntries && rawEntries.length > 0)
        ? rawEntries.map((e: any, idx: number) => {
            let saleRateVal = '';
            if (e.manualSaleRate !== undefined && e.manualSaleRate !== '') {
              saleRateVal = e.manualSaleRate;
            } else if (e.saleRate !== undefined && e.saleRate !== '') {
              saleRateVal = e.saleRate;
            } else if (e.rate !== undefined && e.rate !== '') {
              saleRateVal = e.rate;
            } else if (e.buyRate && (!e.profitPercent || Number(e.profitPercent) === 0)) {
              saleRateVal = e.buyRate;
            }

            return {
              id: e.id || `entry_${Date.now()}_${idx}`,
              serialNo: e.serialNo ? e.serialNo.toString() : (idx + 1).toString(),
              name: e.name || e.fishName || '',
              totalKg: e.totalKg !== undefined ? e.totalKg : (e.kg !== undefined ? e.kg : ''),
              weightUnit: e.weightUnit || 'kg',
              buyRate: e.buyRate !== undefined ? e.buyRate : '',
              profitPercent: e.profitPercent !== undefined ? e.profitPercent : '',
              manualSaleRate: saleRateVal,
              highlightColor: e.highlightColor
            };
          })
        : [{ id: Date.now().toString(), serialNo: '1', name: '', totalKg: '', weightUnit: 'kg', profitPercent: '', manualSaleRate: '' }];

      const rawDeductions: MemoDeduction[] = (src.deductions && Array.isArray(src.deductions))
        ? src.deductions
        : ((dueData?.deductions && Array.isArray(dueData.deductions))
          ? dueData.deductions
          : ((dueData?.memoState?.deductions && Array.isArray(dueData.memoState.deductions))
            ? dueData.memoState.deductions
            : []));

      return {
        customerName: finalCustomerName,
        address: finalAddress,
        mobile: finalMobile,
        lotNumberInput: finalLotNumber,
        paidAmount: finalPaidAmount,
        customerType: finalCustomerType,
        status: src.status || dueData?.status || 'draft',
        createdAt: src.createdAt || today,
        createdAtTime: createdTime || currentTime,
        updatedAt: src.updatedAt,
        updatedAtTime: src.updatedAtTime,
        isOriginalDate: src.isOriginalDate !== undefined ? src.isOriginalDate : true,
        customDate: src.customDate || '',
        receiverSignature: src.receiverSignature || dueData?.receiverSignature || '',
        sellerSignature: src.sellerSignature || dueData?.sellerSignature || localStorage.getItem('default_seller_signature') || '',
        entries: entriesToSet,
        deductions: rawDeductions,
        note: src.note || dueData?.note || '',
        commissionValue: (() => {
          let raw = src.commissionValue !== undefined ? src.commissionValue : (dueData?.commissionValue !== undefined ? dueData.commissionValue : '');
          if (typeof raw === 'object' && raw !== null) {
            raw = (raw as any).target?.value ?? (raw as any).value ?? (raw as any).amount ?? '';
          }
          return raw === '' ? '' : (Number(raw) || '');
        })(),
        commissionType: (src.commissionType || dueData?.commissionType || 'percent') as 'percent' | 'flat',
        commissionOperation: (src.commissionOperation || dueData?.commissionOperation || 'subtract') as 'subtract' | 'add',
        folderId: src.folderId || dueData?.folderId || '',
        folderName: src.folderName || dueData?.folderName || ''
      };
    }

    return {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: lotNumber ? lotNumber.toString() : '',
      paidAmount: '',
      customerType: defaultCustomerType || 'regular',
      status: 'draft',
      createdAt: today,
      createdAtTime: currentTime,
      isOriginalDate: true,
      customDate: '',
      sellerSignature: localStorage.getItem('default_seller_signature') || '',
      entries: [{ id: Date.now().toString(), serialNo: '1', name: '', totalKg: '', weightUnit: 'kg', profitPercent: '', manualSaleRate: '' }],
      deductions: [],
      note: '',
      commissionValue: '',
      commissionType: 'percent',
      commissionOperation: 'subtract',
      folderId: '',
      folderName: ''
    };
  };

  const storageKey = `sales_memo_${memoId}`;
  const [memoState, setMemoState, undo, redo, canUndo, canRedo] = useHistory<MemoState>(getInitialState(), storageKey);
  const datePickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSigChange = () => {
      const defaultSig = localStorage.getItem('default_seller_signature') || '';
      if (defaultSig) {
        setMemoState(prev => (prev.sellerSignature === defaultSig ? prev : { ...prev, sellerSignature: defaultSig }), { recordHistory: false });
      }
    };
    window.addEventListener('global_seller_signature_changed', handleSigChange);
    return () => {
      window.removeEventListener('global_seller_signature_changed', handleSigChange);
    };
  }, []);
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showCustomerCallMenu, setShowCustomerCallMenu] = useState(false);
  const [currentLotStock, setCurrentLotStock] = useState<LotStockSummary | null>(null);

  useEffect(() => {
    const rawLot = memoState.lotNumberInput ? parseInt(memoState.lotNumberInput, 10) : lotNumber;
    if (rawLot && !isNaN(rawLot) && rawLot > 0) {
      setCurrentLotStock(getLotStock(rawLot));
    } else {
      setCurrentLotStock(null);
    }
  }, [memoState.lotNumberInput, lotNumber]);

  const [activeSuggestRowId, setActiveSuggestRowId] = useState<string | null>(null);

  const lotPurchaseItems = React.useMemo(() => {
    const rawLot = memoState.lotNumberInput ? parseInt(memoState.lotNumberInput, 10) : lotNumber;
    if (rawLot && !isNaN(rawLot) && rawLot > 0) {
      return getLotPurchaseItems(rawLot);
    }
    return getAllPurchaseItems();
  }, [memoState.lotNumberInput, lotNumber]);

  const findLotItemByName = (name: string): LotPurchaseFishItem | null => {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim().toLowerCase();
    return lotPurchaseItems.find(it => it.name.trim().toLowerCase() === trimmed) || null;
  };

  const handleSelectFishSuggestion = (entryId: string, item: LotPurchaseFishItem) => {
    setMemoState(prev => {
      const updated: FishEntry[] = prev.entries.map(e => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          name: item.name,
          buyRate: item.effectiveCostRate,
          manualSaleRate: item.suggestedSaleRate > 0 ? item.suggestedSaleRate : item.effectiveCostRate,
          profitPercent: (item.profitPercent > 0 ? item.profitPercent : (typeof e.profitPercent === 'number' ? e.profitPercent : '')) as (number | '')
        };
      });
      return { ...prev, entries: updated };
    }, { immediate: true });
    setActiveSuggestRowId(null);

    // Auto-focus next input (weight / totalKg) in the same row
    setTimeout(() => {
      try {
        const activeContainer = document.querySelector(`[data-entry-id="${entryId}"]`) || document.querySelector('.fish-autocomplete-dropdown')?.closest('tr');
        if (activeContainer) {
          const rowInputs = Array.from(activeContainer.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
          if (rowInputs.length > 1) {
            rowInputs[1].focus();
            rowInputs[1].select();
          }
        }
      } catch (e) {}
    }, 60);
  };

  useEffect(() => {
    const handleSuggestOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.fish-autocomplete-dropdown') && !target.closest('.fish-name-input-container')) {
        setActiveSuggestRowId(null);
      }
    };
    if (activeSuggestRowId) {
      document.addEventListener('mousedown', handleSuggestOutside);
    }
    return () => document.removeEventListener('mousedown', handleSuggestOutside);
  }, [activeSuggestRowId]);

  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.highlight-color-picker-popover') && !target.closest('.btn-color-picker-trigger')) {
        setActiveColorPickerId(null);
      }
    };
    if (activeColorPickerId) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [activeColorPickerId]);

  const [showLossPopover, setShowLossPopover] = useState(false);

  useEffect(() => {
    const handleOutsideLoss = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.loss-details-popover') && !target.closest('.metric-box-loss')) {
        setShowLossPopover(false);
      }
    };
    if (showLossPopover) {
      document.addEventListener('mousedown', handleOutsideLoss);
    }
    return () => document.removeEventListener('mousedown', handleOutsideLoss);
  }, [showLossPopover]);

  const handleAddDeduction = (defaultTitle: string = '') => {
    setMemoState(prev => ({
      ...prev,
      deductions: [
        ...(prev.deductions || []),
        { id: `ded_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, title: defaultTitle, amount: '' }
      ]
    }), { immediate: true });
  };

  const updateDeduction = (id: string, field: keyof MemoDeduction, value: any) => {
    setMemoState(prev => ({
      ...prev,
      deductions: (prev.deductions || []).map(d => d.id === id ? { ...d, [field]: value } : d)
    }));
  };

  const handleDeleteDeduction = (id: string) => {
    setMemoState(prev => ({
      ...prev,
      deductions: (prev.deductions || []).filter(d => d.id !== id)
    }), { immediate: true });
  };

  const isMounted = useRef(false);
  const isDirtyRef = useRef(false);

  
  const handleSaveReceiverSig = (dataUrl: string) => {
    isDirtyRef.current = true;
    const key = `sales_memo_lot_${lotNumber === null ? 'unassigned' : lotNumber}_memo_${memoId}`;
    setMemoState(prev => {
      const next = { ...prev, receiverSignature: dataUrl };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch(e) {}
      return next;
    });
    setSaveStatus('Signature Saved ✔');
    setTimeout(() => setSaveStatus('Saved'), 1500);
  };

  const handleSaveSellerSig = (dataUrl: string) => {
    isDirtyRef.current = true;
    try {
      if (dataUrl) {
        localStorage.setItem('default_seller_signature', dataUrl);
      } else {
        localStorage.removeItem('default_seller_signature');
      }
      window.dispatchEvent(new Event('global_seller_signature_changed'));
    } catch(e) {}

    const key = `sales_memo_lot_${lotNumber === null ? 'unassigned' : lotNumber}_memo_${memoId}`;
    setMemoState(prev => {
      const next = { ...prev, sellerSignature: dataUrl };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch(e) {}
      return next;
    });
    setSaveStatus('Signature Saved ✔');
    setTimeout(() => setSaveStatus('Saved'), 1500);
  };

  const handleClearReceiverSig = () => {
    handleSaveReceiverSig('');
  };

  const handleClearSellerSig = () => {
    handleSaveSellerSig('');
  };

  const syncMemoToLot = (targetLotInput: string | undefined, currentState: MemoState) => {
    try {
      const rawNum = targetLotInput ? parseInt(targetLotInput, 10) : null;
      const validLot = (rawNum !== null && !isNaN(rawNum) && rawNum > 0) ? rawNum : null;

      const stateToSave: MemoState = {
        ...currentState,
        lotNumberInput: validLot !== null ? validLot.toString() : ''
      };

      // STRICT GUARD: Never save purchase memo IDs or purchase types in sales memo storage!
      if (memoId.startsWith('purchase_') || (currentState.customerType as any) === 'purchase') {
        console.warn('Prevented saving purchase memo in sales memo storage:', memoId);
        return;
      }

      // Update lastModified if modified by user so it immediately jumps to the front of all lists
      const nowTs = Date.now();
      if (isDirtyRef.current) {
        stateToSave.lastModified = nowTs;
        stateToSave.updatedAt = new Date(nowTs).toISOString();
      }

      // 1. Save to canonical storage key and destination storage key
      const canonicalKey = `sales_memo_${memoId}`;
      localStorage.setItem(canonicalKey, JSON.stringify(stateToSave));

      const destKey = `sales_memo_lot_${validLot === null ? 'unassigned' : validLot}_memo_${memoId}`;
      localStorage.setItem(destKey, JSON.stringify(stateToSave));

      // Keep local_timestamps updated with the memo's true timestamp
      try {
        const tsRaw = localStorage.getItem('local_timestamps');
        let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
        const effectiveTs = stateToSave.lastModified || getMemoExactTimestamp(stateToSave);
        tsMap[canonicalKey] = effectiveTs;
        tsMap[destKey] = effectiveTs;
        localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
      } catch(e) {}

      const knownLots = new Set<number>();
      for (let l = 1; l <= 50; l++) knownLots.add(l);
      try {
        const sLots: number[] = JSON.parse(localStorage.getItem('sales_lots_list') || '[]');
        sLots.forEach(l => knownLots.add(l));
      } catch(e) {}
      if (lotNumber !== null) knownLots.add(lotNumber);
      if (validLot !== null) knownLots.add(validLot);

      // 2. Remove memo from all other lot storage keys so it fully moves out
      if (validLot !== null) {
        localStorage.removeItem(`sales_memo_lot_unassigned_memo_${memoId}`);
      }
      knownLots.forEach(l => {
        if (l !== validLot) {
          localStorage.removeItem(`sales_memo_lot_${l}_memo_${memoId}`);
        }
      });

      // 3. Update sales_memo_list_* for all lots
      knownLots.forEach(l => {
        const lKey = `sales_memo_list_${l}`;
        const lStr = localStorage.getItem(lKey);
        if (lStr) {
          try {
            const list: string[] = JSON.parse(lStr);
            if (l === validLot) {
              if (!list.includes(memoId)) {
                list.push(memoId);
                localStorage.setItem(lKey, JSON.stringify(list));
              }
            } else {
              if (list.includes(memoId)) {
                localStorage.setItem(lKey, JSON.stringify(list.filter(id => id !== memoId)));
              }
            }
          } catch(e) {}
        } else if (l === validLot) {
          localStorage.setItem(lKey, JSON.stringify([memoId]));
        }
      });

      // Handle unassigned list
      const uKey = 'sales_memo_list_unassigned';
      const uStr = localStorage.getItem(uKey);
      let uList: string[] = uStr ? JSON.parse(uStr) : [];
      if (validLot === null) {
        if (!uList.includes(memoId)) {
          uList.push(memoId);
          localStorage.setItem(uKey, JSON.stringify(uList));
        }
      } else {
        if (uList.includes(memoId)) {
          localStorage.setItem(uKey, JSON.stringify(uList.filter(id => id !== memoId)));
        }
      }

      // 4. Update due_memo if exists
      const dueKey = `due_memo_${memoId}`;
      const dueStr = localStorage.getItem(dueKey);
      if (dueStr) {
        try {
          const dueData = JSON.parse(dueStr);
          dueData.lotNumber = validLot !== null ? validLot.toString() : '';
          if (dueData.memoState) {
            dueData.memoState.lotNumberInput = validLot !== null ? validLot.toString() : '';
          }
          localStorage.setItem(dueKey, JSON.stringify(dueData));
        } catch(e) {}
      }

      if (onLotChange) {
        onLotChange(validLot);
      }
    } catch(e) {}
  };

  const handleBack = () => {
    syncMemoToLot(memoState.lotNumberInput, memoState);
    const rawNum = memoState.lotNumberInput ? parseInt(memoState.lotNumberInput, 10) : null;
    const validLot = (rawNum !== null && !isNaN(rawNum) && rawNum > 0) ? rawNum : null;

    if (onLotChange) {
      onLotChange(validLot);
    }

    if (onBack) {
      onBack();
    } else if (validLot === null) {
      onNavigate('sales-lots');
    } else {
      onNavigate('sales-memo-list');
    }
  };

  // Auto-save
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    isDirtyRef.current = true;

    if (memoState.createdAt && memoState.createdAt !== today && memoState.updatedAt !== today) {
      const editTime = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      setMemoState(prev => ({ ...prev, updatedAt: today, updatedAtTime: editTime }), { recordHistory: false });
      return;
    }

    setSaveStatus('Saving...');

    const timer = setTimeout(() => {
      // Calculate due amount for auto-sync
      let fishTotal = 0;
      memoState.entries.forEach(entry => {
        let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
        let buyRateNum = Number(entry.buyRate) || 0;
        let calculatedSaleRate = buyRateNum > 0 ? buyRateNum + (buyRateNum * currentProfitPercent / 100) : 0;
        let saleRate = 0;
        if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
          let manualRateNum = Number(entry.manualSaleRate);
          saleRate = manualRateNum + (manualRateNum * currentProfitPercent / 100);
        } else {
          saleRate = calculatedSaleRate;
        }
        let weightInKg = 0;
        let totalKgNum = Number(entry.totalKg) || 0;
        if (totalKgNum > 0) {
          weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
        }
        if (weightInKg > 0 && saleRate > 0) {
          fishTotal += weightInKg * saleRate;
        }
      });

      const totalDeductions = (memoState.deductions || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      let rawCommVal = memoState.commissionValue;
      if (typeof rawCommVal === 'object' && rawCommVal !== null) {
        rawCommVal = (rawCommVal as any).target?.value ?? (rawCommVal as any).value ?? (rawCommVal as any).amount ?? '';
      }
      const commVal = typeof rawCommVal === 'string'
        ? (Number(rawCommVal.replace(/[০-৯]/g, (d: string) => (d.charCodeAt(0) - 0x09e6).toString())) || 0)
        : (Number(rawCommVal) || 0);
      const commType = memoState.commissionType || 'percent';
      const commOp = memoState.commissionOperation || 'subtract';
      let commissionAmount = 0;
      if (commVal > 0) {
        if (commType === 'flat') {
          commissionAmount = commVal;
        } else {
          commissionAmount = Math.round((fishTotal * commVal / 100) * 100) / 100;
        }
      }
      let grandTotal = 0;
      if (commOp === 'subtract') {
        grandTotal = Math.max(0, Math.round((fishTotal - totalDeductions - commissionAmount) * 100) / 100);
      } else {
        grandTotal = Math.max(0, Math.round((fishTotal - totalDeductions + commissionAmount) * 100) / 100);
      }
      const dueAmount = Math.max(0, Math.round((grandTotal - Number(memoState.paidAmount || 0)) * 100) / 100);
      let currentStatus = memoState.status || 'draft';

      if (memoState.customerType) {
        if (dueAmount > 0) {
          currentStatus = 'due';
        } else if (grandTotal > 0 && dueAmount <= 0) {
          currentStatus = 'paid';
        }
      }

      const effectiveState = memoState.status !== currentStatus 
        ? { ...memoState, status: currentStatus } 
        : memoState;

      if (memoState.status !== currentStatus) {
        setMemoState(prev => ({ ...prev, status: currentStatus }), { recordHistory: false });
      }

      // Sync to due accounts (default to 'regular' if not explicitly chosen, so due is NEVER lost!)
      if (memoState.customerType || dueAmount > 0 || (grandTotal > 0 && Number(memoState.paidAmount || 0) > 0)) {
        const type = (memoState.customerType === 'permanent' || memoState.customerType === 'reseller') 
          ? memoState.customerType 
          : (defaultCustomerType === 'permanent' || defaultCustomerType === 'reseller' ? defaultCustomerType : 'regular');
        const allTypes = ['regular', 'permanent', 'reseller'];
        const otherTypes = allTypes.filter(t => t !== type);
        
        let existingDueObj: any = {};
        try {
          const dStr = localStorage.getItem(`due_memo_${memoId}`);
          if (dStr) existingDueObj = JSON.parse(dStr);
        } catch (e) {}

        const effectiveDateStr = (memoState.isOriginalDate === false && memoState.customDate)
          ? memoState.customDate
          : (memoState.createdAt || today);

        const newDueData = {
          ...existingDueObj,
          id: memoId,
          memoState: { ...memoState, date: effectiveDateStr, customDate: memoState.customDate },
          date: effectiveDateStr,
          createdAt: effectiveDateStr,
          name: memoState.customerName,
          customerName: memoState.customerName,
          address: memoState.address,
          mobile: memoState.mobile,
          lotNumber: memoState.lotNumberInput,
          deposit: memoState.paidAmount,
          paidAmount: memoState.paidAmount,
          type: type,
          status: currentStatus,
          autoMessage: existingDueObj.autoMessage,
          deductions: memoState.deductions || [],
          commissionValue: (typeof rawCommVal === 'number' || typeof rawCommVal === 'string') ? rawCommVal : '',
          commissionType: commType,
          commissionOperation: commOp,
          commissionAmount: commissionAmount,
          entries: memoState.entries.map((e, i) => ({
            id: e.id,
            serialNo: (i+1).toString(),
            name: e.name,
            totalKg: e.totalKg,
            weightUnit: e.weightUnit,
            buyRate: e.buyRate || '',
            profitPercent: e.profitPercent,
            manualSaleRate: e.manualSaleRate,
            highlightColor: e.highlightColor
          }))
        };

        if (currentStatus === 'due') {
          localStorage.setItem(`due_memo_${memoId}`, JSON.stringify(newDueData));
          
          const existingDuesStr = localStorage.getItem(`dues_${type}`);
          let existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
          if (!existingDues.includes(memoId)) {
            existingDues.push(memoId);
            localStorage.setItem(`dues_${type}`, JSON.stringify(existingDues));
          }

          // Remove from other type dues lists
          otherTypes.forEach(ot => {
            const otherDuesStr = localStorage.getItem(`dues_${ot}`);
            let otherDues: string[] = otherDuesStr ? JSON.parse(otherDuesStr) : [];
            if (otherDues.includes(memoId)) {
              otherDues = otherDues.filter(id => id !== memoId);
              localStorage.setItem(`dues_${ot}`, JSON.stringify(otherDues));
            }
          });

          // Remove from all paid lists
          allTypes.forEach(t => {
            const paidStr = localStorage.getItem(`paid_dues_${t}`);
            let paidList: string[] = paidStr ? JSON.parse(paidStr) : [];
            if (paidList.includes(memoId)) {
              paidList = paidList.filter(id => id !== memoId);
              localStorage.setItem(`paid_dues_${t}`, JSON.stringify(paidList));
            }
          });
        } else if (currentStatus === 'paid') {
          localStorage.setItem(`due_memo_${memoId}`, JSON.stringify({ ...newDueData, paidDate: existingDueObj.paidDate || Date.now() }));
          
          const existingPaidStr = localStorage.getItem(`paid_dues_${type}`);
          let existingPaid: string[] = existingPaidStr ? JSON.parse(existingPaidStr) : [];
          if (!existingPaid.includes(memoId)) {
            existingPaid.push(memoId);
            localStorage.setItem(`paid_dues_${type}`, JSON.stringify(existingPaid));
          }

          // Remove from other paid lists
          otherTypes.forEach(ot => {
            const otherPaidStr = localStorage.getItem(`paid_dues_${ot}`);
            let otherPaid: string[] = otherPaidStr ? JSON.parse(otherPaidStr) : [];
            if (otherPaid.includes(memoId)) {
              otherPaid = otherPaid.filter(id => id !== memoId);
              localStorage.setItem(`paid_dues_${ot}`, JSON.stringify(otherPaid));
            }
          });

          // Remove from all dues lists
          allTypes.forEach(t => {
            const duesStr = localStorage.getItem(`dues_${t}`);
            let duesList: string[] = duesStr ? JSON.parse(duesStr) : [];
            if (duesList.includes(memoId)) {
              duesList = duesList.filter(id => id !== memoId);
              localStorage.setItem(`dues_${t}`, JSON.stringify(duesList));
            }
          });
        }
      }

      syncMemoToLot(memoState.lotNumberInput, effectiveState || memoState);
      setSaveStatus('Saved');
    }, 350);

    return () => clearTimeout(timer);
  }, [memoState, lotNumber, memoId]);



  const updateMemoState = (field: keyof MemoState, value: any) => {
    let cleanVal = value;
    if (field === 'commissionValue') {
      if (value && typeof value === 'object' && value.target) {
        cleanVal = value.target.value;
      }
    }
    setMemoState(prev => {
      const newState = { ...prev, [field]: cleanVal };
      if (field === 'lotNumberInput') {
        if (!cleanVal) {
          newState.entries = newState.entries.map(e => ({ ...e, buyRate: 0 }));
        }
      }
      return newState;
    });
  };

  const updateEntry = (id: string, field: keyof FishEntry, value: any) => {
    setMemoState(prev => {
      let updatedEntries = prev.entries.map(e => e.id === id ? { ...e, [field]: value } : e);

      // Auto-fill cost & suggested sale price when fish name matches lot purchase memo
      if (field === 'name') {
        const valStr = String(value || '').trim().toLowerCase();
        if (valStr) {
          const matched = lotPurchaseItems.find(it => it.name.trim().toLowerCase() === valStr);
          if (matched) {
            updatedEntries = updatedEntries.map(e => {
              if (e.id !== id) return e;
              return {
                ...e,
                buyRate: matched.effectiveCostRate,
                manualSaleRate: (e.manualSaleRate !== undefined && e.manualSaleRate !== '')
                  ? e.manualSaleRate
                  : (matched.suggestedSaleRate > 0 ? matched.suggestedSaleRate : matched.effectiveCostRate),
                profitPercent: (e.profitPercent !== undefined && e.profitPercent !== '')
                  ? e.profitPercent
                  : (matched.profitPercent > 0 ? matched.profitPercent : '')
              };
            });
          }
        } else {
          updatedEntries = updatedEntries.map(e => e.id === id ? { ...e, buyRate: 0 } : e);
        }
      }

      return {
        ...prev,
        entries: updatedEntries
      };
    });
  };

  const handleAddRow = () => {
    setMemoState(prev => ({
      ...prev,
      entries: [
        ...prev.entries,
        {
          id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          serialNo: (prev.entries.length + 1).toString(),
          name: '',
          totalKg: '',
          weightUnit: 'kg',
          profitPercent: '',
          manualSaleRate: ''
        }
      ]
    }), { immediate: true });
    focusNewTableRow();
  };

  const handleDeleteRow = (id: string) => {
    setMemoState(prev => {
      if (prev.entries.length <= 1) {
        return {
          ...prev,
          entries: [{ id: Date.now().toString(), serialNo: '1', name: '', totalKg: '', weightUnit: 'kg', profitPercent: '', manualSaleRate: '' }]
        };
      }
      const filtered = prev.entries.filter(e => e.id !== id);
      return {
        ...prev,
        entries: filtered.map((e, idx) => ({ ...e, serialNo: (idx + 1).toString() }))
      };
    }, { immediate: true });
  };

  const getCustomerMemoCanvas = async (): Promise<HTMLCanvasElement | null> => {
    if (!memoRef.current) return null;
    return await html2canvas(memoRef.current, {
      scale: 2,
      backgroundColor: '#092115',
      useCORS: true,
      logging: false,
      ignoreElements: (el) => el.hasAttribute('data-html2canvas-ignore')
    });
  };

  const generateCustomerMemoPdf = async (): Promise<{ pdf: jsPDF; pdfBlob: Blob; fileName: string } | null> => {
    const canvas = await getCustomerMemoCanvas();
    if (!canvas) return null;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const customerName = memoState.customerName ? memoState.customerName.trim().replace(/\s+/g, '_') : 'Customer';
    const fileName = `Sales_Memo_${customerName}_Lot_${lotNumber || 'Memo'}.pdf`;
    const pdfBlob = pdf.output('blob');
    return { pdf, pdfBlob, fileName };
  };

  const handleDownload = async () => {
    try {
      const res = await generateCustomerMemoPdf();
      if (!res) return;
      res.pdf.save(res.fileName);
    } catch (err) {
      console.error('Failed to download PDF', err);
    }
  };

  const handleShare = async () => {
    try {
      const res = await generateCustomerMemoPdf();
      if (!res) return;
      const { pdf, pdfBlob, fileName } = res;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const customerName = memoState.customerName ? memoState.customerName.trim() : 'সম্মানিত ক্রেতা';
      const paidVal = Number(memoState.paidAmount) || 0;
      const excessVal = (paidVal > grandTotal && grandTotal > 0) ? Math.round((paidVal - grandTotal) * 100) / 100 : 0;
      const summaryText = `*সামুদ্রিক মাছ নোটবুক - বিক্রয় মেমো*\nক্রেতা: ${customerName}\nতারিখ: ${memoState.customDate || memoState.createdAt || today}\nলট নং: ${lotNumber || 'N/A'}\nমোট বিল: ৳ ${grandTotal.toFixed(2)}\nজমা: ৳ ${paidVal.toFixed(2)}\n${excessVal > 0 ? `বকেয়া: ৳ 0.00\nঅতিরিক্ত জমা (ফেরত): ৳ ${excessVal.toFixed(2)}` : `বকেয়া: ৳ ${dueAmount.toFixed(2)}`}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `বিক্রয় মেমো - ${customerName}`,
          text: summaryText
        });
      } else {
        pdf.save(fileName);
        try {
          await navigator.clipboard.writeText(summaryText);
          alert(language === 'bn' 
            ? 'মেমো PDF ফাইলটি ডাউনলোড হয়েছে এবং বিবরণ ক্লিপবোর্ডে কপি হয়েছে! আপনি যেকোনো মেসেজিং অ্যাপে শেয়ার করতে পারেন।' 
            : 'Memo PDF downloaded and summary copied to clipboard!');
        } catch (e) {
          alert(language === 'bn' ? 'মেমো PDF ফাইলটি ডাউনলোড হয়েছে!' : 'Memo PDF downloaded!');
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share failed', err);
      }
    }
  };

  const handleWhatsApp = async () => {
    try {
      const res = await generateCustomerMemoPdf();
      const customerName = memoState.customerName ? memoState.customerName.trim() : 'সম্মানিত ক্রেতা';

      let itemsText = '';
      memoState.entries.forEach((e, idx) => {
        if ((e.name && e.name.trim() !== '') || Number(e.totalKg) > 0) {
          const kg = Number(e.totalKg) || 0;
          const rate = Number(e.manualSaleRate) || 0;
          const total = (kg * rate) > 0 ? (kg * rate) : 0;
          itemsText += `\n${idx + 1}. ${e.name || 'মাছ'} - ${kg} ${e.weightUnit || 'kg'} × ৳${rate} = ৳${total.toFixed(2)}`;
        }
      });

      const paidVal = Number(memoState.paidAmount) || 0;
      const excessVal = (paidVal > grandTotal && grandTotal > 0) ? Math.round((paidVal - grandTotal) * 100) / 100 : 0;
      const waText = `*সামুদ্রিক মাছ নোটবুক - বিক্রয় মেমো*\nক্রেতা: ${customerName}\nমোবাইল: ${memoState.mobile || 'N/A'}\nতারিখ: ${memoState.customDate || memoState.createdAt || today}\nলট নং: ${lotNumber || 'N/A'}\n----------------------------------\n*পণ্যের বিবরণ:*${itemsText}\n----------------------------------\nমাছের মোট মূল্য: ৳ ${fishTotal.toFixed(2)}${commissionAmount > 0 ? `\nকমিশন: ${(memoState.commissionOperation || 'subtract') === 'add' ? '+' : '-'} ৳ ${commissionAmount.toFixed(2)}` : ''}${totalDeductions > 0 ? `\nকর্তন/ছাড়: - ৳ ${totalDeductions.toFixed(2)}` : ''}\n*চূড়ান্ত মোট বিল: ৳ ${grandTotal.toFixed(2)}*\nজমা: ৳ ${paidVal.toFixed(2)}\n${excessVal > 0 ? `*বকেয়া: ৳ 0.00*\n*গ্রাহককে ফেরত: ৳ ${excessVal.toFixed(2)}*` : `*বকেয়া: ৳ ${dueAmount.toFixed(2)}*`}\n\nধন্যবাদ!`;

      let phone = (memoState.mobile || '').replace(/[^\d]/g, '');
      if (phone.length === 11 && phone.startsWith('01')) {
        phone = '88' + phone;
      }

      if (res) {
        const { pdf, pdfBlob, fileName } = res;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `বিক্রয় মেমো - ${customerName}`,
            text: waText
          });
          return;
        } else {
          pdf.save(fileName);
        }
      }

      const waUrl = phone 
        ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
        : `https://wa.me/?text=${encodeURIComponent(waText)}`;
      window.open(waUrl, '_blank');
    } catch (err) {
      console.error('WhatsApp error', err);
    }
  };

  const handleEmail = async () => {
    try {
      const res = await generateCustomerMemoPdf();
      const customerName = memoState.customerName ? memoState.customerName.trim() : 'Customer';

      let itemsText = '';
      memoState.entries.forEach((e, idx) => {
        if ((e.name && e.name.trim() !== '') || Number(e.totalKg) > 0) {
          const kg = Number(e.totalKg) || 0;
          const rate = Number(e.manualSaleRate) || 0;
          const total = (kg * rate) > 0 ? (kg * rate) : 0;
          itemsText += `\n${idx + 1}. ${e.name || 'Fish'} - ${kg} ${e.weightUnit || 'kg'} x Tk ${rate} = Tk ${total.toFixed(2)}`;
        }
      });

      const paidVal = Number(memoState.paidAmount) || 0;
      const excessVal = (paidVal > grandTotal && grandTotal > 0) ? Math.round((paidVal - grandTotal) * 100) / 100 : 0;
      const emailBody = `Sales Memo - Samudrik Mach Notebook\nCustomer: ${customerName}\nDate: ${memoState.customDate || memoState.createdAt || today}\nLot: ${lotNumber || 'N/A'}\n----------------------------------\nItems:${itemsText}\n----------------------------------\nFish Total: Tk ${fishTotal.toFixed(2)}\nNet Total: Tk ${grandTotal.toFixed(2)}\nPaid: Tk ${paidVal.toFixed(2)}\n${excessVal > 0 ? `Due: Tk 0.00\nChange / Refund: Tk ${excessVal.toFixed(2)}` : `Due: Tk ${dueAmount.toFixed(2)}`}\n\nThank you!`;

      if (res) {
        const { pdf, pdfBlob, fileName } = res;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Sales Memo - ${customerName}`,
            text: emailBody
          });
          return;
        } else {
          pdf.save(fileName);
        }
      }

      window.open(`mailto:?subject=${encodeURIComponent(`Sales Memo - ${customerName}`)}&body=${encodeURIComponent(emailBody)}`);
    } catch (err) {
      console.error('Email error', err);
    }
  };



  let fishTotal = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  const lossItems: { name: string; weightInKg: number; saleRate: number; costRate: number; loss: number }[] = [];

  memoState.entries.forEach(entry => {
    let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
    
    const matchedItem = findLotItemByName(entry.name);
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
      const itemSale = weightInKg * saleRate;
      fishTotal += itemSale;

      // Extra products are completely EXCLUDED from profit and loss
      let costRate = 0;
      if (!isExtra && matchedItem && matchedItem.effectiveCostRate > 0) {
        costRate = matchedItem.effectiveCostRate;
      } else if (!isExtra && Number(entry.buyRate) > 0) {
        costRate = Number(entry.buyRate);
      }

      if (costRate > 0) {
        const itemCost = weightInKg * costRate;
        const diff = itemSale - itemCost;
        if (diff > 0) {
          grossProfit += diff;
        } else if (diff < 0) {
          const lAmt = Math.abs(diff);
          grossLoss += lAmt;
          lossItems.push({
            name: entry.name || (language === 'bn' ? 'বেনামী মাছ' : 'Unnamed Item'),
            weightInKg,
            saleRate,
            costRate,
            loss: lAmt
          });
        }
      }
    }
  });

  const deductionsList = memoState.deductions || [];
  const totalDeductions = deductionsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  let rawCommVal = memoState.commissionValue;
  if (typeof rawCommVal === 'object' && rawCommVal !== null) {
    rawCommVal = (rawCommVal as any).target?.value ?? (rawCommVal as any).value ?? (rawCommVal as any).amount ?? '';
  }
  const commVal = typeof rawCommVal === 'string'
    ? (Number(rawCommVal.replace(/[০-৯]/g, (d: string) => (d.charCodeAt(0) - 0x09e6).toString())) || 0)
    : (Number(rawCommVal) || 0);
  const commType = memoState.commissionType || 'percent';
  const commOp = memoState.commissionOperation || 'subtract';
  let commissionAmount = 0;
  if (commVal > 0) {
    if (commType === 'flat') {
      commissionAmount = commVal;
    } else {
      commissionAmount = Math.round((fishTotal * commVal / 100) * 100) / 100;
    }
  }

  // Net Profit & Loss after Commission
  let totalProfitAmount = 0;
  let totalLossAmount = 0;

  if (commOp === 'subtract') {
    const netProfit = grossProfit - commissionAmount;
    if (netProfit >= 0) {
      totalProfitAmount = Math.round(netProfit * 100) / 100;
      totalLossAmount = Math.round(grossLoss * 100) / 100;
    } else {
      // Commission exceeds profit: difference becomes a real loss!
      totalProfitAmount = 0;
      totalLossAmount = Math.round((grossLoss + Math.abs(netProfit)) * 100) / 100;
    }
  } else {
    // Commission is added: increases profit
    totalProfitAmount = Math.round((grossProfit + commissionAmount) * 100) / 100;
    totalLossAmount = Math.round(grossLoss * 100) / 100;
  }

  // Net Profit (মোট লাভ - মোট লস)
  const netProfitOrLoss = Math.round((totalProfitAmount - totalLossAmount) * 100) / 100;

  let grandTotal = 0;
  if (commOp === 'subtract') {
    grandTotal = Math.max(0, Math.round((fishTotal - totalDeductions - commissionAmount) * 100) / 100);
  } else {
    grandTotal = Math.max(0, Math.round((fishTotal - totalDeductions + commissionAmount) * 100) / 100);
  }
  const paidNum = Number(memoState.paidAmount || 0);
  const dueAmount = Math.max(0, Math.round((grandTotal - paidNum) * 100) / 100);
  const excessAmount = (paidNum > grandTotal && grandTotal > 0) ? Math.round((paidNum - grandTotal) * 100) / 100 : 0;

  const totalKgSum = memoState.entries.reduce((sum, entry) => {
    const kg = Number(entry.totalKg) || 0;
    return sum + (entry.weightUnit === 'g' ? kg / 1000 : kg);
  }, 0);
  const totalItemsCount = memoState.entries.filter(e => (e.name && e.name.trim() !== '') || (Number(e.totalKg) > 0)).length;


  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar" data-html2canvas-ignore>
        <button className="btn-icon" onClick={handleBack}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{t('salesMemo')}</h2>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'Saved' ? '#72be44' : '#fff', transition: 'color 0.3s' }}>
            {saveStatus === 'Saved' ? (language === 'bn' ? '✔ সব পরিবর্তন সেভ হয়েছে' : '✔ All changes saved') : (language === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...')}
          </span>
        </div>
        
        <div className="header-actions">
          <button className="btn-icon action-undo" onClick={undo} disabled={!canUndo} title="Undo" style={{ opacity: canUndo ? 1 : 0.4 }}>
            <Undo size={24} />
          </button>
          <button className="btn-icon action-redo" onClick={redo} disabled={!canRedo} title="Redo" style={{ opacity: canRedo ? 1 : 0.4 }}>
            <Redo size={24} />
          </button>
          
          <div className="share-group">
            <button className="btn-icon action-fb" onClick={handleShare} title={language === 'bn' ? 'শেয়ার করুন (হোয়াটসঅ্যাপ, মেসেঞ্জার, ফেসবুক ইত্যাদি)' : 'Share via apps'}>
              <Share2 size={24} />
            </button>
            <button className="btn-icon action-wa" onClick={handleWhatsApp} title={language === 'bn' ? 'হোয়াটসঅ্যাপে পাঠান' : 'Share on WhatsApp'}>
              <MessageCircle size={24} />
            </button>
            <button className="btn-icon action-mail" onClick={handleEmail} title={language === 'bn' ? 'ইমেইল করুন' : 'Share via Email'}>
              <Mail size={24} />
            </button>
          </div>

          <button className="btn-icon action-download" onClick={handleDownload} title={language === 'bn' ? 'কাস্টমার মেমো PDF ডাউনলোড' : 'Download Customer Memo PDF'}>
            <Download size={24} />
          </button>
        </div>
      </div>

      <div className="memo-wrapper">
        {/* The Paper has fixed width but dark theme styling */}
        <div className="memo-paper-dark" ref={memoRef} >
          
          <div className="memo-dark-header">
            <div className="memo-logo-area-dark">
              <div className="memo-logo-rect-dark">
                <img src="./see fish logo.png" alt="Logo" />
              </div>
              <h1>{t('memoHeaderTitle')}</h1>
            </div>
          </div>

          <div className="memo-sales-header-title-bar" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.8rem 2rem 0.6rem 2rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '0.5rem',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <h2 style={{
              color: '#ffffff',
              fontSize: '1.45rem',
              fontWeight: 800,
              margin: 0,
              textDecoration: 'underline',
              textUnderlineOffset: '6px',
              whiteSpace: 'nowrap'
            }}>
              {t('salesAccount')}
            </h2>

            {/* 4 Header Metric & Action Boxes */}
            <div data-html2canvas-ignore style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              {/* Box 1: মোট বিক্রয় */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(16, 44, 28, 0.9) 0%, rgba(8, 26, 16, 0.95) 100%)',
                border: '1.5px solid rgba(114, 190, 68, 0.5)',
                borderRadius: '8px',
                padding: '4px 10px',
                minWidth: '95px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {language === 'bn' ? 'মোট বিক্রয়' : 'Total Sales'}
                </span>
                <span style={{ fontSize: '0.96rem', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ৳ {fishTotal.toFixed(2)}
                </span>
              </div>

              {/* Box 2: মোট লাভ */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(20, 83, 45, 0.5) 0%, rgba(6, 46, 24, 0.85) 100%)',
                border: '1.5px solid rgba(74, 222, 128, 0.6)',
                borderRadius: '8px',
                padding: '4px 10px',
                minWidth: '90px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}>
                <span style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {language === 'bn' ? 'মোট লাভ' : 'Total Profit'}
                </span>
                <span style={{ fontSize: '0.96rem', color: '#4ade80', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  + ৳ {totalProfitAmount.toFixed(2)}
                </span>
              </div>

              {/* Box 3: মোট লস (Clickable to see why loss occurred) */}
              <div 
                className="metric-box-loss"
                onClick={() => totalLossAmount > 0 && setShowLossPopover(prev => !prev)}
                style={{
                  position: 'relative',
                  background: 'linear-gradient(145deg, rgba(127, 29, 29, 0.35) 0%, rgba(69, 10, 10, 0.8) 100%)',
                  border: totalLossAmount > 0 ? '1.5px solid rgba(248, 113, 113, 0.7)' : '1.5px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  minWidth: '90px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  cursor: totalLossAmount > 0 ? 'pointer' : 'default'
                }}
                title={totalLossAmount > 0 ? (language === 'bn' ? 'লসের বিস্তারিত দেখতে ক্লিক করুন' : 'Click to see loss breakdown') : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: totalLossAmount > 0 ? '#fca5a5' : '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {language === 'bn' ? 'মোট লস' : 'Total Loss'}
                  </span>
                  {totalLossAmount > 0 && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.4)', borderRadius: '50%', width: '13px', height: '13px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>ℹ</span>
                  )}
                </div>
                <span style={{ fontSize: '0.96rem', color: totalLossAmount > 0 ? '#f87171' : '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {totalLossAmount > 0 ? `- ৳ ${totalLossAmount.toFixed(2)}` : '৳ 0.00'}
                </span>

                {/* Loss Details Popover */}
                {showLossPopover && totalLossAmount > 0 && (
                  <div 
                    className="loss-details-popover"
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#181216',
                      border: '1.5px solid rgba(239, 68, 68, 0.6)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      minWidth: '240px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
                      zIndex: 1000,
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', paddingBottom: '5px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#fca5a5' }}>
                        {language === 'bn' ? '📋 লস হওয়ার কারণ ও বিবরণ:' : 'Loss Breakdown:'}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowLossPopover(false)}
                        style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      {lossItems.map((item, idx) => (
                        <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '5px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                          <div style={{ fontWeight: 'bold', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{item.name}</span>
                            <span style={{ color: '#f87171' }}>- ৳ {item.loss.toFixed(2)}</span>
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '0.7rem', marginTop: '2px' }}>
                            বিক্রয় দর: ৳{item.saleRate.toFixed(2)} &lt; ক্রয় দর: ৳{item.costRate.toFixed(2)}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                            বিক্রি: {item.weightInKg >= 1 ? `${item.weightInKg.toFixed(2)} kg` : `${(item.weightInKg * 1000).toFixed(0)} g`}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.3, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '5px' }}>
                      {language === 'bn' 
                        ? '*লটের ক্রয় ও খরচ হওয়া দরের চেয়ে বিক্রয় দর কম রাখলে এ ক্ষতি হয়।' 
                        : '*Occurs when sale rate is lower than purchase+cost rate.'}
                    </div>
                  </div>
                )}
              </div>

              {/* Box 4: নিট লাভ (মোট লাভ - মোট লস) */}
              <div style={{
                background: netProfitOrLoss >= 0 
                  ? 'linear-gradient(145deg, rgba(20, 83, 45, 0.6) 0%, rgba(6, 46, 24, 0.9) 100%)'
                  : 'linear-gradient(145deg, rgba(127, 29, 29, 0.45) 0%, rgba(69, 10, 10, 0.9) 100%)',
                border: netProfitOrLoss >= 0 
                  ? '1.5px solid rgba(74, 222, 128, 0.7)' 
                  : '1.5px solid rgba(248, 113, 113, 0.8)',
                borderRadius: '8px',
                padding: '4px 10px',
                minWidth: '95px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}>
                <span style={{ 
                  fontSize: '0.72rem', 
                  color: netProfitOrLoss >= 0 ? '#86efac' : '#fca5a5', 
                  fontWeight: 600, 
                  whiteSpace: 'nowrap' 
                }}>
                  {language === 'bn' 
                    ? (netProfitOrLoss >= 0 ? 'নিট লাভ' : 'নিট লস') 
                    : (netProfitOrLoss >= 0 ? 'Net Profit' : 'Net Loss')}
                </span>
                <span style={{ 
                  fontSize: '0.96rem', 
                  color: netProfitOrLoss >= 0 ? '#4ade80' : '#f87171', 
                  fontWeight: 700, 
                  whiteSpace: 'nowrap' 
                }}>
                  {netProfitOrLoss >= 0 
                    ? `+ ৳ ${netProfitOrLoss.toFixed(2)}` 
                    : `- ৳ ${Math.abs(netProfitOrLoss).toFixed(2)}`}
                </span>
              </div>

              {/* Box 5: কমিশন (+/- , %/৳ toggle & input) */}
              <div style={{
                background: 'linear-gradient(145deg, rgba(16, 44, 28, 0.95) 0%, rgba(8, 26, 16, 0.95) 100%)',
                border: '1.5px solid rgba(234, 179, 8, 0.7)',
                borderRadius: '8px',
                padding: '3px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
                minWidth: '155px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {language === 'bn' ? 'কমিশন' : 'Commission'}
                  </span>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {/* Add / Subtract toggle */}
                    <div style={{
                      display: 'inline-flex',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      border: '1px solid rgba(234, 179, 8, 0.5)',
                      background: 'rgba(0, 0, 0, 0.4)'
                    }}>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionOperation', 'subtract')}
                        style={{
                          padding: '1px 5px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          background: (memoState.commissionOperation || 'subtract') === 'subtract' ? '#ef4444' : 'transparent',
                          color: (memoState.commissionOperation || 'subtract') === 'subtract' ? '#ffffff' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title={language === 'bn' ? 'কমিশন মাইনাস' : 'Subtract Commission'}
                      >
                        [-]
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionOperation', 'add')}
                        style={{
                          padding: '1px 5px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          background: memoState.commissionOperation === 'add' ? '#22c55e' : 'transparent',
                          color: memoState.commissionOperation === 'add' ? '#ffffff' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title={language === 'bn' ? 'কমিশন যোগ' : 'Add Commission'}
                      >
                        [+]
                      </button>
                    </div>

                    {/* % / ৳ toggle */}
                    <div style={{
                      display: 'inline-flex',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      border: '1px solid rgba(234, 179, 8, 0.5)',
                      background: 'rgba(0, 0, 0, 0.4)'
                    }}>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionType', 'percent')}
                        style={{
                          padding: '1px 5px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          background: (memoState.commissionType || 'percent') === 'percent' ? '#eab308' : 'transparent',
                          color: (memoState.commissionType || 'percent') === 'percent' ? '#000000' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title="Percentage (%)"
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionType', 'flat')}
                        style={{
                          padding: '1px 5px',
                          fontSize: '0.72rem',
                          fontWeight: 'bold',
                          background: memoState.commissionType === 'flat' ? '#eab308' : 'transparent',
                          color: memoState.commissionType === 'flat' ? '#000000' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title="Flat Amount (৳)"
                      >
                        ৳
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <MathInput
                    style={{
                      width: '65px',
                      height: '24px',
                      padding: '1px 5px',
                      fontSize: '0.86rem',
                      fontWeight: 'bold',
                      background: 'rgba(0, 0, 0, 0.5)',
                      border: '1px solid rgba(234, 179, 8, 0.45)',
                      borderRadius: '4px',
                      color: '#ffffff',
                      textAlign: 'right'
                    }}
                    placeholder="0"
                    value={(typeof memoState.commissionValue === 'number' || typeof memoState.commissionValue === 'string') ? memoState.commissionValue : ''}
                    onChange={(e: any) => {
                      const v = e && typeof e === 'object' && e.target ? e.target.value : e;
                      updateMemoState('commissionValue', v);
                    }}
                  />
                  {commissionAmount > 0 && (
                    <span style={{
                      fontSize: '0.76rem',
                      color: (memoState.commissionOperation || 'subtract') === 'add' ? '#86efac' : '#fca5a5',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      {(memoState.commissionOperation || 'subtract') === 'add' ? '+' : '-'}৳{commissionAmount.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="memo-top-meta" style={{ alignItems: 'flex-start' }}>
            <div className="meta-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('nameLabel')} </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  value={memoState.customerName} 
                  onChange={e => updateMemoState('customerName', e.target.value)}
                  placeholder="Enter Name"
                />
              </div>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('addressLabel')} </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  value={memoState.address} 
                  onChange={e => updateMemoState('address', e.target.value)}
                  placeholder="Enter Address"
                />
              </div>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('mobileLabel')} </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                  <input 
                    type="text" 
                    className="supplier-input"
                    value={memoState.mobile} 
                    onChange={e => updateMemoState('mobile', e.target.value)}
                    placeholder="Enter Mobile"
                    style={{ flex: 1 }}
                  />
                  <div style={{ position: 'relative' }}>
                    <Phone 
                      size={16} 
                      style={{ cursor: 'pointer', color: memoState.mobile ? 'var(--primary-color)' : '#aaa' }} 
                      onClick={() => {
                        if (memoState.mobile) setShowCustomerCallMenu(!showCustomerCallMenu);
                        else alert('Please enter a mobile number first.');
                      }} 
                    />
                    {showCustomerCallMenu && memoState.mobile && (
                      <CallMenu 
                        phones={[memoState.mobile]} 
                        onClose={() => setShowCustomerCallMenu(false)} 
                        position="left"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="meta-item right-align" style={{ alignSelf: 'flex-start', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className="memo-label-dark" style={{ fontSize: '0.9rem' }}>
                    {language === 'bn' ? 'তারিখ:' : 'Date:'}
                  </span>

                  {/* Standard Styled Date Input Box with Integrated Calendar Picker */}
                  <div style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(114, 190, 68, 0.45)',
                    borderRadius: '8px',
                    padding: '3px 6px 3px 10px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                    gap: '4px'
                  }}>
                    <input
                      type="text"
                      value={memoState.customDate || memoState.createdAt || today}
                      onChange={e => {
                        updateMemoState('customDate', e.target.value);
                        updateMemoState('isOriginalDate', false);
                      }}
                      placeholder="DD-MM-YYYY"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '0.95rem',
                        width: '105px',
                        textAlign: 'center',
                        fontFamily: 'inherit',
                        letterSpacing: '0.5px'
                      }}
                      title={language === 'bn' ? 'তারিখ লিখুন বা ক্যালেন্ডার আইকনে ক্লিক করুন' : 'Enter date or click calendar icon'}
                    />

                    {/* Hidden Native Date Input for Calendar Picker */}
                    <input
                      type="date"
                      ref={datePickerInputRef}
                      value={getIsoDateForPicker(memoState.customDate || memoState.createdAt || today)}
                      onChange={e => {
                        if (e.target.value) {
                          const formatted = formatPickerDateToDisplay(e.target.value);
                          updateMemoState('customDate', formatted);
                          updateMemoState('isOriginalDate', false);
                        }
                      }}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        pointerEvents: 'none',
                        width: 0,
                        height: 0,
                        bottom: 0,
                        right: 0
                      }}
                      data-html2canvas-ignore
                    />

                    {/* Calendar Button */}
                    <button
                      type="button"
                      data-html2canvas-ignore
                      onClick={() => {
                        try {
                          datePickerInputRef.current?.showPicker();
                        } catch (err) {
                          datePickerInputRef.current?.focus();
                        }
                      }}
                      title={language === 'bn' ? 'ক্যালেন্ডার খুলুন' : 'Open calendar'}
                      style={{
                        background: 'rgba(114, 190, 68, 0.2)',
                        border: '1px solid rgba(114, 190, 68, 0.4)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#72be44',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Calendar size={15} />
                    </button>
                  </div>

                  {/* Reset to Today / Original Date Button */}
                  {(memoState.isOriginalDate === false || (memoState.customDate && memoState.customDate !== today)) ? (
                    <button
                      type="button"
                      data-html2canvas-ignore
                      onClick={() => {
                        updateMemoState('isOriginalDate', true);
                        updateMemoState('customDate', memoState.createdAt || today);
                      }}
                      title={language === 'bn' ? 'আজকের / মূল তারিখে ফিরুন' : 'Reset to original date'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255, 152, 0, 0.15)',
                        border: '1px solid rgba(255, 152, 0, 0.4)',
                        color: '#ffb74d',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      <RotateCcw size={11} />
                      <span>{language === 'bn' ? 'আজকে ফিরুন' : 'Today'}</span>
                    </button>
                  ) : (
                    <span
                      data-html2canvas-ignore
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: 'rgba(114, 190, 68, 0.12)',
                        border: '1px solid rgba(114, 190, 68, 0.3)',
                        color: '#72be44',
                        borderRadius: '6px',
                        padding: '3px 7px',
                        fontSize: '0.72rem',
                        fontWeight: 600
                      }}
                    >
                      <span>{language === 'bn' ? 'আজকের তারিখ' : 'Today'}</span>
                    </span>
                  )}
                </div>

                {/* Accounting Month & Modification Time */}
                <div data-html2canvas-ignore style={{
                  fontSize: '0.74rem',
                  color: '#72be44',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  background: 'rgba(114, 190, 68, 0.08)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(114, 190, 68, 0.2)'
                }}>
                  {(() => {
                    const { month: pM, year: pY } = parseMemoMonthYear(memoState);
                    const mObj = MONTHS.find(m => m.index === pM);
                    return (
                      <span>🗓️ হিসাবের মাস: {mObj?.nameBn || ''} {enToBnDigits(pY)}</span>
                    );
                  })()}
                  {memoState.updatedAt && (
                    <span style={{ color: '#ffb74d', marginLeft: '2px', borderLeft: '1px solid rgba(255, 255, 255, 0.15)', paddingLeft: '6px' }}>
                      (পরিবর্তিত: {memoState.updatedAt})
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.9rem' }}>{t('lotNoLabel')}</span>
                <input 
                  type="text" 
                  className="supplier-input" 
                  style={{ width: '80px', padding: '0.3rem', fontSize: '0.9rem' }}
                  value={memoState.lotNumberInput}
                  onChange={e => updateMemoState('lotNumberInput', e.target.value)}
                  placeholder="Lot No"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.9rem' }}>{t('typeLabel')}</span>
                <select 
                  style={{ 
                    width: '130px', 
                    padding: '0.35rem 0.5rem', 
                    fontSize: '0.85rem', 
                    cursor: 'pointer', 
                    color: '#ffffff',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    outline: 'none'
                  }}
                  value={memoState.customerType || ''}
                  onChange={e => updateMemoState('customerType', e.target.value)}
                >
                  <option value="regular" style={{ color: '#000', background: '#fff' }}>{t('regularSeller')}</option>
                  <option value="permanent" style={{ color: '#000', background: '#fff' }}>{t('aratdarSeller')}</option>
                  <option value="reseller" style={{ color: '#000', background: '#fff' }}>{t('reseller') || 'রিসেলার'}</option>
                </select>
              </div>

              {(memoState.customerType === 'permanent' || memoState.customerType === 'reseller') && (() => {
                let foldersList: any[] = [];
                try {
                  const key = memoState.customerType === 'permanent' ? 'aratdar_folders' : 'reseller_folders';
                  const raw = localStorage.getItem(key);
                  if (raw) foldersList = JSON.parse(raw);
                } catch (e) {}

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="memo-label-dark" style={{ fontSize: '0.9rem' }}>{language === 'bn' ? 'ফোল্ডার:' : 'Folder:'}</span>
                    <select
                      style={{
                        maxWidth: '160px',
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        color: '#ffffff',
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: '6px',
                        outline: 'none'
                      }}
                      value={memoState.folderId || ''}
                      onChange={e => {
                        const selId = e.target.value;
                        const matched = foldersList.find((f: any) => f.id === selId);
                        setMemoState(prev => ({
                          ...prev,
                          folderId: selId,
                          folderName: matched ? matched.name : ''
                        }));
                      }}
                    >
                      <option value="" style={{ color: '#000', background: '#fff' }}>{language === 'bn' ? '-- ফোল্ডারহীন --' : '-- No Folder --'}</option>
                      {foldersList.map((f: any) => (
                        <option key={f.id} value={f.id} style={{ color: '#000', background: '#fff' }}>
                          📁 {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="table-responsive">
            <table className="memo-dark-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>{t('slNo')}</th>
                  <th>{t('fishName')}</th>
                  <th>{t('weightKg')}</th>
                  <th>{t('saleRate')}</th>
                  <th data-html2canvas-ignore>{t('profitPercent')}</th>
                  <th>{t('totalPrice')}</th>
                  <th data-html2canvas-ignore style={{ width: '80px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {memoState.entries.map((entry, index) => {
                  let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
                  let buyRateNum = Number(entry.buyRate) || 0;
                  
                  let calculatedSaleRate = 0;
                  if (buyRateNum > 0) {
                    calculatedSaleRate = buyRateNum + (buyRateNum * currentProfitPercent / 100);
                  }
                  
                  let saleRate = 0;
                  if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
                    let manualRateNum = Number(entry.manualSaleRate);
                    saleRate = manualRateNum + (manualRateNum * currentProfitPercent / 100);
                  } else {
                    saleRate = calculatedSaleRate;
                  }
                  
                  let weightInKg = 0;
                  let totalKgNum = Number(entry.totalKg) || 0;
                  if (totalKgNum > 0) {
                    weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
                  }

                  let totalPrice = 0;
                  if (weightInKg > 0 && saleRate > 0) {
                    totalPrice = weightInKg * saleRate;
                  }

                  const isLastRow = index === memoState.entries.length - 1;
                  const activePalette = HIGHLIGHT_PALETTE.find(c => c.id === entry.highlightColor);

                  return (
                    <tr 
                      key={entry.id}
                      data-entry-id={entry.id}
                      style={{
                        backgroundColor: activePalette ? activePalette.bg : undefined,
                        boxShadow: activePalette ? `inset 4px 0 0 ${activePalette.border}` : undefined,
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <td data-label="Sl No." style={{ width: '50px', textAlign: 'center', fontWeight: 'bold', color: '#94a3b8' }}>
                        {index + 1}
                      </td>
                      <td data-label={t('fishName')} style={{ position: 'relative' }}>
                        {(() => {
                          const matchedLotItem = findLotItemByName(entry.name);
                          const isExtra = !matchedLotItem && (entry.name || '').trim() !== '';
                          const inputVal = (entry.name || '').trim().toLowerCase();
                          const filteredSuggestions = inputVal
                            ? lotPurchaseItems.filter(it => it.name.toLowerCase().includes(inputVal))
                            : lotPurchaseItems;

                          return (
                            <div className="fish-name-input-container" style={{ position: 'relative' }}>
                              <div style={{
                                borderRadius: '6px',
                                border: isExtra ? '1.5px solid #ef4444' : undefined,
                                backgroundColor: isExtra ? 'rgba(239, 68, 68, 0.12)' : undefined,
                                padding: isExtra ? '1px' : undefined
                              }}>
                                <DebouncedInput 
                                  debounceMs={0}
                                  placeholder={t('writeHere')}
                                  value={entry.name}
                                  onFocus={() => setActiveSuggestRowId(entry.id)}
                                  onClick={() => setActiveSuggestRowId(entry.id)}
                                  onChange={e => {
                                    updateEntry(entry.id, 'name', e.target.value);
                                    setActiveSuggestRowId(entry.id);
                                  }}
                                  onAddRow={handleAddRow}
                                  isLastRow={isLastRow}
                                />
                              </div>

                              {/* Autocomplete Dropdown */}
                              {activeSuggestRowId === entry.id && filteredSuggestions.length > 0 && (
                                <div
                                  className="fish-autocomplete-dropdown"
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    minWidth: '270px',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    backgroundColor: '#0d2818',
                                    border: '1.5px solid #22c55e',
                                    borderRadius: '8px',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
                                    zIndex: 250,
                                    marginTop: '4px',
                                    padding: '4px 0'
                                  }}
                                >
                                  <div style={{
                                    padding: '4px 8px',
                                    fontSize: '0.72rem',
                                    color: '#86efac',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                    fontWeight: 600
                                  }}>
                                    {language === 'bn' ? 'ক্রয় মেমো থেকে নির্বাচন করুন:' : 'Select fish from purchase memo:'}
                                  </div>
                                  {filteredSuggestions.map((item, sIdx) => (
                                    <div
                                      key={`${item.name}_${sIdx}`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelectFishSuggestion(entry.id, item);
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelectFishSuggestion(entry.id, item);
                                      }}
                                      onTouchEnd={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleSelectFishSuggestion(entry.id, item);
                                      }}
                                      style={{
                                        padding: '6px 10px',
                                        cursor: 'pointer',
                                        borderBottom: sIdx !== filteredSuggestions.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'background-color 0.15s'
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.25)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.86rem' }}>{item.name}</span>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                          ক্রয়+খরচ: ৳{item.effectiveCostRate}/kg
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                        <span style={{
                                          fontSize: '0.72rem',
                                          color: item.remainingKg > 0 ? '#4ade80' : '#f87171',
                                          fontWeight: 600
                                        }}>
                                          স্টক: {item.remainingKg} kg
                                        </span>
                                        <span style={{
                                          fontSize: '0.75rem',
                                          color: '#facc15',
                                          fontWeight: 700
                                        }}>
                                          বিক্রয়: ৳{item.suggestedSaleRate || item.effectiveCostRate}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Extra product badge */}
                              {isExtra && (
                                <div data-html2canvas-ignore style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '0.73rem',
                                  color: '#f87171',
                                  background: 'rgba(239, 68, 68, 0.16)',
                                  border: '1px solid rgba(239, 68, 68, 0.45)',
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  marginTop: '4px',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
                                }}>
                                  <AlertCircle size={12} />
                                  <span>{language === 'bn' ? 'অতিরিক্ত পণ্য' : 'Extra Product'}</span>
                                </div>
                              )}

                              {/* Stock and Purchase Cost badges for matched items */}
                              {!isExtra && (() => {
                                const sItem = currentLotStock?.items.find(
                                  it => it.name.trim().toLowerCase() === (entry.name || '').trim().toLowerCase()
                                );
                                const remKg = sItem ? sItem.remainingKg : matchedLotItem?.remainingKg;
                                if (remKg !== undefined) {
                                  const isAvailable = remKg > 0;
                                  const isLow = isAvailable && remKg < 5;
                                  const badgeColor = !isAvailable ? '#ff5252' : isLow ? '#ffb300' : '#72be44';
                                  const badgeBg = !isAvailable ? 'rgba(255, 82, 82, 0.12)' : isLow ? 'rgba(255, 179, 0, 0.12)' : 'rgba(114, 190, 68, 0.12)';
                                  const badgeBorder = !isAvailable ? 'rgba(255, 82, 82, 0.3)' : isLow ? 'rgba(255, 179, 0, 0.3)' : 'rgba(114, 190, 68, 0.3)';

                                  return (
                                    <div data-html2canvas-ignore style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.73rem',
                                        color: badgeColor,
                                        background: badgeBg,
                                        border: `1px solid ${badgeBorder}`,
                                        padding: '2px 8px',
                                        borderRadius: '20px',
                                        fontWeight: 600,
                                        letterSpacing: '0.01em',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        <span style={{
                                          width: '6px',
                                          height: '6px',
                                          borderRadius: '50%',
                                          backgroundColor: badgeColor,
                                          boxShadow: `0 0 6px ${badgeColor}`,
                                          display: 'inline-block'
                                        }} />
                                        <span>স্টক: {remKg} kg {remKg <= 0 ? '(শেষ)' : ''}</span>
                                      </div>
                                      {matchedLotItem && matchedLotItem.effectiveCostRate > 0 && (
                                        <div style={{
                                          fontSize: '0.7rem',
                                          color: '#93c5fd',
                                          background: 'rgba(59, 130, 246, 0.15)',
                                          border: '1px solid rgba(59, 130, 246, 0.3)',
                                          padding: '2px 6px',
                                          borderRadius: '20px',
                                          fontWeight: 500,
                                          whiteSpace: 'nowrap'
                                        }}>
                                          ক্রয়+খরচ: ৳{matchedLotItem.effectiveCostRate}
                                        </div>
                                      )}
                                      {(() => {
                                        const effectiveCost = matchedLotItem && matchedLotItem.effectiveCostRate > 0
                                          ? matchedLotItem.effectiveCostRate
                                          : (Number(entry.buyRate) > 0 ? Number(entry.buyRate) : 0);

                                        if (!effectiveCost || saleRate <= 0) return null;

                                        if (saleRate < effectiveCost) {
                                          const perKgLoss = effectiveCost - saleRate;
                                          const totalRowLoss = weightInKg > 0 ? Math.round(weightInKg * perKgLoss * 100) / 100 : perKgLoss;
                                          return (
                                            <div
                                              style={{
                                                fontSize: '0.72rem',
                                                color: '#fca5a5',
                                                background: 'rgba(239, 68, 68, 0.22)',
                                                border: '1px solid rgba(239, 68, 68, 0.55)',
                                                padding: '2px 7px',
                                                borderRadius: '20px',
                                                fontWeight: 700,
                                                whiteSpace: 'nowrap',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                boxShadow: '0 1px 4px rgba(239, 68, 68, 0.2)'
                                              }}
                                              title={language === 'bn'
                                                ? `ক্রয়+খরচ দর ৳${effectiveCost.toFixed(2)} এর চেয়ে বিক্রয় দর ৳${saleRate.toFixed(2)} কম হওয়ায় প্রতি কেজিতে ৳${perKgLoss.toFixed(2)} লস হয়েছে`
                                                : `Sale rate ৳${saleRate.toFixed(2)} is less than cost ৳${effectiveCost.toFixed(2)} (loss: ৳${perKgLoss.toFixed(2)}/kg)`}
                                            >
                                              <span>🔻 {language === 'bn' ? 'লস:' : 'Loss:'} - ৳ {totalRowLoss.toFixed(2)}</span>
                                              <span style={{ fontSize: '0.66rem', opacity: 0.85 }}>
                                                ({language === 'bn' ? 'বিক্রয়' : 'Sale'} ৳{saleRate.toFixed(2)} &lt; {language === 'bn' ? 'ক্রয়' : 'Cost'} ৳{effectiveCost.toFixed(2)})
                                              </span>
                                            </div>
                                          );
                                        } else if (saleRate > effectiveCost && weightInKg > 0) {
                                          const perKgProfit = saleRate - effectiveCost;
                                          const totalRowProfit = Math.round(weightInKg * perKgProfit * 100) / 100;
                                          return (
                                            <div
                                              style={{
                                                fontSize: '0.7rem',
                                                color: '#86efac',
                                                background: 'rgba(34, 197, 94, 0.16)',
                                                border: '1px solid rgba(34, 197, 94, 0.35)',
                                                padding: '2px 6px',
                                                borderRadius: '20px',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px'
                                              }}
                                              title={language === 'bn'
                                                ? `ক্রয়+খরচ দর ৳${effectiveCost.toFixed(2)} এর চেয়ে বিক্রয় দর ৳${saleRate.toFixed(2)} বেশি হওয়ায় লাভ`
                                                : `Profit: ৳${totalRowProfit.toFixed(2)}`}
                                            >
                                              <span>{language === 'bn' ? 'লাভ:' : 'Profit:'} + ৳ {totalRowProfit.toFixed(2)}</span>
                                            </div>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          );
                        })()}
                      </td>
                      <td data-label={t('weightKg')}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <MathInput 
                            placeholder="0.00" 
                            value={entry.totalKg}
                            onChange={e => updateEntry(entry.id, 'totalKg', parseMathOrNumber(e.target.value))}
                            onAddRow={handleAddRow}
                            isLastRow={isLastRow}
                            style={{ flex: 1, minWidth: '60px' }}
                          />
                          <select
                            value={entry.weightUnit || 'kg'}
                            onChange={e => updateEntry(entry.id, 'weightUnit', e.target.value as 'kg' | 'g')}
                            style={{ padding: '0.2rem', marginLeft: '2px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
                          >
                            <option value="kg" style={{ color: '#000' }}>kg</option>
                            <option value="g" style={{ color: '#000' }}>g</option>
                          </select>
                        </div>
                      </td>
                      <td data-label="Sale Rate">
                        <MathInput 
                          placeholder="0.00"
                          value={entry.manualSaleRate !== undefined ? entry.manualSaleRate : (calculatedSaleRate > 0 ? calculatedSaleRate.toFixed(2) : '')}
                          onChange={e => updateEntry(entry.id, 'manualSaleRate', parseMathOrNumber(e.target.value))}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                          style={{ fontWeight: '500' }}
                        />
                      </td>
                      <td data-label={t('profitPercent')} data-html2canvas-ignore>
                        <MathInput 
                          className="highlight-input"
                          placeholder="0" 
                          value={entry.profitPercent !== undefined ? entry.profitPercent : ''}
                          onChange={e => updateEntry(entry.id, 'profitPercent', parseMathOrNumber(e.target.value))}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td data-label="Total Price" style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {totalPrice > 0 ? totalPrice.toFixed(2) : '0.00'}
                      </td>
                      <td data-label="" data-html2canvas-ignore style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                          <button 
                            type="button"
                            className="btn-icon btn-color-picker-trigger" 
                            onClick={() => setActiveColorPickerId(prev => prev === entry.id ? null : entry.id)}
                            title={language === 'bn' ? 'লাইন কালার / হাইলাইট করুন' : 'Highlight line'}
                            style={{
                              padding: '5px',
                              background: entry.highlightColor ? 'rgba(255,255,255,0.15)' : 'transparent',
                              borderRadius: '6px',
                              border: entry.highlightColor ? `1px solid ${activePalette?.border || '#72be44'}` : '1px solid transparent',
                              color: entry.highlightColor ? (activePalette?.dot || '#72be44') : '#888',
                              cursor: 'pointer'
                            }}
                          >
                            <Palette size={18} />
                          </button>

                          {/* Color Popover */}
                          {activeColorPickerId === entry.id && (
                            <div 
                              className="highlight-color-picker-popover"
                              style={{
                                position: 'absolute',
                                right: '100%',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                marginRight: '8px',
                                background: '#123020',
                                border: '1px solid rgba(114, 190, 68, 0.4)',
                                borderRadius: '10px',
                                padding: '6px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                                zIndex: 100
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  updateEntry(entry.id, 'highlightColor', undefined);
                                  setActiveColorPickerId(null);
                                }}
                                title={language === 'bn' ? 'রং মুছুন (স্বাভাবিক)' : 'Clear color'}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  border: '1px solid #777',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#aaa',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  padding: 0
                                }}
                              >
                                ✕
                              </button>
                              {HIGHLIGHT_PALETTE.map(c => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => {
                                    updateEntry(entry.id, 'highlightColor', c.id);
                                    setActiveColorPickerId(null);
                                  }}
                                  title={c.name}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: c.dot,
                                    border: entry.highlightColor === c.id ? '2px solid #fff' : '1px solid rgba(0,0,0,0.4)',
                                    boxShadow: entry.highlightColor === c.id ? '0 0 6px #fff' : 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                />
                              ))}
                            </div>
                          )}

                          <button className="btn-icon delete-btn" onClick={() => handleDeleteRow(entry.id)} title="Delete row">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Grid: Left (Actions, Deductions, Insights/Notes) | Right (Totals Box) */}
          <div className="memo-footer-grid">
            
            {/* Left Column: Actions + Deductions + Insights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', minWidth: 0 }}>
              
              {/* Action Toolbar Card */}
              <div data-html2canvas-ignore style={{
                background: 'linear-gradient(135deg, rgba(18, 48, 32, 0.6) 0%, rgba(10, 28, 18, 0.8) 100%)',
                border: '1px solid rgba(114, 190, 68, 0.22)',
                borderRadius: '12px',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.18)'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }} data-html2canvas-ignore>
                  <button
                    type="button"
                    className="add-row-dark-btn"
                    onClick={handleAddRow}
                    style={{
                      margin: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, rgba(114, 190, 68, 0.22), rgba(76, 175, 80, 0.12))',
                      border: '1px solid rgba(114, 190, 68, 0.45)',
                      color: '#a3e635',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Plus size={16} /> {t('addNewRow')}
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => handleAddDeduction()} 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(185, 28, 28, 0.1))',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                    title={language === 'bn' ? 'কোনো খরচ বা বরফ কেনা ইত্যাদি মাইনাস করুন' : 'Add deduction or expense'}
                  >
                    <MinusCircle size={15} style={{ color: '#ef4444' }} />
                    <span>{language === 'bn' ? '+ মাইনাস / খরচ যোগ করুন' : '+ Add Deduction / Minus'}</span>
                  </button>
                </div>

                {/* Quick suggestion chips */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  background: 'rgba(0, 0, 0, 0.22)',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }} data-html2canvas-ignore>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={13} style={{ color: '#ffb74d' }} />
                    <span style={{ fontSize: '0.74rem', color: '#aaa', fontWeight: 600 }}>
                      {language === 'bn' ? 'দ্রুত যোগ করুন:' : 'Quick add:'}
                    </span>
                  </div>
                  {[
                    { title: 'বরফ কেনা', icon: '🧊' },
                    { title: 'গাড়ী ভাড়া', icon: '🚚' },
                    { title: 'কমিশন', icon: '💼' },
                    { title: 'লেবার খরচ', icon: '👷' }
                  ].map(item => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handleAddDeduction(item.title)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '12px',
                        padding: '2px 9px',
                        fontSize: '0.74rem',
                        color: '#ddd',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>{item.icon}</span>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Deductions Edit Card */}
              {deductionsList.length > 0 && (
                <div data-html2canvas-ignore style={{
                  background: 'linear-gradient(135deg, rgba(38, 18, 24, 0.65) 0%, rgba(20, 10, 14, 0.8) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.32)',
                  borderRadius: '12px',
                  padding: '0.9rem 1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  boxShadow: '0 4px 18px rgba(239, 68, 68, 0.08)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MinusCircle size={15} style={{ color: '#ef4444' }} />
                      <span style={{ fontSize: '0.86rem', fontWeight: 'bold', color: '#fca5a5' }}>
                        {language === 'bn' ? 'মাইনাস / কর্তনের বিবরণ (যেমন: বরফ কেনা)' : 'Deductions & Expenses'}
                      </span>
                      <span style={{ background: 'rgba(239, 68, 68, 0.22)', color: '#fca5a5', padding: '1px 6px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600 }}>
                        {deductionsList.length} টি
                      </span>
                    </div>

                    {totalDeductions > 0 && (
                      <span style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#fca5a5', padding: '2px 8px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                        মোট: - ৳ {totalDeductions.toFixed(2)}
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {deductionsList.map(d => (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.25)', padding: '5px 8px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span style={{ background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem', userSelect: 'none' }}>
                          [-]
                        </span>
                        <input
                          type="text"
                          placeholder={language === 'bn' ? 'বিবরণ (যেমন: বরফ কেনা)' : 'Description (e.g., Ice purchase)'}
                          value={d.title}
                          onChange={e => updateDeduction(d.id, 'title', e.target.value)}
                          style={{
                            flex: 1,
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '5px',
                            padding: '5px 9px',
                            color: '#fff',
                            fontSize: '0.84rem'
                          }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(239, 68, 68, 0.32)', borderRadius: '5px', padding: '2px 6px' }}>
                          <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.82rem' }}>৳</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={d.amount}
                            onChange={e => updateDeduction(d.id, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                            style={{
                              width: '85px',
                              textAlign: 'right',
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: '#fca5a5',
                              fontWeight: 'bold',
                              fontSize: '0.88rem',
                              padding: '3px 0'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDeduction(d.id)}
                          data-html2canvas-ignore
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.22)',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '5px',
                            borderRadius: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.1rem' }} data-html2canvas-ignore>
                    <button
                      type="button"
                      onClick={() => handleAddDeduction()}
                      style={{
                        background: 'transparent',
                        border: '1px dashed rgba(239, 68, 68, 0.32)',
                        borderRadius: '6px',
                        color: '#fca5a5',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Plus size={13} />
                      <span>{language === 'bn' ? '+ আরও খরচ যোগ করুন' : '+ Add more deduction'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Insights & Remarks Card (fills void pointed to by 2nd arrow) */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                background: 'linear-gradient(135deg, rgba(16, 42, 28, 0.45) 0%, rgba(10, 24, 16, 0.65) 100%)',
                border: '1px solid rgba(114, 190, 68, 0.18)',
                borderRadius: '12px',
                padding: '0.85rem 1.1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Package size={14} style={{ color: '#72be44' }} />
                      <span style={{ fontSize: '0.78rem', color: '#aaa' }}>{language === 'bn' ? 'মোট পদ:' : 'Items:'}</span>
                      <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>
                        {totalItemsCount} {language === 'bn' ? 'টি' : 'items'}
                      </span>
                    </div>
                    <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.1)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Scale size={14} style={{ color: '#72be44' }} />
                      <span style={{ fontSize: '0.78rem', color: '#aaa' }}>{language === 'bn' ? 'মোট ওজন:' : 'Weight:'}</span>
                      <span style={{ fontWeight: 'bold', color: '#72be44', fontSize: '0.85rem' }}>
                        {totalKgSum.toFixed(2)} {language === 'bn' ? 'কেজি' : 'kg'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {dueAmount > 0 ? (
                      <span style={{ background: 'rgba(255, 152, 0, 0.15)', color: '#ffb74d', border: '1px solid rgba(255, 152, 0, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> {language === 'bn' ? 'বকেয়া মেমো' : 'Due Memo'}
                      </span>
                    ) : excessAmount > 0 ? (
                      <span style={{ background: 'rgba(52, 211, 153, 0.18)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.45)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> {language === 'bn' ? `পরিশোধিত (ফেরত: ৳ ${excessAmount.toFixed(2)})` : `Paid (Refund: ৳ ${excessAmount.toFixed(2)})`}
                      </span>
                    ) : grandTotal > 0 ? (
                      <span style={{ background: 'rgba(114, 190, 68, 0.15)', color: '#72be44', border: '1px solid rgba(114, 190, 68, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} /> {language === 'bn' ? 'পরিশোধিত' : 'Paid in Full'}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.22)', padding: '5px 10px', borderRadius: '7px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <FileText size={14} style={{ color: '#888', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder={language === 'bn' ? 'নোট বা মন্তব্য (ঐচ্ছিক — যেমন: গাড়ী নং, চালান নং)' : 'Remarks / Note (Optional — e.g. Vehicle no, Truck no)'}
                    value={memoState.note || ''}
                    onChange={e => updateMemoState('note', e.target.value)}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#ccc',
                      fontSize: '0.8rem'
                    }}
                  />
                </div>
              </div>

            </div>

            {/* Right Column: Premium Totals Box */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.7rem',
              background: 'linear-gradient(145deg, rgba(16, 44, 28, 0.75) 0%, rgba(8, 26, 16, 0.9) 100%)',
              padding: '1.15rem 1.3rem',
              borderRadius: '14px',
              border: '1px solid rgba(114, 190, 68, 0.35)',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.55rem' }}>
                <div style={{ background: 'rgba(114, 190, 68, 0.2)', padding: '4px 6px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                  <Calculator size={16} style={{ color: '#72be44' }} />
                </div>
                <span style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff' }}>
                  {language === 'bn' ? 'বিল ও হিসাব সারাংশ' : 'Bill Summary'}
                </span>
              </div>

              {/* Fish Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.88rem' }}>
                  {language === 'bn' ? 'মাছের মোট মূল্য:' : 'Fish Total:'}
                </span>
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.98rem' }}>
                  ৳ {fishTotal.toFixed(2)}
                </span>
              </div>

              {/* Dedicated Commission Section */}
              <div 
                data-html2canvas-ignore={commissionAmount === 0 ? true : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  marginTop: '2px',
                  marginBottom: '2px'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.86rem', color: '#fde047', fontWeight: 600 }}>
                    {language === 'bn' ? 'কমিশন:' : 'Commission:'}
                  </span>
                  
                  <div data-html2canvas-ignore style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {/* Operation toggle */}
                    <div style={{ display: 'inline-flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionOperation', 'subtract')}
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.74rem',
                          fontWeight: 'bold',
                          background: (memoState.commissionOperation || 'subtract') === 'subtract' ? '#ef4444' : 'transparent',
                          color: (memoState.commissionOperation || 'subtract') === 'subtract' ? '#ffffff' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title={language === 'bn' ? 'কমিশন মাইনাস (ছাড়)' : 'Subtract Commission'}
                      >
                        [-]
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionOperation', 'add')}
                        style={{
                          padding: '2px 7px',
                          fontSize: '0.74rem',
                          fontWeight: 'bold',
                          background: memoState.commissionOperation === 'add' ? '#22c55e' : 'transparent',
                          color: memoState.commissionOperation === 'add' ? '#ffffff' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                        title={language === 'bn' ? 'কমিশন যোগ' : 'Add Commission'}
                      >
                        [+]
                      </button>
                    </div>

                    {/* Unit toggle */}
                    <div style={{ display: 'inline-flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionType', 'percent')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.74rem',
                          fontWeight: 'bold',
                          background: (memoState.commissionType || 'percent') === 'percent' ? '#eab308' : 'transparent',
                          color: (memoState.commissionType || 'percent') === 'percent' ? '#000000' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMemoState('commissionType', 'flat')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.74rem',
                          fontWeight: 'bold',
                          background: memoState.commissionType === 'flat' ? '#eab308' : 'transparent',
                          color: memoState.commissionType === 'flat' ? '#000000' : '#cbd5e1',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        ৳
                      </button>
                    </div>

                    {/* Input */}
                    <MathInput
                      style={{
                        width: '60px',
                        height: '24px',
                        padding: '1px 5px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(234, 179, 8, 0.45)',
                        borderRadius: '4px',
                        color: '#ffffff',
                        textAlign: 'right'
                      }}
                      placeholder="0"
                      value={(typeof memoState.commissionValue === 'number' || typeof memoState.commissionValue === 'string') ? memoState.commissionValue : ''}
                      onChange={(e: any) => {
                        const v = e && typeof e === 'object' && e.target ? e.target.value : e;
                        updateMemoState('commissionValue', v);
                      }}
                    />
                  </div>
                </div>

                {commissionAmount > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                    color: (memoState.commissionOperation || 'subtract') === 'add' ? '#86efac' : '#fca5a5',
                    borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                    paddingTop: '4px'
                  }}>
                    <span>
                      {(memoState.commissionOperation || 'subtract') === 'add' ? '[+]' : '[-]'} {language === 'bn' ? 'কমিশন' : 'Commission'}{' '}
                      ({memoState.commissionType === 'flat' ? `৳${commVal}` : `${commVal}%`}):
                    </span>
                    <span style={{ fontWeight: 'bold' }}>
                      {(memoState.commissionOperation || 'subtract') === 'add' ? `+ ৳ ${commissionAmount.toFixed(2)}` : `- ৳ ${commissionAmount.toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Render each deduction item */}
              {deductionsList.map(d => {
                const amt = Number(d.amount) || 0;
                if (!d.title && amt === 0) return null;
                return (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fca5a5', fontSize: '0.84rem', paddingLeft: '8px', borderLeft: '2px solid rgba(239, 68, 68, 0.45)' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                      [-] {d.title || (language === 'bn' ? 'মাইনাস খরচ' : 'Deduction')}:
                    </span>
                    <span style={{ fontWeight: 600 }}>- ৳ {amt.toFixed(2)}</span>
                  </div>
                );
              })}

              {deductionsList.length > 0 && totalDeductions > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(239, 68, 68, 0.3)', paddingTop: '4px', color: '#f87171', fontSize: '0.84rem', fontWeight: 'bold' }}>
                  <span>{language === 'bn' ? 'মোট মাইনাস:' : 'Total Deductions:'}</span>
                  <span>- ৳ {totalDeductions.toFixed(2)}</span>
                </div>
              )}

              {/* Grand Total Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, rgba(114, 190, 68, 0.16), rgba(76, 175, 80, 0.08))',
                border: '1px solid rgba(114, 190, 68, 0.4)',
                borderRadius: '8px',
                padding: '0.6rem 0.85rem',
                marginTop: '0.15rem'
              }}>
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.92rem' }}>
                  {language === 'bn' ? 'চূড়ান্ত বিল (মোট):' : 'Net Total:'}
                </span>
                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.2rem' }}>
                  ৳ {grandTotal.toFixed(2)}
                </span>
              </div>

              {/* Jama / Paid Amount */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.88rem' }}>
                  {t('jamaPaid')}
                </span>
                <MathInput 
                  className="supplier-input" 
                  style={{
                    width: '115px',
                    textAlign: 'right',
                    padding: '0.35rem 0.6rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.92rem'
                  }}
                  value={memoState.paidAmount}
                  onChange={e => updateMemoState('paidAmount', parseMathOrNumber(e.target.value))}
                  placeholder="0.00"
                />
              </div>

              {/* Due (Baki) */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '0.6rem',
                marginTop: '0.15rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: dueAmount > 0 ? '#ff9800' : '#72be44' }}>
                    Due (Baki):
                  </span>
                  {dueAmount === 0 && grandTotal > 0 && (
                    <span style={{ fontSize: '0.7rem', color: excessAmount > 0 ? '#34d399' : '#72be44', fontWeight: 600 }}>
                      {language === 'bn' ? '✔ পরিশোধিত' : 'Paid in full'}
                    </span>
                  )}
                </div>
                <span style={{
                  fontWeight: 'bold',
                  color: dueAmount > 0 ? '#ff9800' : '#72be44',
                  fontSize: '1.18rem'
                }}>
                  ৳ {dueAmount.toFixed(2)}
                </span>
              </div>

              {/* Excess Payment / Return to Customer */}
              {excessAmount > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(5, 150, 105, 0.28) 100%)',
                  border: '1px solid rgba(52, 211, 153, 0.5)',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  marginTop: '0.5rem',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span>↩️</span> {t('excessReturn') || (language === 'bn' ? 'অতিরিক্ত জমা (ফেরত):' : 'Excess / Change Due:')}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#a7f3d0', fontWeight: 600 }}>
                      {t('excessReturnHint') || (language === 'bn' ? 'গ্রাহককে ফেরত দিতে হবে' : 'Refund to customer')}
                    </span>
                  </div>
                  <span style={{
                    fontWeight: 'bold',
                    color: '#34d399',
                    fontSize: '1.25rem',
                    textShadow: '0 0 10px rgba(52, 211, 153, 0.35)'
                  }}>
                    ৳ {excessAmount.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

          </div>

          <div className="memo-contact-info-dark" style={{ padding: '0 2rem', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Phone size={18} style={{ color: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>01719-503864</span>
              <div style={{ position: 'relative' }}>
                <Phone 
                  size={18} 
                  style={{ cursor: 'pointer', color: '#72be44', marginLeft: '8px' }} 
                  onClick={() => setShowBusinessCallMenu(!showBusinessCallMenu)} 
                  data-html2canvas-ignore
                />
                {showBusinessCallMenu && (
                  <CallMenu 
                    phones={['01719503864']} 
                    onClose={() => setShowBusinessCallMenu(false)} 
                    position="right"
                  />
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Phone size={18} style={{ color: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>01568-387047</span>
              <div style={{ position: 'relative' }}>
                <Phone 
                  size={18} 
                  style={{ cursor: 'pointer', color: '#72be44', marginLeft: '8px' }} 
                  onClick={() => setShowBusinessCallMenu2(!showBusinessCallMenu2)} 
                  data-html2canvas-ignore
                />
                {showBusinessCallMenu2 && (
                  <CallMenu 
                    phones={['01568387047']} 
                    onClose={() => setShowBusinessCallMenu2(false)} 
                    position="right"
                  />
                )}
              </div>
            </div>
          </div>


          <div className="memo-dark-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', marginTop: '1.5rem', alignItems: 'flex-start' }}>
            <MemoSignatureBox 
              label={t('receiverSig')}
              signatureData={memoState.receiverSignature}
              penColor="#72be44"
              onSave={handleSaveReceiverSig}
              onClear={handleClearReceiverSig}
            />
            
            <MemoSignatureBox 
              label={t('sellerSig')}
              signatureData={memoState.sellerSignature}
              penColor="#72be44"
              onSave={handleSaveSellerSig}
              onClear={handleClearSellerSig}
            />
          </div>
          
        </div>
      </div>

    </div>
  );
};

export default SalesMemoScreen;



