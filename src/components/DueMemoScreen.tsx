import { MemoSignatureBox } from './MemoSignatureBox';
import { MathInput, parseMathOrNumber } from './MathInput';
import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Phone, Plus, Trash2, Share2, MessageCircle, Mail, Download, Undo, Redo } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import CallMenu from './CallMenu';


import MemoScreen from './MemoScreen';

interface DueMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType?: 'regular' | 'permanent' | 'purchase';
  dueId: string;
  isPaid?: boolean;
}

interface DueEntry {
  id: string;
  serialNo?: string | number;
  name: string;
  totalKg: number | '';
  weightUnit?: 'kg' | 'g';
  buyRate: number | '';
  profitPercent?: number | '';
  manualSaleRate?: number | '';
}

interface AutoMessageConfig {
  scheduledFor: number;
  type: 'whatsapp' | 'sms';
  status: 'pending' | 'sent' | 'failed';
}

interface DueMemoState {
  name: string;
  address: string;
  mobile?: string;
  date?: string;
  updatedAt?: string;
  lotNumber?: string;
  deposit?: number | '';
  paidDate?: number;
  receiverSignature?: string;
  sellerSignature?: string;
  entries: DueEntry[];
  memoState?: any;
  autoMessage?: AutoMessageConfig;
}

const DueMemoScreen: React.FC<DueMemoScreenProps> = ({ onNavigate, dueType, dueId, isPaid = false }) => {
  if (dueType === 'purchase' || dueId.startsWith('purchase_lot_')) {
    let lotNum = 1;
    if (dueId.startsWith('purchase_lot_')) {
      lotNum = parseInt(dueId.replace('purchase_lot_', ''), 10) || 1;
    } else {
      const saved = localStorage.getItem(`due_memo_${dueId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.lotNumber) lotNum = parseInt(parsed.lotNumber, 10) || 1;
        } catch (e) {}
      }
    }
    return (
      <MemoScreen 
        onNavigate={onNavigate} 
        lotNumber={lotNum}
        onBack={() => onNavigate(isPaid ? 'paid-due-list' : 'due-purchase-list')}
      />
    );
  }
  const { t, language, formatNumber } = useLanguage();
  const memoRef = useRef<HTMLDivElement>(null);
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getInitialState = (): DueMemoState => {
    const hasValidEntries = (str: string | null): boolean => {
      if (!str) return false;
      try {
        const parsed = JSON.parse(str);
        const entries = parsed.entries || (parsed.memoState && parsed.memoState.entries);
        if (entries && Array.isArray(entries) && entries.length > 0) {
          return entries.some((e: any) => 
            (e.name && e.name.trim() !== '') || 
            (e.totalKg !== undefined && e.totalKg !== '' && Number(e.totalKg) > 0) || 
            (e.buyRate !== undefined && e.buyRate !== '' && Number(e.buyRate) > 0) ||
            (e.manualSaleRate !== undefined && e.manualSaleRate !== '' && Number(e.manualSaleRate) > 0)
          );
        }
      } catch(e) {}
      return false;
    };

    const keysToTry = [
      `due_memo_${dueId}`,
      `sales_memo_lot_unassigned_memo_${dueId}`,
    ];
    for (let i = 1; i <= 50; i++) {
      keysToTry.push(`sales_memo_lot_${i}_memo_${dueId}`);
    }

    let savedKey = keysToTry.find(k => hasValidEntries(localStorage.getItem(k)));
    let saved = savedKey ? localStorage.getItem(savedKey) : null;
    if (!saved) {
      saved = localStorage.getItem(`due_memo_${dueId}`);
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.entries) {
           parsed.entries = [{ id: Date.now().toString(), statement: '', amount: '' }];
        }
        if (!parsed.address) parsed.address = '';
        if (!parsed.date) parsed.date = today;
        return { ...parsed, receiverSignature: parsed.receiverSignature || '', sellerSignature: parsed.sellerSignature || localStorage.getItem('default_seller_signature') || '' };
      } catch (e) {
        console.error('Failed to parse saved due memo');
      }
    }
    return {
      name: '',
      address: '',
      mobile: '',
      lotNumber: '',
      deposit: '',
      date: today,
      entries: [{ id: Date.now().toString(), serialNo: '', name: '', totalKg: '', weightUnit: 'kg', buyRate: '', profitPercent: 20 }]
    };
  };

  const [memoState, setMemoState, undo, redo, canUndo, canRedo] = useHistory<DueMemoState>(getInitialState(), `due_memo_${dueId}`);
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showCustomerCallMenu, setShowCustomerCallMenu] = useState(false);
  const [showAutoMessageModal, setShowAutoMessageModal] = useState(false);
  const [msgTimeframe, setMsgTimeframe] = useState<'24h' | '7d' | 'custom'>('7d');
  const [msgCustomDate, setMsgCustomDate] = useState<string>('');
  const [msgType, setMsgType] = useState<'whatsapp' | 'sms'>('whatsapp');

  const isMounted = useRef(false);

  // Listen for storage changes from Realtime sync
  useEffect(() => {
    const handleStorage = () => {
      const defaultSig = localStorage.getItem('default_seller_signature') || '';
      const saved = localStorage.getItem(`due_memo_${dueId}`);
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
  }, [dueId]);

  
  const handleSaveReceiverSig = (dataUrl: string) => {
    const key = `due_memo_${dueId}`;
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

    const key = `due_memo_${dueId}`;
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
      const key = `due_memo_${dueId}`;
      const finalState = { ...memoState };
      localStorage.setItem(key, JSON.stringify(finalState));
    } catch(e) {}
    onNavigate(isPaid ? 'paid-due-list' : ((dueType as string) === 'purchase' ? 'due-purchase-list' : 'due-list'));
  };

  // Auto-save
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (memoState.date && memoState.date !== today && memoState.updatedAt !== today) {
      setMemoState(prev => ({ ...prev, updatedAt: today }));
      return;
    }

    localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(memoState));
    
    if (!isPaid) {
      // Add to dues list if it's a new due and not paid
      const existingDuesStr = localStorage.getItem(`dues_${dueType}`);
      const existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
      if (!existingDues.includes(dueId)) {
          localStorage.setItem(`dues_${dueType}`, JSON.stringify([...existingDues, dueId]));
      }
    }
    
    setSaveStatus('Saving...');
    const timer = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(timer);
  }, [memoState, dueId, dueType]);

  const updateMemoState = (field: keyof DueMemoState, value: any) => {
    setMemoState(prev => ({ ...prev, [field]: value }));
  };

  const updateEntry = (id: string, field: keyof DueEntry, value: any) => {
    setMemoState(prev => {
      let updatedEntries = prev.entries.map(e => e.id === id ? { ...e, [field]: value } : e);
      
      // Auto-fill logic by name
      if (field === 'name' && prev.lotNumber) {
        const lotMemoStr = localStorage.getItem(`memo_lot_${prev.lotNumber}`);
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
                 updatedEntries = updatedEntries.map(e => e.id === id ? { ...e, buyRate: Number(investmentRate.toFixed(2)), serialNo: foundIndex + 1 } : e);
               }
            }
          } catch (err) {}
        }
      }
      
      // Auto-fill logic by serialNo
      if (field === 'serialNo' && prev.lotNumber && value) {
        const lotMemoStr = localStorage.getItem(`memo_lot_${prev.lotNumber}`);
        if (lotMemoStr) {
          try {
            const lotMemo = JSON.parse(lotMemoStr);
            const index = Number(value) - 1;
            if (index >= 0 && index < lotMemo.entries.length) {
               const foundEntry = lotMemo.entries[index];
               if (foundEntry.name && foundEntry.totalKg && foundEntry.totalPrice) {
                 const autoRate = foundEntry.totalPrice / foundEntry.totalKg;
                 let costPercent = 0;
                 if (lotMemo.totalPriceMain && lotMemo.totalCostMain) {
                     costPercent = (Number(lotMemo.totalCostMain) / Number(lotMemo.totalPriceMain)) * 100;
                 }
                 const investmentRate = autoRate + (autoRate * costPercent / 100);
                 updatedEntries = updatedEntries.map(e => e.id === id ? { ...e, name: foundEntry.name, buyRate: Number(investmentRate.toFixed(2)) } : e);
               }
            }
          } catch (err) {}
        }
      }
      
      return { ...prev, entries: updatedEntries };
    });
  };

  const handleAddRow = () => {
    setMemoState(prev => ({
      ...prev,
      entries: [...prev.entries, { id: Date.now().toString(), serialNo: '', name: '', totalKg: '', buyRate: '', profitPercent: 20 }]
    }));
  };

  const handleDeleteRow = (id: string) => {
    setMemoState(prev => ({
      ...prev,
      entries: prev.entries.filter(e => e.id !== id)
    }));
  };

  const totalPrice = memoState.entries.reduce((sum, entry) => {
      let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
      let buyRateNum = Number(entry.buyRate) || 0;
      
      let calculatedSalePriceAuto = 0;
      if (buyRateNum > 0) {
        calculatedSalePriceAuto = buyRateNum + (buyRateNum * currentProfitPercent / 100);
      }
      
      let salePriceAuto = 0;
      if (entry.manualSaleRate !== undefined && entry.manualSaleRate !== '') {
        let manualRateNum = Number(entry.manualSaleRate);
        salePriceAuto = manualRateNum + (manualRateNum * currentProfitPercent / 100);
      } else {
        salePriceAuto = calculatedSalePriceAuto;
      }
      
      let weightInKg = 0;
      let totalKgNum = Number(entry.totalKg) || 0;
      if (totalKgNum > 0) {
        weightInKg = entry.weightUnit === 'g' ? totalKgNum / 1000 : totalKgNum;
      }
      
      if (weightInKg > 0 && salePriceAuto > 0) {
        return sum + (salePriceAuto * weightInKg);
      }
      return sum;
  }, 0);
  
  const totalDeposit = typeof memoState.deposit === 'number' ? memoState.deposit : 0;
  const totalDueAmount = totalPrice - totalDeposit;



  const handleSetAutoMessage = () => {
    let timestamp = 0;
    if (msgTimeframe === '24h') {
      timestamp = Date.now() + (24 * 60 * 60 * 1000);
    } else if (msgTimeframe === '7d') {
      timestamp = Date.now() + (7 * 24 * 60 * 60 * 1000);
    } else if (msgTimeframe === 'custom' && msgCustomDate) {
      timestamp = new Date(msgCustomDate).getTime();
    } else {
      alert('Please select a valid date');
      return;
    }

    const updated = {
      ...memoState,
      autoMessage: {
        scheduledFor: timestamp,
        type: msgType,
        status: 'pending' as const
      }
    };
    setMemoState(updated);
    setShowAutoMessageModal(false);
    alert('Auto Message Scheduled Successfully!');
  };

  const clearAutoMessage = () => {
    const updated = { ...memoState };
    delete updated.autoMessage;
    setMemoState(updated);
  };


  const handleDownload = async () => {
    if (memoRef.current) {
      try {
        const canvas = await html2canvas(memoRef.current, { scale: 2, backgroundColor: '#092115' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Due_Memo_${dueType}_${dueId}.pdf`);
      } catch (err) {
        console.error('Failed to download PDF', err);
      }
    }
  };

  const shareUrl = window.location.href;
  const shareText = `Check out this Due Memo (${dueType === 'regular' ? 'Regular' : dueType === 'permanent' ? 'Permanent' : 'Purchase'} Due)`;

  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar" data-html2canvas-ignore>
        <button className="btn-icon" onClick={handleBack}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{(dueType as string) === 'purchase' ? t('purchaseDue') : (dueType === 'regular' ? t('regularDue') : t('permanentDue'))} Memo</h2>
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
            <button className="btn-icon action-mail" onClick={() => window.open(`mailto:?subject=Due Memo&body=${encodeURIComponent(shareText + ' ' + shareUrl)}`)} title="Share via Email">
              <Mail size={24} />
            </button>
          </div>

          <button className="btn-icon action-download" onClick={handleDownload} title="Download PDF">
            <Download size={24} />
          </button>
        </div>
      </div>

      <div className="memo-wrapper">
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
            <h2 style={{color: '#ff9800'}}>Due Account - {dueType === 'regular' ? t('regularDue') : t('permanentDue')}</h2>
          </div>

          <div className="memo-top-meta" style={{ alignItems: 'flex-start' }}>
            <div className="meta-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('nameLabel')} </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  value={memoState.name} 
                  onChange={e => updateMemoState('name', e.target.value)}
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
                    value={memoState.mobile || ''} 
                    onChange={e => updateMemoState('mobile', e.target.value)}
                    placeholder="Enter Mobile"
                    style={{ flex: 1 }}
                  />
                  <div style={{ position: 'relative' }}>
                    <Phone 
                      size={18} 
                      style={{ cursor: 'pointer', color: memoState.mobile ? '#72be44' : '#aaa', marginLeft: '8px' }} 
                      onClick={() => {
                        if (memoState.mobile) setShowCustomerCallMenu(!showCustomerCallMenu);
                        else alert('Please enter a mobile number first.');
                      }} 
                      data-html2canvas-ignore
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
            <div className="meta-item right-align" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="memo-label-dark">{t('dateLabel')}: </span>
                  <input
                    type="text"
                    value={memoState.date || today}
                    onChange={e => updateMemoState('date', e.target.value)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', width: '120px', marginLeft: 10, textAlign: 'center', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
                {memoState.updatedAt && (
                  <div style={{ fontSize: '0.75rem', color: '#ffb74d', marginTop: '2px' }}>
                    পরিবর্তিত তারিখ: {memoState.updatedAt}
                  </div>
                )}
              </div>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>Lot Number: </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  style={{ width: '100%', textAlign: 'center' }}
                  value={memoState.lotNumber || ''} 
                  onChange={e => updateMemoState('lotNumber', e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="memo-dark-table">
              <thead>
                <tr>
                  <th>{t('slNo')}</th>
                  <th>{t('fishName') || 'Fish Name'}</th>
                  <th>{t('weightKg') || 'Weight/Kg'}</th>
                  <th>{t('price') || 'Price'}</th>
                  <th>{t('profitPercent') || 'Profit %'}</th>
                  <th>{t('saleRateAuto') || 'Sale Rate (Auto)'}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {memoState.entries.map((entry) => {
                  let calculatedSalePriceAuto = 0;
                  let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 0;
                  let buyRateNum = Number(entry.buyRate) || 0;
                  
                  if (buyRateNum > 0) {
                    calculatedSalePriceAuto = buyRateNum + (buyRateNum * currentProfitPercent / 100);
                  }

                  return (
                    <tr key={entry.id}>
                      <td data-label="Sl No.">
                        <input 
                          type="text" 
                          placeholder="1"
                          value={entry.serialNo || ''}
                          onChange={e => updateEntry(entry.id, 'serialNo', e.target.value)}
                          style={{ width: '40px', textAlign: 'center' }}
                        />
                      </td>
                      <td data-label={t('fishName') || 'Fish Name'}>
                        <input 
                          type="text" 
                          placeholder={t('writeHere') || 'Write here...'}
                          value={entry.name || ''}
                          onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                          onClick={e => { if (e.detail === 3) handleAddRow(); }}
                        />
                      </td>
                      <td data-label={t('weightKg') || 'Weight/Kg'}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <MathInput 
                            placeholder="0.00" 
                            value={entry.totalKg}
                            onChange={e => updateEntry(entry.id, 'totalKg', parseMathOrNumber(e.target.value))}
                            onTripleClick={handleAddRow}
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
                      <td data-label={t('price') || 'Price'}>
                        <MathInput 
                          placeholder="0.00" 
                          value={entry.buyRate}
                          onChange={e => updateEntry(entry.id, 'buyRate', parseMathOrNumber(e.target.value))}
                          onTripleClick={handleAddRow}
                        />
                      </td>
                      <td data-label={t('profitPercent') || 'Profit %'}>
                        <MathInput 
                          className="highlight-input"
                          placeholder="20" 
                          value={entry.profitPercent !== undefined ? entry.profitPercent : 20}
                          onChange={e => updateEntry(entry.id, 'profitPercent', parseMathOrNumber(e.target.value))}
                          onTripleClick={handleAddRow}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td data-label={t('saleRateAuto') || 'Sale Rate (Auto)'} style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        <MathInput 
                          placeholder="0.00"
                          value={entry.manualSaleRate !== undefined ? entry.manualSaleRate : (calculatedSalePriceAuto > 0 ? calculatedSalePriceAuto.toFixed(2) : '')}
                          onChange={e => updateEntry(entry.id, 'manualSaleRate', parseMathOrNumber(e.target.value))}
                          onTripleClick={handleAddRow}
                          style={{ fontWeight: '500', color: 'var(--primary-color)' }}
                        />
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
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', fontSize: '1.1rem' }}>
              <div>
                <span style={{ display: 'inline-block', width: '120px' }}>Total Price:</span> 
                <span style={{ fontWeight: 'bold' }}>{formatNumber(totalPrice.toFixed(2))}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'inline-block', width: '120px' }}>Deposit (Jama):</span> 
                <MathInput 
                   
                  value={memoState.deposit} 
                  onChange={e => updateMemoState('deposit', parseMathOrNumber(e.target.value))}
                  placeholder="0.00"
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '5px', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}
                />
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '120px' }}>{t('totalDue')}</span> 
                  <span style={{ color: '#ff9800' }}>{totalDueAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {!isPaid && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem', paddingRight: '2rem' }}>
              {memoState.autoMessage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid #ff9800', padding: '0.5rem 1rem', borderRadius: '8px' }}>
                  <div style={{ color: '#ff9800', fontSize: '0.9rem' }}>
                    Auto Message ({memoState.autoMessage.type}): <br/> 
                    {new Date(memoState.autoMessage.scheduledFor).toLocaleDateString()}
                  </div>
                  <button className="btn-icon delete-btn" onClick={clearAutoMessage} style={{ margin: 0 }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <button 
                  className="btn-primary"  
                  style={{ background: 'var(--primary-color)', padding: '0.8rem 1.5rem', fontSize: '1rem', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer' }} 
                  onClick={() => setShowAutoMessageModal(true)}
                  data-html2canvas-ignore
                >
                  Set Auto Message
                </button>
              )}
            </div>
          )}

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

      {showAutoMessageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', color: '#fff', textAlign: 'center', minWidth: '300px' }}>
            <h3>Setup Auto Message</h3>
            
            <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Select Timeframe:</label>
              <select 
                className="supplier-input" 
                style={{ width: '100%', padding: '0.5rem', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                value={msgTimeframe}
                onChange={e => setMsgTimeframe(e.target.value as any)}
              >
                <option value="24h">After 24 Hours</option>
                <option value="7d">After 7 Days</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            {msgTimeframe === 'custom' && (
              <div style={{ marginTop: '1rem', textAlign: 'left' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Select Date:</label>
                <input 
                  type="date" 
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.5rem', background: '#222', color: '#fff', border: '1px solid #444', borderRadius: '4px' }}
                  value={msgCustomDate}
                  onChange={e => setMsgCustomDate(e.target.value)}
                />
              </div>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Message Type:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={msgType === 'whatsapp'} onChange={() => setMsgType('whatsapp')} /> WhatsApp
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="radio" checked={msgType === 'sms'} onChange={() => setMsgType('sms')} /> SMS
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              <button className="btn-primary" onClick={handleSetAutoMessage} style={{ background: 'var(--primary-color)' }}>Confirm</button>
              <button className="btn-icon" onClick={() => setShowAutoMessageModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DueMemoScreen;





