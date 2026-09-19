import React, { useEffect, useRef, useState } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Phone } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import SignatureCanvas from 'react-signature-canvas';
import CallMenu from './CallMenu';

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
  lotNumber?: string;
  deposit?: number | '';
  paidDate?: number;
  entries: DueEntry[];
  memoState?: any;
  autoMessage?: AutoMessageConfig;
}

const DueMemoScreen: React.FC<DueMemoScreenProps> = ({ onNavigate, dueType, dueId, isPaid = false }) => {
  const { t, language } = useLanguage();
  const sigPadReceiver = useRef<SignatureCanvas>(null);
  const sigPadSeller = useRef<SignatureCanvas>(null);
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const getInitialState = (): DueMemoState => {
    const saved = localStorage.getItem(`due_memo_${dueId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.entries) {
           parsed.entries = [{ id: Date.now().toString(), statement: '', amount: '' }];
        }
        if (!parsed.address) parsed.address = '';
        return parsed;
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
      entries: [{ id: Date.now().toString(), serialNo: '', name: '', totalKg: '', weightUnit: 'kg', buyRate: '', profitPercent: 20 }]
    };
  };

  const [memoState, setMemoState] = useState<DueMemoState>(getInitialState());
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [showBusinessCallMenu, setShowBusinessCallMenu] = useState(false);
  const [showBusinessCallMenu2, setShowBusinessCallMenu2] = useState(false);
  const [showCustomerCallMenu, setShowCustomerCallMenu] = useState(false);
  const [showAutoMessageModal, setShowAutoMessageModal] = useState(false);
  const [msgTimeframe, setMsgTimeframe] = useState<'24h' | '7d' | 'custom'>('7d');
  const [msgCustomDate, setMsgCustomDate] = useState<string>('');
  const [msgType, setMsgType] = useState<'whatsapp' | 'sms'>('whatsapp');

  // Auto-save
  useEffect(() => {
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

  const handleMarkAsPaid = () => {
    // 1. Remove from active dues
    const existingDuesStr = localStorage.getItem(`dues_${dueType}`);
    let existingDues: string[] = existingDuesStr ? JSON.parse(existingDuesStr) : [];
    existingDues = existingDues.filter(id => id !== dueId);
    localStorage.setItem(`dues_${dueType}`, JSON.stringify(existingDues));

    // 2. Add to paid dues
    const paidDuesStr = localStorage.getItem(`paid_dues_${dueType}`);
    const paidDues: string[] = paidDuesStr ? JSON.parse(paidDuesStr) : [];
    if (!paidDues.includes(dueId)) {
      localStorage.setItem(`paid_dues_${dueType}`, JSON.stringify([...paidDues, dueId]));
    }

    // 3. Mark memo as paid with timestamp
    const updatedMemo = { ...memoState, paidDate: Date.now() };
    setMemoState(updatedMemo);
    localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(updatedMemo));
    
    alert('Marked as Paid!');
    onNavigate('due-list');
  };

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

  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar" data-html2canvas-ignore>
        <button className="btn-icon" onClick={() => onNavigate('due-list')}>
          <ChevronLeft size={24} />
        </button>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          <h2>Due Memo</h2>
          <span style={{fontSize: '0.8rem', color: saveStatus === 'Saved' ? '#72be44' : '#fff', transition: 'color 0.3s'}}>
            {saveStatus === 'Saved' ? '✔ All changes saved' : 'Saving...'}
          </span>
        </div>
      </div>

      <div className="memo-wrapper">
        <div className="memo-paper-dark">
          
          <div className="memo-dark-header">
            <div className="memo-logo-area-dark">
              <div className="memo-logo-rect-dark">
                <img src="/see fish logo.png" alt="Logo" />
              </div>
              <h1>{t('appTitle')}</h1>
            </div>
          </div>

          <div className="memo-dark-title">
            <h2 style={{color: '#ff9800'}}>Due Account - {dueType === 'regular' ? t('regularDue') : t('permanentDue')}</h2>
          </div>

          <div className="memo-top-meta" style={{ alignItems: 'flex-start' }}>
            <div className="meta-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>Name: </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  value={memoState.name} 
                  onChange={e => updateMemoState('name', e.target.value)}
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
              <div>
                <span className="memo-label-dark">{t('dateLabel')}: </span>
                <span className="memo-value-dark" style={{marginLeft: 10}}>{memoState.date || today}</span>
              </div>
              <div className="supplier-input-dark" style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>Lot Number: </span>
                <input 
                  type="text" 
                  className="supplier-input"
                  style={{ width: '100px', textAlign: 'right' }}
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
                  <th>Sl No.</th>
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
                        />
                      </td>
                      <td data-label={t('weightKg') || 'Weight/Kg'}>
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
                      <td data-label={t('price') || 'Price'}>
                        <input 
                          type="number" 
                          placeholder="0.00" 
                          value={entry.buyRate}
                          onChange={e => updateEntry(entry.id, 'buyRate', e.target.value ? Number(e.target.value) : '')}
                        />
                      </td>
                      <td data-label={t('profitPercent') || 'Profit %'}>
                        <input 
                          type="number" 
                          className="highlight-input"
                          placeholder="20" 
                          value={entry.profitPercent !== undefined ? entry.profitPercent : 20}
                          onChange={e => updateEntry(entry.id, 'profitPercent', e.target.value ? Number(e.target.value) : '')}
                          style={{ width: '80px' }}
                        />
                      </td>
                      <td data-label={t('saleRateAuto') || 'Sale Rate (Auto)'} style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        <input 
                          type="number" 
                          placeholder="0.00"
                          value={entry.manualSaleRate !== undefined ? entry.manualSaleRate : (calculatedSalePriceAuto > 0 ? calculatedSalePriceAuto.toFixed(2) : '')}
                          onChange={e => updateEntry(entry.id, 'manualSaleRate', e.target.value === '' ? undefined : Number(e.target.value))}
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
                <span style={{ fontWeight: 'bold' }}>{totalPrice.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ display: 'inline-block', width: '120px' }}>Deposit (Jama):</span> 
                <input 
                  type="number" 
                  value={memoState.deposit} 
                  onChange={e => updateMemoState('deposit', e.target.value ? Number(e.target.value) : '')}
                  placeholder="0.00"
                  style={{ width: '100px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '5px', borderRadius: '4px', textAlign: 'right', fontWeight: 'bold' }}
                />
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ display: 'inline-block', width: '120px' }}>Total Due:</span> 
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
              <button 
                className="btn-primary"  
                style={{ background: '#72be44', padding: '0.8rem 2rem', fontSize: '1.1rem', borderRadius: '8px', color: '#fff', border: 'none', cursor: 'pointer' }} 
                onClick={handleMarkAsPaid}
              >
                Mark as Paid
              </button>
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
