import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Download, Undo, Mail, MessageCircle, Share2, Phone, Trash2, Clock, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import CallMenu from './CallMenu';

interface MemoScreenProps {
  onNavigate: (screen: Screen) => void;
  lotNumber: number | null;
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
  entries: FishEntry[];
}

const MemoScreen: React.FC<MemoScreenProps> = ({ onNavigate, lotNumber }) => {
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
    const saved = localStorage.getItem(`memo_lot_${lotNumber}`);
    if (saved) {
      try {
        return JSON.parse(saved);
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
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', totalPrice: '', profitPercent: 20 }]
    };
  };

  const [memoState, setMemoState, undo, canUndo] = useHistory<MemoState>(getInitialState());
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [showSupplierCallMenu, setShowSupplierCallMenu] = useState(false);
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showDueModal, setShowDueModal] = useState(false);

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

  // Auto-save
  useEffect(() => {
    localStorage.setItem(`memo_lot_${lotNumber}`, JSON.stringify(memoState));
    setSaveStatus('Saving...');
    const timer = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(timer);
  }, [memoState, lotNumber]);

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
      entries: [...prev.entries, { id: Date.now().toString(), name: '', totalKg: '', totalPrice: '', profitPercent: 20 }]
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
        <button className="btn-icon" onClick={() => onNavigate('lots')}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{t('purchaseMemo')}</h2>
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
        <div className="memo-paper-dark" ref={memoRef}>

          <div className="memo-dark-header">
            <div className="memo-logo-area-dark">
              <div className="memo-logo-rect-dark">
                <img src="/see fish logo.png" alt="Logo" />
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
            <div className="meta-item text-center">
              <span className="memo-label-dark">{t('date')}</span>
              <span className="memo-value-dark" style={{ marginLeft: 10 }}>{today}</span>
            </div>
            <div className="meta-item right-align" style={{ position: 'relative', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark">{t('supplierName')}</span>
                <input
                  type="text"
                  className="supplier-input"
                  value={memoState.supplierName}
                  onChange={e => updateMemoState('supplierName', e.target.value)}
                  placeholder={t('writeHere')}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="memo-label-dark">{t('mobileLabel')}</span>
                <input
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
              <input
                type="number"
                value={memoState.totalPriceMain}
                onChange={e => updateMemoState('totalPriceMain', e.target.value ? Number(e.target.value) : '')}
                placeholder="0.00"
              />
            </div>
            <div className="summary-card-dark">
              <span className="memo-label-dark">{t('totalCostLabel')}</span>
              <input
                type="number"
                value={memoState.totalCostMain}
                onChange={e => updateMemoState('totalCostMain', e.target.value ? Number(e.target.value) : '')}
                placeholder="0.00"
              />
            </div>
            <div className="summary-card-dark calc-card">
              <span className="memo-label-dark">{t('calcCostPercent')}</span>
              <span className="calc-value">{((Number(memoState.totalCostMain || 0) / Number(memoState.totalPriceMain || 1)) * 100).toFixed(2)}%</span>
            </div>
            <div className="summary-card-dark">
              <span className="memo-label-dark">{t('globalProfitPercent')}</span>
              <input
                type="number"
                value={memoState.globalProfitPercent !== undefined ? memoState.globalProfitPercent : ''}
                onChange={e => updateMemoState('globalProfitPercent', e.target.value ? Number(e.target.value) : '')}
                placeholder="Ex: 20"
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
                    : (entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 20);

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
                      <td data-label="#" style={{ textAlign: 'center', opacity: 0.7 }}>{index + 1}</td>
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
                      <td data-label={t('price')}>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={entry.totalPrice}
                          onChange={e => updateEntry(entry.id, 'totalPrice', e.target.value ? Number(e.target.value) : '')}
                        />
                      </td>
                      <td data-label={t('buyRateAuto')}>{autoRate > 0 ? autoRate.toFixed(2) : '0.00'}</td>
                      <td data-label={t('costPercentAuto')}>{autoRate > 0 ? (autoRate * globalCostPercent / 100).toFixed(2) : '0.00'}</td>
                      <td data-label={t('totalBuyPriceAuto')} style={{ fontWeight: '500', color: '#ffb74d' }}>{investment > 0 ? investment.toFixed(2) : '0.00'}</td>
                      <td data-label={t('profitPercent')}>
                        <input
                          type="number"
                          className="highlight-input"
                          placeholder="20"
                          value={hasGlobalProfit ? currentProfitPercent : (entry.profitPercent !== undefined ? entry.profitPercent : 20)}
                          onChange={e => updateEntry(entry.id, 'profitPercent', e.target.value ? Number(e.target.value) : '')}
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

          <div className="sales-actions" data-html2canvas-ignore style={{ display: 'flex', justifyContent: 'center', gap: '1rem', width: '100%', marginTop: '2rem', marginBottom: '1rem' }}>
            <button className="btn-primary btn-3d" onClick={() => setShowDueModal(true)} style={{ background: '#ff9800', padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
              <Clock size={20} /> Mark as Due
            </button>
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

      {showDueModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="btn-icon close-btn" onClick={() => setShowDueModal(false)}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1rem', color: '#ff9800' }}>Add to Purchase Due</h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#ccc' }}>Deposit/Paid Amount (৳)</label>
              <input 
                type="number" 
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
    </div>
  );
};

export default MemoScreen;
