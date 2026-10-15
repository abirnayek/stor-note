import { MemoSignatureBox } from './MemoSignatureBox';
import { MathInput, DebouncedInput, parseMathOrNumber, focusNewTableRow } from './MathInput';
import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { Share2, Download, Plus, Trash2, Phone, Undo, Redo, MessageCircle, Mail, ChevronLeft, Lock, X, Package, CheckCircle2, AlertTriangle, XCircle, Calendar } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CallMenu from './CallMenu';
import { getLotStock, type LotStockSummary } from '../utils/stockUtils';
import { bnToEnDigits, parseMemoMonthYear } from '../utils/dateUtils';

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


interface MemoScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number | null;
  onBack?: () => void;
}

interface FishEntry {
  id: string;
  name: string;
  totalKg: number | '';
  weightUnit?: 'kg' | 'g';
  totalPrice: number | '';
  profitPercent?: number | '';
}

interface MemoState {
  supplierName: string;
  supplierPhone?: string;
  totalPriceMain: number | '';
  totalCostMain: number | '';
  globalProfitPercent?: number | '';
  paidAmount?: number | '';
  createdAt?: string;
  updatedAt?: string;
  status?: 'draft' | 'due' | 'paid';
  receiverSignature?: string;
  sellerSignature?: string;
  entries: FishEntry[];
}

const MemoScreen: React.FC<MemoScreenProps> = ({ onNavigate, lotNumber, onBack }) => {
  const { t, language, formatNumber } = useLanguage();
  const memoRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getInitialState = (): MemoState => {
    let saved = localStorage.getItem(`memo_lot_${lotNumber}`);
    if (!saved && lotNumber) {
      const dueSaved = localStorage.getItem(`due_memo_purchase_lot_${lotNumber}`);
      if (dueSaved) {
        try {
          const parsedDue = JSON.parse(dueSaved);
          if (parsedDue.memoState) {
            saved = JSON.stringify(parsedDue.memoState);
          }
        } catch(e) {}
      }
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.createdAt) {
          parsed.createdAt = today;
        }
        return { ...parsed, receiverSignature: parsed.receiverSignature || '', sellerSignature: parsed.sellerSignature || localStorage.getItem('default_seller_signature') || '' };
      } catch (e) {
        console.error('Failed to parse saved memo');
      }
    }
    return {
      supplierName: '',
      supplierPhone: '',
      totalPriceMain: '',
      totalCostMain: '',
      globalProfitPercent: '',
      paidAmount: '',
      createdAt: today,
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', totalPrice: '', profitPercent: '' }]
    };
  };

  const storageKey = `memo_lot_${lotNumber}`;
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
  const [showSupplierCallMenu, setShowSupplierCallMenu] = useState(false);
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [lotStock, setLotStock] = useState<LotStockSummary | null>(null);

  const refreshLotStock = () => {
    if (lotNumber) {
      setLotStock(getLotStock(lotNumber));
    }
  };

  useEffect(() => {
    refreshLotStock();
    window.addEventListener('storage', refreshLotStock);
    return () => window.removeEventListener('storage', refreshLotStock);
  }, [lotNumber, memoState]);



  const processMarkDue = () => {
    const dueId = lotNumber ? `purchase_lot_${lotNumber}` : `purchase_${Date.now()}`;
    const supplierNameFinal = memoState.supplierName || (lotNumber ? `লট ${lotNumber} সাপ্লায়ার` : 'সাপ্লায়ার');
    const newDueData = {
      id: dueId,
      memoState: { ...memoState, status: 'due', type: 'purchase', customerType: 'purchase' },
      date: memoState.createdAt || today,
      name: supplierNameFinal,
      customerName: supplierNameFinal,
      supplierName: supplierNameFinal,
      mobile: memoState.supplierPhone || '',
      lotNumber: lotNumber ? lotNumber.toString() : '',
      deposit: memoState.paidAmount || 0,
      paidAmount: memoState.paidAmount || 0,
      type: 'purchase',
      customerType: 'purchase',
      status: 'due',
      entries: memoState.entries.map((e, index) => {
        let salePriceAuto = 0;
        let currentProfitPercent = e.profitPercent !== undefined && e.profitPercent !== '' ? Number(e.profitPercent) : (memoState.globalProfitPercent ? Number(memoState.globalProfitPercent) : 0);
        let buyRateNum = Number(e.totalPrice) || 0;
        if (buyRateNum > 0) {
          salePriceAuto = buyRateNum + (buyRateNum * currentProfitPercent / 100);
        }
        return {
          ...e,
          serialNo: (index + 1).toString(),
          name: e.name || `পণ্য ${index + 1}`,
          buyRate: e.totalPrice, // buyRate is what we bought it for
          manualSaleRate: salePriceAuto
        };
      })
    };
    
    const existingDuesStr = localStorage.getItem('dues_purchase');
    const existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
    if (!existingDues.includes(dueId)) {
      existingDues.push(dueId);
      localStorage.setItem('dues_purchase', JSON.stringify(existingDues));
    }
    
    localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(newDueData));
    
    window.dispatchEvent(new Event('storage'));
    alert(language === 'bn' ? 'ক্রয় বকেয়া অ্যাকাউন্টে যুক্ত হয়েছে!' : 'Added to Purchase Due Account!');
    setShowDueModal(false);
  };

  const isMounted = useRef(false);

  
  const handleSaveReceiverSig = (dataUrl: string) => {
    const key = `memo_lot_${lotNumber}`;
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

    const key = `memo_lot_${lotNumber}`;
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

  const handleBack = () => {
    try {
      const key = `memo_lot_${lotNumber}`;
      const finalState = { ...memoState };
      localStorage.setItem(key, JSON.stringify(finalState));
    } catch(e) {}
    if (onBack) {
      onBack();
    } else {
      onNavigate('lots');
    }
  };

  // Auto-save
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (memoState.createdAt && memoState.createdAt !== today && memoState.updatedAt !== today) {
      setMemoState(prev => ({ ...prev, updatedAt: today }), { recordHistory: false });
      return;
    }

    const tableTotalPrice = memoState.entries.reduce((sum, entry) => sum + (typeof entry.totalPrice === 'number' ? entry.totalPrice : 0), 0);
    const totalBill = tableTotalPrice > 0 ? tableTotalPrice : (Number(memoState.totalPriceMain) || 0);
    const paid = Number(memoState.paidAmount) || 0;
    const due = totalBill - paid;

    let currentStatus = memoState.status || 'draft';
    if (totalBill > 0) {
      if (due > 0) {
        currentStatus = 'due';
      } else {
        currentStatus = 'paid';
      }
    }

    const purchaseDueId = `purchase_lot_${lotNumber}`;
    const supplierNameFinal = memoState.supplierName || `লট ${lotNumber} সাপ্লায়ার`;

    if (totalBill > 0) {
      const dueMemoData = {
        id: purchaseDueId,
        name: supplierNameFinal,
        mobile: memoState.supplierPhone || '',
        address: '',
        date: memoState.createdAt || today,
        lotNumber: lotNumber ? lotNumber.toString() : '',
        deposit: paid,
        type: 'purchase',
        status: currentStatus,
        memoState: { ...memoState, totalPriceMain: totalBill },
        entries: memoState.entries.map((e, index) => {
          const totalKgNum = Number(e.totalKg) || 0;
          const totalPriceNum = Number(e.totalPrice) || 0;
          const weightInKg = e.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
          const buyRateVal = weightInKg > 0 ? totalPriceNum / weightInKg : totalPriceNum;

          return {
            id: e.id,
            serialNo: (index + 1).toString(),
            name: e.name || `পণ্য ${index + 1}`,
            totalKg: e.totalKg,
            weightUnit: e.weightUnit || 'kg',
            buyRate: buyRateVal || '',
            profitPercent: e.profitPercent !== undefined ? e.profitPercent : '',
            manualSaleRate: buyRateVal || ''
          };
        })
      };

      if (currentStatus === 'due') {
        localStorage.setItem(`due_memo_${purchaseDueId}`, JSON.stringify(dueMemoData));
        
        const existingDuesStr = localStorage.getItem('dues_purchase');
        let existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
        if (!existingDues.includes(purchaseDueId)) {
          existingDues.push(purchaseDueId);
          localStorage.setItem('dues_purchase', JSON.stringify(existingDues));
        }

        const existingPaidStr = localStorage.getItem('paid_dues_purchase');
        let existingPaid: string[] = existingPaidStr ? JSON.parse(existingPaidStr) : [];
        if (existingPaid.includes(purchaseDueId)) {
          existingPaid = existingPaid.filter(id => id !== purchaseDueId);
          localStorage.setItem('paid_dues_purchase', JSON.stringify(existingPaid));
        }
      } else if (currentStatus === 'paid') {
        localStorage.setItem(`due_memo_${purchaseDueId}`, JSON.stringify({ ...dueMemoData, paidDate: Date.now() }));

        const existingPaidStr = localStorage.getItem('paid_dues_purchase');
        let existingPaid: string[] = existingPaidStr ? JSON.parse(existingPaidStr) : [];
        if (!existingPaid.includes(purchaseDueId)) {
          existingPaid.push(purchaseDueId);
          localStorage.setItem('paid_dues_purchase', JSON.stringify(existingPaid));
        }

        const existingDuesStr = localStorage.getItem('dues_purchase');
        let existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
        if (existingDues.includes(purchaseDueId)) {
          existingDues = existingDues.filter(id => id !== purchaseDueId);
          localStorage.setItem('dues_purchase', JSON.stringify(existingDues));
        }
      }
    }

    localStorage.setItem(`memo_lot_${lotNumber}`, JSON.stringify({ ...memoState, totalPriceMain: totalBill, status: currentStatus }));
    setSaveStatus('Saving...');
    const timer = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(timer);
  }, [memoState, lotNumber, today]);

  const globalCostPercent = (typeof memoState.totalPriceMain === 'number' && typeof memoState.totalCostMain === 'number' && memoState.totalPriceMain > 0)
    ? (memoState.totalCostMain / memoState.totalPriceMain) * 100
    : 0;

  const tableTotalPrice = memoState.entries.reduce((sum, entry) => {
    return sum + (Number(entry.totalPrice) || 0);
  }, 0);

  const mainPrice = Number(memoState.totalPriceMain || 0);
  const isPriceMatched = tableTotalPrice > 0 && tableTotalPrice >= mainPrice;

  const devicePermission = localStorage.getItem('device_permission');
  const hasEditPermission = devicePermission === 'admin';

  const updateMemoState = (field: keyof MemoState, value: any) => {
    if (!hasEditPermission) return;
    setMemoState(prev => ({ ...prev, [field]: value }));
  };

  const updateEntry = (id: string, field: keyof FishEntry, value: any) => {
    if (!hasEditPermission) return;
    setMemoState(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  const handleAddRow = () => {
    if (!hasEditPermission) return;
    setMemoState(prev => ({
      ...prev,
      entries: [...prev.entries, { id: Date.now().toString(), name: '', totalKg: '', totalPrice: '', profitPercent: '' }]
    }), { immediate: true });
    focusNewTableRow();
  };

  const handleDeleteRow = (id: string) => {
    if (!hasEditPermission) return;
    setMemoState(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id)
    }), { immediate: true });
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

  const totalBill = tableTotalPrice > 0 ? tableTotalPrice : (Number(memoState.totalPriceMain) || 0);
  const paid = Number(memoState.paidAmount) || 0;
  const due = totalBill - paid;

  const generateCustomerMemoPdf = async (): Promise<{ pdf: jsPDF; pdfBlob: Blob; fileName: string } | null> => {
    const canvas = await getCustomerMemoCanvas();
    if (!canvas) return null;
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    const fileName = `Purchase_Memo_Lot_${lotNumber || 'Memo'}.pdf`;
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

      const supplier = memoState.supplierName ? memoState.supplierName.trim() : `লট ${lotNumber}`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const summaryText = `*সামুদ্রিক মাছ নোটবুক - ক্রয় মেমো*\nসাপ্লায়ার: ${supplier}\nতারিখ: ${memoState.createdAt || today}\nলট নং: ${lotNumber || 'N/A'}\nমোট বিল: ৳ ${totalBill}\nজমা: ৳ ${(Number(memoState.paidAmount) || 0).toFixed(2)}\nবকেয়া: ৳ ${due}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `ক্রয় মেমো - লট ${lotNumber}`,
          text: summaryText
        });
      } else {
        pdf.save(fileName);
        try {
          await navigator.clipboard.writeText(summaryText);
          alert(language === 'bn' 
            ? 'মেমো PDF ফাইলটি ডাউনলোড হয়েছে এবং বিবরণ ক্লিপবোর্ডে কপি হয়েছে! আপনি যেকোনো অ্যাপে শেয়ার করতে পারেন।' 
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
      const supplier = memoState.supplierName ? memoState.supplierName.trim() : `লট ${lotNumber}`;

      let itemsText = '';
      memoState.entries.forEach((e, idx) => {
        if ((e.name && e.name.trim() !== '') || Number(e.totalKg) > 0) {
          itemsText += `\n${idx + 1}. ${e.name || 'পণ্য'} - ${e.totalKg} ${e.weightUnit || 'kg'} = ৳${e.totalPrice}`;
        }
      });

      const waText = `*সামুদ্রিক মাছ নোটবুক - ক্রয় মেমো*\nসাপ্লায়ার: ${supplier}\nতারিখ: ${memoState.createdAt || today}\nলট নং: ${lotNumber || 'N/A'}\n----------------------------------\n*পণ্যের বিবরণ:*${itemsText}\n----------------------------------\n*মোট ক্রয় মূল্য: ৳ ${totalBill}*\nজমা: ৳ ${(Number(memoState.paidAmount) || 0).toFixed(2)}\n*বকেয়া: ৳ ${due}*`;

      let phone = (memoState.supplierPhone || '').replace(/[^\d]/g, '');
      if (phone.length === 11 && phone.startsWith('01')) {
        phone = '88' + phone;
      }

      if (res) {
        const { pdf, pdfBlob, fileName } = res;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `ক্রয় মেমো - লট ${lotNumber}`,
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
      const supplier = memoState.supplierName ? memoState.supplierName.trim() : `Lot ${lotNumber}`;
      const emailBody = `Purchase Memo - Samudrik Mach Notebook\nSupplier: ${supplier}\nDate: ${memoState.createdAt || today}\nLot: ${lotNumber || 'N/A'}\nTotal: Tk ${totalBill}\nPaid: Tk ${(Number(memoState.paidAmount) || 0).toFixed(2)}\nDue: Tk ${due}`;

      if (res) {
        const { pdf, pdfBlob, fileName } = res;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Purchase Memo - Lot ${lotNumber}`,
            text: emailBody
          });
          return;
        } else {
          pdf.save(fileName);
        }
      }

      window.open(`mailto:?subject=${encodeURIComponent(`Purchase Memo - Lot ${lotNumber}`)}&body=${encodeURIComponent(emailBody)}`);
    } catch (err) {
      console.error('Email error', err);
    }
  };

  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar">
        <button className="btn-icon" onClick={handleBack}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{t('purchaseMemo')}</h2>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'Saved' ? '#72be44' : '#fff', transition: 'color 0.3s' }}>
            {saveStatus === 'Saved' ? '✔ All changes saved' : 'Saving...'}
          </span>
        </div>

        <div className="header-actions">
          <button className="btn-icon action-undo" onClick={() => setShowPasswordModal(true)} title="Set Password">
            <Lock size={24} />
          </button>
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

          <button className="btn-icon action-download" onClick={handleDownload} title={language === 'bn' ? 'মেমো PDF ডাউনলোড' : 'Download PDF'}>
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
            <h2>{t('purchaseAccount')}</h2>
          </div>

          <div className="memo-top-meta">
            <div className="meta-item">
              <span className="memo-label-dark">{t('lotNumber')}</span>
              <span className="memo-value-dark" style={{ marginLeft: 10 }}>{lotNumber?.toString().padStart(2, '0')}</span>
            </div>
            <div className="meta-item text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="memo-label-dark">{t('date')}</span>
                <div style={{
                  position: 'relative',
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(114, 190, 68, 0.45)',
                  borderRadius: '8px',
                  padding: '2px 6px 2px 8px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                  gap: '4px'
                }}>
                  <input
                    type="text"
                    value={memoState.createdAt || today}
                    onChange={e => updateMemoState('createdAt', e.target.value)}
                    placeholder="DD-MM-YYYY"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '0.92rem',
                      width: '105px',
                      textAlign: 'center',
                      fontFamily: 'inherit',
                      letterSpacing: '0.5px'
                    }}
                    title={language === 'bn' ? 'তারিখ লিখুন বা ক্যালেন্ডার আইকনে ক্লিক করুন' : 'Enter date or click calendar icon'}
                  />
                  <input
                    type="date"
                    ref={datePickerInputRef}
                    value={getIsoDateForPicker(memoState.createdAt || today)}
                    onChange={e => {
                      if (e.target.value) {
                        const formatted = formatPickerDateToDisplay(e.target.value);
                        updateMemoState('createdAt', formatted);
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
                      padding: '3px 5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#72be44',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Calendar size={14} />
                  </button>
                </div>
              </div>
              {memoState.updatedAt && (
                <div style={{ fontSize: '0.75rem', color: '#ffb74d', marginTop: '2px' }}>
                  পরিবর্তিত তারিখ: {memoState.updatedAt}
                </div>
              )}
            </div>
            <div className="meta-item right-align" style={{ position: 'relative', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark">{t('supplierName')}</span>
                <DebouncedInput
                  type="text"
                  className="supplier-input"
                  value={memoState.supplierName}
                  onChange={e => updateMemoState('supplierName', e.target.value)}
                  placeholder={t('writeHere')}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="memo-label-dark">{t('mobileLabel')}</span>
                <DebouncedInput
                  type="text"
                  className="supplier-input"
                  value={memoState.supplierPhone || ''}
                  onChange={e => updateMemoState('supplierPhone', e.target.value)}
                  placeholder={t('writeHere')}
                />
                  <div style={{ position: 'relative' }}>
                    <Phone 
                      size={18} 
                      style={{ cursor: 'pointer', color: memoState.supplierPhone ? '#72be44' : '#aaa', marginLeft: '8px' }} 
                      onClick={() => {
                        if (memoState.supplierPhone) setShowSupplierCallMenu(!showSupplierCallMenu);
                        else alert('Please enter a mobile number first.');
                      }} 
                      data-html2canvas-ignore
                    />
                    {showSupplierCallMenu && memoState.supplierPhone && (
                      <CallMenu 
                        phones={[memoState.supplierPhone]} 
                        onClose={() => setShowSupplierCallMenu(false)} 
                        position="left"
                      />
                    )}
                  </div>
              </div>
            </div>
          </div>

          <div className="memo-summary-cards">
            <div className="summary-card-dark">
              <span className="memo-label-dark">{t('totalPriceLabel')}</span>
              <MathInput
                value={memoState.totalPriceMain}
                onChange={e => updateMemoState('totalPriceMain', parseMathOrNumber(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <div className="summary-card-dark">
              <span className="memo-label-dark">{t('totalCostLabel')}</span>
              <MathInput
                value={memoState.totalCostMain}
                onChange={e => updateMemoState('totalCostMain', parseMathOrNumber(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <div className="summary-card-dark calc-card" style={{ background: 'rgba(114, 190, 68, 0.08)', borderColor: 'rgba(114, 190, 68, 0.3)' }}>
              <span className="memo-label-dark" style={{ color: '#72be44' }}>{t('totalPriceWithCost')}</span>
              <span className="calc-value" style={{ color: '#72be44' }}>
                {(Number(memoState.totalPriceMain || 0) + Number(memoState.totalCostMain || 0)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="summary-card-dark calc-card">
              <span className="memo-label-dark">{t('calcCostPercent')}</span>
              <span className="calc-value">{((Number(memoState.totalCostMain || 0) / Number(memoState.totalPriceMain || 1)) * 100).toFixed(2)}%</span>
            </div>
            <div className="summary-card-dark">
              <span className="memo-label-dark">{t('globalProfitPercent')}</span>
              <MathInput
                value={memoState.globalProfitPercent !== undefined ? memoState.globalProfitPercent : ''}
                onChange={e => updateMemoState('globalProfitPercent', parseMathOrNumber(e.target.value))}
                placeholder="Ex: 0"
                style={{ borderColor: 'var(--primary-color)' }}
              />
            </div>
          </div>

          <div className="table-responsive">
            <table className="memo-dark-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('fishName')}</th>
                  <th>{t('weightKg')}</th>
                  <th>{t('price')}</th>
                  <th>{t('buyRateAuto')}</th>
                  <th>{t('costPercentAuto')}</th>
                  <th>{t('totalBuyPriceAuto')}</th>
                  <th>{t('profitPercent')}</th>
                  <th>{t('saleRateAuto')}</th>
                  <th style={{ minWidth: '130px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      color: '#72be44',
                      background: 'rgba(114, 190, 68, 0.12)',
                      padding: '4px 10px',
                      borderRadius: '14px',
                      border: '1px solid rgba(114, 190, 68, 0.3)',
                      fontSize: '0.82rem',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      <Package size={13} style={{ color: '#72be44' }} />
                      <span>স্টক স্থিতি</span>
                    </span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {memoState.entries.map((entry, index) => {
                  let autoRate = 0;
                  let salePriceAuto = 0;
                  let investment = 0;

                  let hasGlobalProfit = memoState.globalProfitPercent !== undefined && memoState.globalProfitPercent !== '';
                  let currentProfitPercent = hasGlobalProfit
                    ? Number(memoState.globalProfitPercent)
                    : (entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0);

                  if (typeof entry.totalKg === 'number' && typeof entry.totalPrice === 'number' && entry.totalKg > 0) {
                    let weightInKg = entry.weightUnit === 'g' ? entry.totalKg / 1000 : entry.totalKg;
                    if (weightInKg > 0) {
                      autoRate = entry.totalPrice / weightInKg;
                      investment = autoRate + (autoRate * globalCostPercent / 100);
                      salePriceAuto = investment + (investment * currentProfitPercent / 100);
                    }
                  }

                  const isLastRow = index === memoState.entries.length - 1;

                  return (
                    <tr key={entry.id}>
                      <td data-label="#" style={{ textAlign: 'center', opacity: 0.7 }}>{formatNumber(index + 1)}</td>
                      <td data-label={t('fishName')}>
                        <DebouncedInput
                          type="text"
                          placeholder={t('writeHere')}
                          value={entry.name}
                          onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                        />
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
                      <td data-label={t('price')}>
                        <MathInput
                          placeholder="0.00"
                          value={entry.totalPrice}
                          onChange={e => updateEntry(entry.id, 'totalPrice', parseMathOrNumber(e.target.value))}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                        />
                      </td>
                      <td data-label={t('buyRateAuto')}>{autoRate > 0 ? autoRate.toFixed(2) : '0.00'}</td>
                      <td data-label={t('costPercentAuto')}>{autoRate > 0 ? (autoRate * globalCostPercent / 100).toFixed(2) : '0.00'}</td>
                      <td data-label={t('totalBuyPriceAuto')} style={{ fontWeight: '500', color: '#ffb74d' }}>{investment > 0 ? investment.toFixed(2) : '0.00'}</td>
                      <td data-label={t('profitPercent')}>
                        <MathInput
                          className="highlight-input"
                          placeholder="0"
                          value={hasGlobalProfit ? currentProfitPercent : (entry.profitPercent !== undefined ? entry.profitPercent : '')}
                          onChange={e => updateEntry(entry.id, 'profitPercent', parseMathOrNumber(e.target.value))}
                          onAddRow={handleAddRow}
                          isLastRow={isLastRow}
                          disabled={hasGlobalProfit}
                          style={{ width: '80px', opacity: hasGlobalProfit ? 0.6 : 1 }}
                        />
                      </td>
                      <td data-label={t('saleRateAuto')} style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {salePriceAuto > 0 ? salePriceAuto.toFixed(2) : '0.00'}
                      </td>
                      <td data-label="স্টক" style={{ textAlign: 'center', minWidth: '130px', padding: '0.45rem 0.5rem' }}>
                        {(() => {
                          const stockItem = lotStock?.items.find(it => it.serialNo === index + 1 || (entry.name && it.name.trim().toLowerCase() === entry.name.trim().toLowerCase()));
                          if (!stockItem || !entry.name) return (
                            <span style={{ color: '#666', fontSize: '0.85rem' }}>—</span>
                          );

                          const isAvailable = stockItem.remainingKg > 0;
                          const isLow = isAvailable && stockItem.purchasedKg > 0 && (stockItem.remainingKg / stockItem.purchasedKg) <= 0.25;
                          const soldPercent = stockItem.purchasedKg > 0 ? Math.min(100, Math.round((stockItem.soldKg / stockItem.purchasedKg) * 100)) : 0;
                          const remainingPercent = Math.max(0, 100 - soldPercent);

                          const themeColor = !isAvailable ? '#ff5252' : isLow ? '#ff9800' : '#72be44';
                          const themeBorder = !isAvailable ? 'rgba(255, 82, 82, 0.4)' : isLow ? 'rgba(255, 152, 0, 0.4)' : 'rgba(114, 190, 68, 0.4)';
                          const themeBg = !isAvailable 
                            ? 'linear-gradient(135deg, rgba(255, 82, 82, 0.12) 0%, rgba(40, 10, 10, 0.4) 100%)' 
                            : isLow 
                            ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.12) 0%, rgba(35, 20, 10, 0.4) 100%)' 
                            : 'linear-gradient(135deg, rgba(114, 190, 68, 0.15) 0%, rgba(10, 35, 20, 0.4) 100%)';

                          return (
                            <div style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '5px 8px',
                              borderRadius: '10px',
                              background: themeBg,
                              border: `1px solid ${themeBorder}`,
                              minWidth: '105px',
                              boxSizing: 'border-box',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                              transition: 'all 0.2s ease'
                            }}>
                              {/* Main Stock Amount Pill */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                fontSize: '0.86rem',
                                fontWeight: '700',
                                color: themeColor,
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: themeColor,
                                  boxShadow: `0 0 6px ${themeColor}`,
                                  flexShrink: 0
                                }} />
                                <span>{stockItem.remainingKg.toFixed(stockItem.remainingKg % 1 === 0 ? 0 : 1)} kg</span>
                                {isAvailable && (
                                  <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 'normal' }}>
                                    ({remainingPercent}%)
                                  </span>
                                )}
                              </div>

                              {/* Micro Progress Bar & Quick Status */}
                              {stockItem.purchasedKg > 0 && (
                                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                  <div style={{
                                    width: '100%',
                                    height: '4px',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    borderRadius: '2px',
                                    overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${remainingPercent}%`,
                                      height: '100%',
                                      backgroundColor: themeColor,
                                      borderRadius: '2px',
                                      transition: 'width 0.3s ease'
                                    }} />
                                  </div>
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    fontSize: '0.66rem',
                                    color: '#999',
                                    lineHeight: 1
                                  }}>
                                    <span>বিক্রি: {stockItem.soldKg.toFixed(stockItem.soldKg % 1 === 0 ? 0 : 1)}k</span>
                                    <span style={{ color: themeColor, fontWeight: 600 }}>
                                      {!isAvailable ? 'শেষ' : isLow ? 'কম' : 'স্টকে আছে'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td data-label="">
                        <button className="btn-icon delete-btn" onClick={() => handleDeleteRow(entry.id)}>
                          <Trash2 size={20} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '1rem', padding: '0 2rem' }}>
            {hasEditPermission && (
              <button className="add-row-dark-btn" onClick={handleAddRow} data-html2canvas-ignore style={{ margin: 0 }}>
                <Plus size={16} /> {t('addNewRow')}
              </button>
            )}
            <div style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: isPriceMatched ? '#ff4444' : 'var(--primary-color)',
              background: isPriceMatched ? 'rgba(255, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${isPriceMatched ? '#ff4444' : 'rgba(255,255,255,0.1)'}`,
              transition: 'all 0.3s'
            }}>
              Table Total: {tableTotalPrice.toFixed(2)}
            </div>
          </div>

          {/* New Due/Paid Summary */}
          <div className="memo-summary-cards">
             <div className="summary-card-dark" style={{ background: 'rgba(255,255,255,0.02)', flex: '1 1 200px' }}>
              <span className="memo-label-dark">{t('totalBill') || 'মোট হিসাব'}</span>
              <span className="calc-value" style={{ fontSize: '1.2rem' }}>{mainPrice.toFixed(2)}</span>
            </div>
            <div className="summary-card-dark" style={{ borderLeft: '4px solid #72be44', flex: '1 1 200px' }}>
              <span className="memo-label-dark">{t('deposit') || 'জমা'}</span>
              <MathInput
                value={memoState.paidAmount !== undefined ? memoState.paidAmount : ''}
                onChange={e => updateMemoState('paidAmount', parseMathOrNumber(e.target.value))}
                placeholder="0.00"
                style={{ fontWeight: 'bold', background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', textAlign: 'center', width: '100%', outline: 'none' }}
              />
            </div>
            <div className="summary-card-dark" style={{ borderLeft: '4px solid #ff5252', flex: '1 1 200px' }}>
              <span className="memo-label-dark">{t('currentDue') || 'বর্তমান বাকি'}</span>
              <span className="calc-value" style={{ fontSize: '1.2rem', color: (mainPrice - Number(memoState.paidAmount || 0)) > 0 ? '#ff5252' : '#72be44' }}>
                {Math.max(0, mainPrice - Number(memoState.paidAmount || 0)).toFixed(2)}
              </span>
            </div>
            {Number(memoState.paidAmount || 0) > mainPrice && mainPrice > 0 && (
              <div className="summary-card-dark" style={{ borderLeft: '4px solid #00e676', flex: '1 1 200px', background: 'rgba(0, 230, 118, 0.08)' }}>
                <span className="memo-label-dark" style={{ color: '#00e676', fontWeight: 600 }}>
                  {language === 'bn' ? 'অতিরিক্ত জমা (ফেরত):' : 'Excess / Return:'}
                </span>
                <span className="calc-value" style={{ fontSize: '1.2rem', color: '#00e676', fontWeight: 'bold' }}>
                  ৳ {(Number(memoState.paidAmount || 0) - mainPrice).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Real-time Fish Stock Line & Section */}
          <div className="lot-stock-section" style={{
            margin: '1.5rem 2rem',
            padding: '1.4rem',
            background: 'linear-gradient(135deg, rgba(8, 38, 22, 0.85) 0%, rgba(14, 28, 22, 0.95) 100%)',
            borderRadius: '16px',
            border: '1px solid rgba(114, 190, 68, 0.35)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
            color: '#fff'
          }}>
            {/* Header & Metric Cards */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(114, 190, 68, 0.15)',
                  border: '1px solid rgba(114, 190, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#72be44'
                }}>
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>
                    লট স্টক স্থিতি (Fish Stock Overview)
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#888' }}>
                    ক্রয় ও বিক্রয় মেমো থেকে রিয়েল-টাইম সমন্বিত স্টক হিসাব
                  </span>
                </div>
              </div>

              {/* Top Stock Metric Cards */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', minWidth: '85px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase' }}>মাছের পদ</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff' }}>{lotStock?.items.length || 0} টি</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', minWidth: '95px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase' }}>মোট ক্রয়</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff' }}>{(lotStock?.totalPurchasedKg || 0).toFixed(1)} kg</div>
                </div>
                <div style={{ background: 'rgba(255, 152, 0, 0.1)', padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(255, 152, 0, 0.3)', textAlign: 'center', minWidth: '95px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#ff9800', textTransform: 'uppercase' }}>মোট বিক্রয়</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ffb74d' }}>{(lotStock?.totalSoldKg || 0).toFixed(1)} kg</div>
                </div>
                <div style={{ background: 'linear-gradient(135deg, rgba(114, 190, 68, 0.2) 0%, rgba(10, 45, 25, 0.4) 100%)', padding: '6px 16px', borderRadius: '10px', border: '1px solid rgba(114, 190, 68, 0.5)', textAlign: 'center', minWidth: '110px', boxShadow: '0 2px 10px rgba(114, 190, 68, 0.15)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#72be44', textTransform: 'uppercase', fontWeight: 600 }}>অবশিষ্ট স্টক</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#72be44' }}>{(lotStock?.totalRemainingKg || 0).toFixed(1)} kg</div>
                </div>
              </div>
            </div>

            {/* List of fish stock items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {lotStock?.items && lotStock.items.length > 0 ? (
                lotStock.items.map(item => {
                  const soldPercent = item.purchasedKg > 0 ? Math.min(100, Math.round((item.soldKg / item.purchasedKg) * 100)) : 0;
                  const remainingPercent = Math.max(0, 100 - soldPercent);

                  let badgeColor = '#72be44';
                  let badgeBg = 'rgba(114, 190, 68, 0.15)';
                  let badgeText = 'স্টকে আছে';
                  let StatusIcon = CheckCircle2;

                  if (item.status === 'out_of_stock') {
                    badgeColor = '#ff5252';
                    badgeBg = 'rgba(255, 82, 82, 0.15)';
                    badgeText = 'স্টক শেষ';
                    StatusIcon = XCircle;
                  } else if (item.status === 'low_stock') {
                    badgeColor = '#ff9800';
                    badgeBg = 'rgba(255, 152, 0, 0.15)';
                    badgeText = 'কম স্টক';
                    StatusIcon = AlertTriangle;
                  }

                  return (
                    <div key={item.id} style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '0.75rem 1.1rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      gap: '0.8rem',
                      transition: 'all 0.2s ease'
                    }}>
                      {/* Fish Name & Serial */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: '160px' }}>
                        <span style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#aaa',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}>
                          #{item.serialNo}
                        </span>
                        <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>
                          {item.name}
                        </span>
                      </div>

                      {/* Stock Figures (Purchase, Sold, Remaining) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', fontSize: '0.86rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#888' }}>কেনা:</span>
                          <span style={{ color: '#fff', fontWeight: 600 }}>{item.purchasedKg.toFixed(1)} kg</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#888' }}>বিক্রি:</span>
                          <span style={{ color: '#ffb74d', fontWeight: 600 }}>{item.soldKg.toFixed(1)} kg</span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          background: item.remainingKg > 0 ? 'rgba(114, 190, 68, 0.14)' : 'rgba(255, 82, 82, 0.14)',
                          border: `1px solid ${item.remainingKg > 0 ? 'rgba(114, 190, 68, 0.3)' : 'rgba(255, 82, 82, 0.3)'}`
                        }}>
                          <span style={{ color: item.remainingKg > 0 ? '#aaa' : '#ff5252', fontSize: '0.8rem' }}>অবশিষ্ট:</span>
                          <span style={{ color: item.remainingKg > 0 ? '#72be44' : '#ff5252', fontWeight: 'bold' }}>
                            {item.remainingKg.toFixed(1)} kg
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar & Status Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', minWidth: '180px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${remainingPercent}%`,
                              height: '100%',
                              background: badgeColor,
                              transition: 'width 0.3s'
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#777' }}>
                            <span>বাকি: {remainingPercent}%</span>
                            <span>বিক্রি: {soldPercent}%</span>
                          </div>
                        </div>

                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          color: badgeColor,
                          background: badgeBg,
                          border: `1px solid ${badgeColor}33`,
                          whiteSpace: 'nowrap'
                        }}>
                          <StatusIcon size={12} />
                          {badgeText}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem' }}>
                  এই লটে এখনো কোনো মাছের বিবরণ যোগ করা হয়নি
                </div>
              )}
            </div>
          </div>

          {/* Action buttons removed from here to be placed at the bottom */}

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

      {showDueModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="btn-icon close-btn" onClick={() => setShowDueModal(false)}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1rem', color: '#ff9800' }}>Add to Purchase Due</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Deposit/Paid Amount (৳)</label>
              <MathInput 
                 
                className="supplier-input" 
                style={{ width: '100%', padding: '0.8rem', fontSize: '1.2rem', textAlign: 'center' }}
                value={memoState.paidAmount} 
                onChange={e => updateMemoState('paidAmount', e.target.value ? Number(e.target.value) : '')}
                placeholder="0.00"
              />
            </div>
            
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '1rem', marginTop: '1rem', fontSize: '1.1rem' }}
              onClick={processMarkDue}
            >
              Confirm Due
            </button>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>লটের পাসওয়ার্ড সেট করুন</h2>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>পাসওয়ার্ড (ঐচ্ছিক)</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন..."
                className="modal-input"
                autoFocus
              />
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => {
                localStorage.removeItem(`lot_password_${lotNumber}`);
                setShowPasswordModal(false);
              }} style={{ flex: 1 }}>
                রিমুভ করুন
              </button>
              <button className="btn btn-primary" onClick={() => {
                if (newPassword.trim()) {
                  localStorage.setItem(`lot_password_${lotNumber}`, newPassword.trim());
                } else {
                  localStorage.removeItem(`lot_password_${lotNumber}`);
                }
                setShowPasswordModal(false);
              }} style={{ flex: 1 }}>
                সেভ করুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MemoScreen;

