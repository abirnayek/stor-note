import { MemoSignatureBox } from './MemoSignatureBox';
import { MathInput, DebouncedInput, parseMathOrNumber, focusNewTableRow } from './MathInput';
import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Undo, Redo, MessageCircle, Mail, Share2, Download, Plus, Trash2, Phone, Palette, MinusCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CallMenu from './CallMenu';
import { getLotStock, type LotStockSummary } from '../utils/stockUtils';


interface SalesMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number | null;
  memoId: string;
  onLotChange?: (lot: any) => void;
  onBack?: () => void;
  defaultCustomerType?: 'regular' | 'permanent';
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
  customerType?: 'regular' | 'permanent' | '';
  status?: 'due' | 'paid' | 'draft';
  createdAt?: string;
  createdAtTime?: string;
  updatedAt?: string;
  updatedAtTime?: string;
  isOriginalDate?: boolean;
  customDate?: string;
  receiverSignature?: string;
  sellerSignature?: string;
  entries: FishEntry[];
  deductions?: MemoDeduction[];
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
      try { dueData = JSON.parse(dueStr); } catch(e) {}
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
        deductions: rawDeductions
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
      deductions: []
    };
  };

  const storageKey = `sales_memo_${memoId}`;
  const [memoState, setMemoState, undo, redo, canUndo, canRedo] = useHistory<MemoState>(getInitialState(), storageKey);

  useEffect(() => {
    const handleStorage = () => {
      const defaultSig = localStorage.getItem('default_seller_signature') || '';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (!parsed.sellerSignature && defaultSig) {
            parsed.sellerSignature = defaultSig;
          }
          setMemoState(parsed);
        } catch(e) {}
      } else if (defaultSig) {
        setMemoState(prev => ({ ...prev, sellerSignature: defaultSig }));
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('global_seller_signature_changed', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('global_seller_signature_changed', handleStorage);
    };
  }, [storageKey]);
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

  const handleAddDeduction = (defaultTitle: string = '') => {
    setMemoState(prev => ({
      ...prev,
      deductions: [
        ...(prev.deductions || []),
        { id: `ded_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, title: defaultTitle, amount: '' }
      ]
    }));
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
    }));
  };

  const isMounted = useRef(false);

  
  const handleSaveReceiverSig = (dataUrl: string) => {
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

      // 1. Save to canonical storage key and destination storage key
      const canonicalKey = `sales_memo_${memoId}`;
      localStorage.setItem(canonicalKey, JSON.stringify(stateToSave));

      const destKey = `sales_memo_lot_${validLot === null ? 'unassigned' : validLot}_memo_${memoId}`;
      localStorage.setItem(destKey, JSON.stringify(stateToSave));

      // Preserve stable local timestamp for canonical and dest keys so sorting in Global List never jumps
      try {
        const tsRaw = localStorage.getItem('local_timestamps');
        let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
        let memoTimestamp = tsMap[canonicalKey]
          || tsMap[destKey]
          || tsMap[`sales_memo_lot_${lotNumber ?? 'unassigned'}_memo_${memoId}`]
          || tsMap[`due_memo_${memoId}`]
          || (stateToSave.createdAt ? Date.parse(stateToSave.createdAt) : 0)
          || (!isNaN(Number(memoId)) && Number(memoId) > 1000000000 ? Number(memoId) : 0);

        if (!memoTimestamp || isNaN(memoTimestamp)) {
          memoTimestamp = Date.now();
        }
        tsMap[canonicalKey] = memoTimestamp;
        tsMap[destKey] = memoTimestamp;
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

      window.dispatchEvent(new Event('storage'));
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

    if (memoState.createdAt && memoState.createdAt !== today && memoState.updatedAt !== today) {
      const editTime = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      setMemoState(prev => ({ ...prev, updatedAt: today, updatedAtTime: editTime }));
      return;
    }

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
    const grandTotal = Math.max(0, Math.round((fishTotal - totalDeductions) * 100) / 100);
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
      setMemoState(prev => ({ ...prev, status: currentStatus }));
    }

    // Sync to due accounts if customer type is selected
    if (memoState.customerType) {
      const type = memoState.customerType;
      const otherType = type === 'regular' ? 'permanent' : 'regular';
      
      let existingDueObj: any = {};
      try {
        const dStr = localStorage.getItem(`due_memo_${memoId}`);
        if (dStr) existingDueObj = JSON.parse(dStr);
      } catch (e) {}

      const newDueData = {
        ...existingDueObj,
        id: memoId,
        memoState: memoState,
        date: memoState.createdAt || today,
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

        // Remove from other type dues list
        const otherDuesStr = localStorage.getItem(`dues_${otherType}`);
        let otherDues: string[] = otherDuesStr ? JSON.parse(otherDuesStr) : [];
        if (otherDues.includes(memoId)) {
          otherDues = otherDues.filter(id => id !== memoId);
          localStorage.setItem(`dues_${otherType}`, JSON.stringify(otherDues));
        }

        // Remove from all paid lists
        ['regular', 'permanent'].forEach(t => {
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

        // Remove from other paid list
        const otherPaidStr = localStorage.getItem(`paid_dues_${otherType}`);
        let otherPaid: string[] = otherPaidStr ? JSON.parse(otherPaidStr) : [];
        if (otherPaid.includes(memoId)) {
          otherPaid = otherPaid.filter(id => id !== memoId);
          localStorage.setItem(`paid_dues_${otherType}`, JSON.stringify(otherPaid));
        }

        // Remove from all dues lists
        ['regular', 'permanent'].forEach(t => {
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
    setSaveStatus('Saving...');
    const timer = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(timer);
  }, [memoState, lotNumber, memoId]);



  const updateMemoState = (field: keyof MemoState, value: any) => {
    setMemoState(prev => {
      const newState = { ...prev, [field]: value };
      if (field === 'lotNumberInput') {
        if (!value) {
          newState.entries = newState.entries.map(e => ({ ...e, buyRate: 0 }));
        }
        syncMemoToLot(value, newState);
      }
      return newState;
    });
  };

  const updateEntry = (id: string, field: keyof FishEntry, value: any) => {
    setMemoState(prev => {
      let updatedEntries = prev.entries.map(e => e.id === id ? { ...e, [field]: value } : e);
      
      // Auto-fill logic by name
      if (field === 'name' && prev.lotNumberInput) {
        const lotMemoStr = localStorage.getItem(`memo_lot_${prev.lotNumberInput}`);
        if (lotMemoStr) {
          try {
            const lotMemo = JSON.parse(lotMemoStr);
            const foundIndex = lotMemo.entries.findIndex((e: any) => e.name === value);
            if (foundIndex !== -1) {
               const foundEntry = lotMemo.entries[foundIndex];
               if (foundEntry.totalKg && foundEntry.totalPrice) {
                 const autoRate = foundEntry.totalPrice / foundEntry.totalKg;
                 let costPercent = 0;
                 if (lotMemo.totalPriceMain && lotMemo.totalCostMain) {
                     costPercent = (Number(lotMemo.totalCostMain) / Number(lotMemo.totalPriceMain)) * 100;
                 }
                 const investmentRate = autoRate + (autoRate * costPercent / 100);
                 updatedEntries = updatedEntries.map(e => e.id === id ? { ...e, buyRate: Number(investmentRate.toFixed(2)), serialNo: (foundIndex + 1).toString() } : e);
               }
            }
          } catch (err) {}
        }
      }
      
      // Auto-fill logic by serialNo
      if (field === 'serialNo') {
        if (prev.lotNumberInput && value) {
          const lotMemoStr = localStorage.getItem(`memo_lot_${prev.lotNumberInput}`);
          if (lotMemoStr) {
            try {
              const lotMemo = JSON.parse(lotMemoStr);
              const index = Number(value) - 1;
              if (index >= 0 && index < lotMemo.entries.length) {
                 const foundEntry = lotMemo.entries[index];
                 if (foundEntry.totalKg && foundEntry.totalPrice) {
                   const autoRate = foundEntry.totalPrice / foundEntry.totalKg;
                   let costPercent = 0;
                   if (lotMemo.totalPriceMain && lotMemo.totalCostMain) {
                       costPercent = (Number(lotMemo.totalCostMain) / Number(lotMemo.totalPriceMain)) * 100;
                   }
                   const investmentRate = autoRate + (autoRate * costPercent / 100);
                   updatedEntries = updatedEntries.map(e => e.id === id ? { ...e, buyRate: Number(investmentRate.toFixed(2)), name: foundEntry.name } : e);
                 }
              }
            } catch (err) {}
          }
        } else if (!value) {
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
      entries: [...prev.entries, { id: Date.now().toString(), name: '', totalKg: '', profitPercent: '' }]
    }));
    focusNewTableRow();
  };

  const handleDeleteRow = (id: string) => {
    setMemoState(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id)
    }));
  };

  const handleDownload = async () => {
    if (memoRef.current) {
      try {
        const canvas = await html2canvas(memoRef.current, { scale: 2, backgroundColor: '#092115' }); // Match dark theme
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Sales_Memo_Lot_${lotNumber}.pdf`);
      } catch (err) {
        console.error('Failed to download PDF', err);
      }
    }
  };

  const shareUrl = window.location.href;
  const shareText = `Check out this Sales Memo (Lot: ${lotNumber})`;



  let fishTotal = 0;
  memoState.entries.forEach(entry => {
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

    if (weightInKg > 0 && saleRate > 0) {
      fishTotal += weightInKg * saleRate;
    }
  });

  const deductionsList = memoState.deductions || [];
  const totalDeductions = deductionsList.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const grandTotal = Math.max(0, Math.round((fishTotal - totalDeductions) * 100) / 100);
  const dueAmount = Math.max(0, Math.round((grandTotal - Number(memoState.paidAmount || 0)) * 100) / 100);

  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar" data-html2canvas-ignore>
        <button className="btn-icon" onClick={handleBack}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{t('salesMemo')}</h2>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'Saved' ? '#72be44' : '#fff', transition: 'color 0.3s' }}>
            {saveStatus === 'Saved' ? '✔ All changes saved' : 'Saving...'}
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
            <button className="btn-icon action-fb" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)} title="Share on Facebook">
              <Share2 size={24} />
            </button>
            <button className="btn-icon action-wa" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`)} title="Share on WhatsApp">
              <MessageCircle size={24} />
            </button>
            <button className="btn-icon action-mail" onClick={() => window.open(`mailto:?subject=Sales Memo&body=${encodeURIComponent(shareText + ' ' + shareUrl)}`)} title="Share via Email">
              <Mail size={24} />
            </button>
          </div>

          <button className="btn-icon action-download" onClick={handleDownload} title="Download PDF">
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

          <div className="memo-dark-title">
            <h2>{t('salesAccount')}</h2>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className="memo-label-dark">{t('date')}: </span>

                  {/* Date Mode Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = !memoState.isOriginalDate;
                      updateMemoState('isOriginalDate', nextMode);
                      if (!nextMode && !memoState.customDate) {
                        updateMemoState('customDate', memoState.updatedAt || memoState.createdAt || today);
                      }
                    }}
                    title={memoState.isOriginalDate !== false ? 'বর্তমানে অরিজিনাল তারিখ দেখাচ্ছে। পরিবর্তন করতে ক্লিক করুন।' : 'বর্তমানে কাস্টম তারিখ দেখাচ্ছে। অরিজিনালে ফিরতে ক্লিক করুন।'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: memoState.isOriginalDate !== false ? 'rgba(114, 190, 68, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                      border: memoState.isOriginalDate !== false ? '1px solid #72be44' : '1px solid #ff9800',
                      color: memoState.isOriginalDate !== false ? '#72be44' : '#ffb74d',
                      borderRadius: '16px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {memoState.isOriginalDate !== false ? '🔘 অরিজিনাল' : '✏️ কাস্টম'}
                  </button>

                  {/* Date Display / Input */}
                  {memoState.isOriginalDate !== false ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{memoState.createdAt || today}</span>
                      {memoState.createdAtTime && (
                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>({memoState.createdAtTime})</span>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={memoState.customDate || memoState.createdAt || today}
                      onChange={e => updateMemoState('customDate', e.target.value)}
                      placeholder="তারিখ লিখুন..."
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        color: '#fff',
                        width: '130px',
                        padding: '2px 6px',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                        outline: 'none'
                      }}
                    />
                  )}
                </div>

                {memoState.updatedAt && (
                  <div style={{ fontSize: '0.72rem', color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>পরিবর্তিত: {memoState.updatedAt}</span>
                    {memoState.updatedAtTime && <span>({memoState.updatedAtTime})</span>}
                  </div>
                )}
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
                </select>
              </div>
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
                      style={{
                        backgroundColor: activePalette ? activePalette.bg : undefined,
                        boxShadow: activePalette ? `inset 4px 0 0 ${activePalette.border}` : undefined,
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <td data-label="Sl No.">
                        <DebouncedInput 
                          placeholder="Sl"
                          value={entry.serialNo || ''}
                          onChange={e => updateEntry(entry.id, 'serialNo', e.target.value)}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                          style={{ width: '50px', textAlign: 'center' }}
                        />
                      </td>
                      <td data-label={t('fishName')}>
                        <DebouncedInput 
                          placeholder={t('writeHere')}
                          value={entry.name}
                          onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                        />
                        {currentLotStock && (() => {
                          const sItem = currentLotStock.items.find(
                            it => (entry.serialNo && it.serialNo === Number(entry.serialNo)) || 
                                  (entry.name && it.name.trim().toLowerCase() === entry.name.trim().toLowerCase())
                          );
                          if (sItem) {
                            const isAvailable = sItem.remainingKg > 0;
                            const isLow = isAvailable && sItem.purchasedKg > 0 && (sItem.remainingKg / sItem.purchasedKg) < 0.25;
                            const badgeColor = !isAvailable ? '#ff5252' : isLow ? '#ffb300' : '#72be44';
                            const badgeBg = !isAvailable ? 'rgba(255, 82, 82, 0.12)' : isLow ? 'rgba(255, 179, 0, 0.12)' : 'rgba(114, 190, 68, 0.12)';
                            const badgeBorder = !isAvailable ? 'rgba(255, 82, 82, 0.3)' : isLow ? 'rgba(255, 179, 0, 0.3)' : 'rgba(114, 190, 68, 0.3)';

                            return (
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
                                marginTop: '4px',
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
                                <span>স্টক: {sItem.remainingKg} kg {sItem.remainingKg <= 0 ? '(শেষ)' : ''}</span>
                              </div>
                            );
                          }
                          return null;
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

          <div style={{ padding: '1rem 2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            
            {/* Left Side: Add Row + Deductions / Expenses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, minWidth: '280px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }} data-html2canvas-ignore>
                <button className="add-row-dark-btn" onClick={handleAddRow} style={{ margin: 0 }}>
                  <Plus size={16} /> {t('addNewRow')}
                </button>
                
                <button 
                  type="button"
                  onClick={() => handleAddDeduction()} 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s'
                  }}
                  title={language === 'bn' ? 'কোনো খরচ বা বরফ কেনা ইত্যাদি মাইনাস করুন' : 'Add deduction or expense'}
                >
                  <MinusCircle size={15} style={{ color: '#ef4444' }} />
                  <span>{language === 'bn' ? '+ মাইনাস / খরচ যোগ করুন' : '+ Add Deduction / Minus'}</span>
                </button>
              </div>

              {/* Quick suggestion chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} data-html2canvas-ignore>
                <span style={{ fontSize: '0.72rem', color: '#888' }}>{language === 'bn' ? 'দ্রুত যোগ করুন:' : 'Quick add:'}</span>
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
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      color: '#ccc',
                      cursor: 'pointer'
                    }}
                  >
                    {item.icon} {item.title}
                  </button>
                ))}
              </div>

              {/* Deductions Edit Box */}
              {deductionsList.length > 0 && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginTop: '0.2rem'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MinusCircle size={14} style={{ color: '#ef4444' }} />
                    <span>{language === 'bn' ? 'মাইনাস / কর্তনের বিবরণ (যেমন: বরফ কেনা)' : 'Deductions & Expenses'}</span>
                  </div>
                  
                  {deductionsList.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem' }}>[-]</span>
                      <input
                        type="text"
                        placeholder={language === 'bn' ? 'বিবরণ (যেমন: বরফ কেনা)' : 'Description (e.g., Ice purchase)'}
                        value={d.title}
                        onChange={e => updateDeduction(d.id, 'title', e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: '#fff',
                          fontSize: '0.82rem'
                        }}
                      />
                      <input
                        type="number"
                        placeholder="0.00"
                        value={d.amount}
                        onChange={e => updateDeduction(d.id, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                        style={{
                          width: '90px',
                          textAlign: 'right',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          color: '#fca5a5',
                          fontWeight: 'bold',
                          fontSize: '0.85rem'
                        }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#888' }}>৳</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteDeduction(d.id)}
                        data-html2canvas-ignore
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                        title={language === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side: Totals Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: '240px', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="memo-label-dark">{language === 'bn' ? 'মাছের মোট মূল্য:' : 'Fish Total:'}</span>
                <span style={{ fontWeight: 'bold', color: '#fff' }}>৳ {fishTotal.toFixed(2)}</span>
              </div>

              {/* Render each deduction item */}
              {deductionsList.map(d => {
                const amt = Number(d.amount) || 0;
                if (!d.title && amt === 0) return null;
                return (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fca5a5', fontSize: '0.85rem' }}>
                    <span>[-] {d.title || (language === 'bn' ? 'মাইনাস খরচ' : 'Deduction')}:</span>
                    <span style={{ fontWeight: 600 }}>- ৳ {amt.toFixed(2)}</span>
                  </div>
                );
              })}

              {deductionsList.length > 0 && totalDeductions > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(239,68,68,0.3)', paddingTop: '4px', color: '#f87171', fontSize: '0.82rem' }}>
                  <span>{language === 'bn' ? 'মোট মাইনাস:' : 'Total Deductions:'}</span>
                  <span style={{ fontWeight: 'bold' }}>- ৳ {totalDeductions.toFixed(2)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '0.5rem' }}>
                <span className="memo-label-dark" style={{ fontWeight: 'bold', color: '#fff' }}>{language === 'bn' ? 'চূড়ান্ত বিল (মোট):' : 'Net Total:'}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>৳ {grandTotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="memo-label-dark">{t('jamaPaid')}</span>
                <MathInput 
                  className="supplier-input" 
                  style={{ width: '110px', textAlign: 'right', padding: '0.3rem 0.5rem' }}
                  value={memoState.paidAmount}
                  onChange={e => updateMemoState('paidAmount', parseMathOrNumber(e.target.value))}
                  placeholder="0.00"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                <span className="memo-label-dark">Due (Baki):</span>
                <span style={{ fontWeight: 'bold', color: '#ff9800', fontSize: '1.05rem' }}>৳ {dueAmount.toFixed(2)}</span>
              </div>
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



