import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { ArrowLeft, Save, Share2, Download, Printer, Plus, Trash2, Phone, X, Search } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import CallMenu from './CallMenu';

interface SalesMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number | null;
  memoId: string;
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
  updatedAt?: string;
  entries: FishEntry[];
}

const SalesMemoScreen: React.FC<SalesMemoScreenProps> = ({ onNavigate, lotNumber, memoId }) => {
  const { t, language } = useLanguage();
  const memoRef = useRef<HTMLDivElement>(null);
  const sigPadReceiver = useRef<SignatureCanvas>(null);
  const sigPadSeller = useRef<SignatureCanvas>(null);
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getInitialState = (): MemoState => {
    const saved = localStorage.getItem(`sales_memo_lot_${lotNumber}_memo_${memoId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.createdAt) parsed.createdAt = today;
        return {
          customerName: parsed.customerName || parsed.supplierName || '',
          address: parsed.address || '',
          mobile: parsed.mobile || '',
          lotNumberInput: parsed.lotNumberInput || (lotNumber ? lotNumber.toString() : ''),
          paidAmount: parsed.paidAmount || '',
          customerType: parsed.customerType || '',
          status: parsed.status || 'draft',
          createdAt: parsed.createdAt || today,
          updatedAt: parsed.updatedAt,
          entries: parsed.entries || [{ id: Date.now().toString(), name: '', totalKg: '', profitPercent: 20 }]
        };
      } catch (e) {
        console.error('Failed to parse saved memo');
      }
    }
    return {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: lotNumber ? lotNumber.toString() : '',
      paidAmount: '',
      customerType: '',
      status: 'draft',
      createdAt: today,
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', profitPercent: 20 }]
    };
  };

  const [memoState, setMemoState, undo, canUndo] = useHistory<MemoState>(getInitialState());
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showCustomerCallMenu, setShowCustomerCallMenu] = useState(false);

  const isMounted = useRef(false);

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

    // Calculate due amount for auto-sync
    let grandTotal = 0;
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
        grandTotal += weightInKg * saleRate;
      }
    });

    const dueAmount = grandTotal - Number(memoState.paidAmount || 0);
    let currentStatus = memoState.status || 'draft';

    if (memoState.customerType) {
      if (dueAmount > 0) {
        currentStatus = 'due';
      } else if (grandTotal > 0 && dueAmount <= 0) {
        currentStatus = 'paid';
      }
    }

    if (memoState.status !== currentStatus) {
      setMemoState(prev => ({ ...prev, status: currentStatus }));
      return;
    }

    // Sync to due accounts if customer type is selected
    if (memoState.customerType) {
      const type = memoState.customerType;
      
      const newDueData = {
        id: memoId,
        memoState: memoState,
        date: memoState.createdAt || today,
        name: memoState.customerName,
        address: memoState.address,
        mobile: memoState.mobile,
        lotNumber: memoState.lotNumberInput,
        deposit: memoState.paidAmount,
        type: type,
        entries: memoState.entries.map((e, i) => ({
          id: e.id,
          serialNo: (i+1).toString(),
          name: e.name,
          totalKg: e.totalKg,
          weightUnit: e.weightUnit,
          buyRate: e.buyRate || '',
          profitPercent: e.profitPercent,
          manualSaleRate: e.manualSaleRate
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

        // Remove from paid if it was there
        const existingPaidStr = localStorage.getItem(`paid_dues_${type}`);
        let existingPaid: string[] = existingPaidStr ? JSON.parse(existingPaidStr) : [];
        if (existingPaid.includes(memoId)) {
          existingPaid = existingPaid.filter(id => id !== memoId);
          localStorage.setItem(`paid_dues_${type}`, JSON.stringify(existingPaid));
        }
      } else if (currentStatus === 'paid') {
        localStorage.setItem(`due_memo_${memoId}`, JSON.stringify({ ...newDueData, paidDate: Date.now() }));
        
        const existingPaidStr = localStorage.getItem(`paid_dues_${type}`);
        let existingPaid: string[] = existingPaidStr ? JSON.parse(existingPaidStr) : [];
        if (!existingPaid.includes(memoId)) {
          existingPaid.push(memoId);
          localStorage.setItem(`paid_dues_${type}`, JSON.stringify(existingPaid));
        }

        // Remove from dues if it was there
        const existingDuesStr = localStorage.getItem(`dues_${type}`);
        let existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
        if (existingDues.includes(memoId)) {
          existingDues = existingDues.filter(id => id !== memoId);
          localStorage.setItem(`dues_${type}`, JSON.stringify(existingDues));
        }
      }
    }

    localStorage.setItem(`sales_memo_lot_${lotNumber}_memo_${memoId}`, JSON.stringify(memoState));
    setSaveStatus('Saving...');
    const timer = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(timer);
  }, [memoState, lotNumber, memoId]);



  const updateMemoState = (field: keyof MemoState, value: any) => {
    setMemoState(prev => ({ ...prev, [field]: value }));
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
      if (field === 'serialNo' && prev.lotNumberInput && value) {
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
      entries: [...prev.entries, { id: Date.now().toString(), name: '', totalKg: '', profitPercent: 20 }]
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
        pdf.save(`Sales_Memo_Lot_${lotNumber}.pdf`);
      } catch (err) {
        console.error('Failed to download PDF', err);
      }
    }
  };

  const shareUrl = window.location.href;
  const shareText = `Check out this Sales Memo (Lot: ${lotNumber})`;



  let grandTotal = 0;
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
      grandTotal += weightInKg * saleRate;
    }
  });

  const dueAmount = grandTotal - Number(memoState.paidAmount || 0);

  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar" data-html2canvas-ignore>
        <button className="btn-icon" onClick={() => onNavigate('sales-memo-list')}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{t('salesMemo')}</h2>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'Saved' ? '#72be44' : '#fff', transition: 'color 0.3s' }}>
            {saveStatus === 'Saved' ? '✔ All changes saved' : 'Saving...'}
          </span>
        </div>
        
        <div className="header-actions">
          <button className="btn-icon action-undo" onClick={undo} disabled={!canUndo} title="Undo">
            <Undo size={24} />
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
              <h1>{t('appTitle')}</h1>
            </div>
          </div>

          <div className="memo-dark-title">
            <h2>{t('salesAccount')}</h2>
          </div>

          <div className="memo-top-meta" style={{ alignItems: 'flex-start' }}>
            <div className="meta-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>Name: </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  value={memoState.customerName} 
                  onChange={e => updateMemoState('customerName', e.target.value)}
                  placeholder="Enter Name"
                />
              </div>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>Address: </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  value={memoState.address} 
                  onChange={e => updateMemoState('address', e.target.value)}
                  placeholder="Enter Address"
                />
              </div>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>Mobile: </span>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="memo-label-dark">{t('date')}: </span>
                  <input
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.9rem' }}>Lot No:</span>
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
                <span className="memo-label-dark" style={{ fontSize: '0.9rem' }}>Type:</span>
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
                  <option value="" style={{ color: '#000', background: '#fff' }}>Select Type...</option>
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
                  <th style={{ width: '60px' }}>Sl No.</th>
                  <th>{t('fishName')}</th>
                  <th>{t('weightKg')}</th>
                  <th>Sale Rate</th>
                  <th data-html2canvas-ignore>{t('profitPercent')}</th>
                  <th>Total Price</th>
                  <th data-html2canvas-ignore></th>
                </tr>
              </thead>
              <tbody>
                {memoState.entries.map((entry) => {
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

                  return (
                    <tr key={entry.id}>
                      <td data-label="Sl No.">
                        <input 
                          type="text" 
                          placeholder="Sl"
                          value={entry.serialNo || ''}
                          onChange={e => updateEntry(entry.id, 'serialNo', e.target.value)}
                          style={{ width: '50px', textAlign: 'center' }}
                        />
                      </td>
                      <td data-label={t('fishName')}>
                        <input 
                          type="text" 
                          placeholder={t('writeHere')}
                          value={entry.name}
                          onChange={e => updateEntry(entry.id, 'name', e.target.value)}
                        />
                      </td>
                      <td data-label={t('weightKg')}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="number" 
                            placeholder="0.00" 
                            value={entry.totalKg}
                            onChange={e => updateEntry(entry.id, 'totalKg', e.target.value ? Number(e.target.value) : '')}
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
                        <input 
                          type="number" 
                          placeholder="0.00"
                          value={entry.manualSaleRate !== undefined ? entry.manualSaleRate : (calculatedSaleRate > 0 ? calculatedSaleRate.toFixed(2) : '')}
                          onChange={e => updateEntry(entry.id, 'manualSaleRate', e.target.value === '' ? undefined : Number(e.target.value))}
                          style={{ fontWeight: '500' }}
                        />
                      </td>
                      <td data-label={t('profitPercent')} data-html2canvas-ignore>
                        <input 
                          type="number" 
                          className="highlight-input"
                          placeholder="20" 
                          value={entry.profitPercent !== undefined ? entry.profitPercent : 20}
                          onChange={e => updateEntry(entry.id, 'profitPercent', e.target.value ? Number(e.target.value) : '')}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td data-label="Total Price" style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        {totalPrice > 0 ? totalPrice.toFixed(2) : '0.00'}
                      </td>
                      <td data-label="" data-html2canvas-ignore>
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

          <div style={{ padding: '1rem 2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            
            {/* Left Side: Add Row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button className="add-row-dark-btn" onClick={handleAddRow} data-html2canvas-ignore style={{ margin: 0, alignSelf: 'flex-start' }}>
                <Plus size={16} /> {t('addNewRow')}
              </button>
            </div>

            {/* Action buttons removed from here to be placed at the bottom */}

            {/* Right Side: Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '220px', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="memo-label-dark">Total Price:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{grandTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="memo-label-dark">Jama (Paid):</span>
                <input 
                  type="number" 
                  className="supplier-input" 
                  style={{ width: '100%', textAlign: 'center', padding: '0.3rem' }}
                  value={memoState.paidAmount}
                  onChange={e => updateMemoState('paidAmount', e.target.value ? Number(e.target.value) : '')}
                  placeholder="0.00"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
                <span className="memo-label-dark">Due (Baki):</span>
                <span style={{ fontWeight: 'bold', color: '#ff9800' }}>{dueAmount.toFixed(2)}</span>
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


          <div className="memo-dark-footer">
            <div className="sig-box-dark">
              <div className="sig-canvas-container">
                <SignatureCanvas 
                  ref={sigPadReceiver}
                  penColor="#72be44"
                  canvasProps={{ className: 'sigCanvas' }} 
                />
                <button className="btn-icon clear-sig-btn" onClick={() => sigPadReceiver.current?.clear()} data-html2canvas-ignore>
                  <Trash2 size={12} />
                </button>
              </div>
              <span>{t('receiverSig')}</span>
            </div>
            
            <div className="sig-box-dark">
              <div className="sig-canvas-container">
                <SignatureCanvas 
                  ref={sigPadSeller}
                  penColor="#72be44"
                  canvasProps={{ className: 'sigCanvas' }} 
                />
                <button className="btn-icon clear-sig-btn" onClick={() => sigPadSeller.current?.clear()} data-html2canvas-ignore>
                  <Trash2 size={12} />
                </button>
              </div>
              <span>{t('sellerSig')}</span>
            </div>
          </div>
          
        </div>
      </div>

    </div>
  );
};

export default SalesMemoScreen;

