import { MemoSignatureBox } from './MemoSignatureBox';
import { MathInput, DebouncedInput, parseMathOrNumber } from './MathInput';
import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { Share2, Download, Plus, Trash2, Phone, Undo, Redo, MessageCircle, Mail, ChevronLeft, Lock, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CallMenu from './CallMenu';


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
  const [showSupplierCallMenu, setShowSupplierCallMenu] = useState(false);
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');



  const processMarkDue = () => {
    const dueId = Date.now().toString();
    const newDueData = {
      id: dueId,
      memoState: { ...memoState, status: 'due' },
      date: today,
      name: memoState.supplierName,
      mobile: memoState.supplierPhone,
      lotNumber: lotNumber,
      deposit: memoState.paidAmount || 0,
      type: 'purchase',
      entries: memoState.entries.map(e => {
        let salePriceAuto = 0;
        let currentProfitPercent = e.profitPercent !== undefined && e.profitPercent !== '' ? Number(e.profitPercent) : (memoState.globalProfitPercent ? Number(memoState.globalProfitPercent) : 0);
        let buyRateNum = Number(e.totalPrice) || 0;
        if (buyRateNum > 0) {
          salePriceAuto = buyRateNum + (buyRateNum * currentProfitPercent / 100);
        }
        return {
          ...e,
          buyRate: e.totalPrice, // buyRate is what we bought it for
          manualSaleRate: salePriceAuto
        };
      })
    };
    
    const existingDuesStr = localStorage.getItem('dues_purchase');
    const existingDues = existingDuesStr ? JSON.parse(existingDuesStr) : [];
    localStorage.setItem('dues_purchase', JSON.stringify([...existingDues, dueId]));
    
    localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(newDueData));
    
    alert('Added to Purchase Due Account!');
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
      setMemoState(prev => ({ ...prev, updatedAt: today }));
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
    window.dispatchEvent(new Event('storage'));
    setSaveStatus('Saving...');
    const timer = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(timer);
  }, [memoState, lotNumber, today]);

  const globalCostPercent = (typeof memoState.totalPriceMain === 'number' && typeof memoState.totalCostMain === 'number' && memoState.totalPriceMain > 0)
    ? (memoState.totalCostMain / memoState.totalPriceMain) * 100
    : 0;

  const tableTotalPrice = memoState.entries.reduce((sum, entry) => {
    return sum + (typeof entry.totalPrice === 'number' ? entry.totalPrice : 0);
  }, 0);

  const mainPrice = Number(memoState.totalPriceMain || 0);
  const isPriceMatched = tableTotalPrice > 0 && tableTotalPrice >= mainPrice;

  const updateMemoState = (field: keyof MemoState, value: any) => {
    setMemoState(prev => ({ ...prev, [field]: value }));
  };

  const updateEntry = (id: string, field: keyof FishEntry, value: any) => {
    setMemoState(prev => ({
      ...prev,
      entries: prev.entries.map(e => e.id === id ? { ...e, [field]: value } : e)
    }));
  };

  const handleAddRow = () => {
    setMemoState(prev => ({
      ...prev,
      entries: [...prev.entries, { id: Date.now().toString(), name: '', totalKg: '', totalPrice: '', profitPercent: '' }]
    }));
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
        pdf.save(`Memo_Lot_${lotNumber}.pdf`);
      } catch (err) {
        console.error('Failed to download PDF', err);
      }
    }
  };

  const shareUrl = window.location.href;
  const shareText = `Check out this Purchase Memo (Lot: ${lotNumber})`;



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
            <button className="btn-icon action-fb" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)} title="Share on Facebook">
              <Share2 size={24} />
            </button>
            <button className="btn-icon action-wa" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`)} title="Share on WhatsApp">
              <MessageCircle size={24} />
            </button>
            <button className="btn-icon action-mail" onClick={() => window.open(`mailto:?subject=Purchase Memo&body=${encodeURIComponent(shareText + ' ' + shareUrl)}`)} title="Share via Email">
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
              <h1>{t('appTitle')}</h1>
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
            <div className="meta-item text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark">{t('date')}</span>
                <DebouncedInput
                  type="text"
                  value={memoState.createdAt || today}
                  onChange={e => updateMemoState('createdAt', e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', width: '120px', marginLeft: 10, textAlign: 'center', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none' }}
                />
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

                  return (
                    <tr key={entry.id}>
                      <td data-label="#" style={{ textAlign: 'center', opacity: 0.7 }}>{formatNumber(index + 1)}</td>
                      <td data-label={t('fishName')}>
                        <DebouncedInput
                          type="text"
                          placeholder={t('writeHere')}
                          value={entry.name}
                          onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                        />
                      </td>
                      <td data-label={t('weightKg')}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <MathInput
                            placeholder="0.00"
                            value={entry.totalKg}
                            onChange={e => updateEntry(entry.id, 'totalKg', parseMathOrNumber(e.target.value))}
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
                          disabled={hasGlobalProfit}
                          style={{ width: '80px', opacity: hasGlobalProfit ? 0.6 : 1 }}
                        />
                      </td>
                      <td data-label={t('saleRateAuto')} style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {salePriceAuto > 0 ? salePriceAuto.toFixed(2) : '0.00'}
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
            <button className="add-row-dark-btn" onClick={handleAddRow} data-html2canvas-ignore style={{ margin: 0 }}>
              <Plus size={16} /> {t('addNewRow')}
            </button>
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
                {(mainPrice - Number(memoState.paidAmount || 0)).toFixed(2)}
              </span>
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

