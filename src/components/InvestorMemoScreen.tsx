import { MathInput, parseMathOrNumber } from './MathInput';
import React, { useState, useEffect, useRef } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, MinusCircle, Trash2, Download, CheckCircle2, Phone, Undo, Redo } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { MemoSignatureBox } from './MemoSignatureBox';
import CallMenu from './CallMenu';
import { useLanguage } from '../i18n/LanguageContext';
import { useHistory } from '../hooks/useHistory';

interface InvestorMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  investorId: string;
  memoId: string;
}

interface InvestEntry {
  id: string;
  serial: string;
  date: string;
  name: string;
  description: string;
  type: 'invest' | 'profit' | 'withdraw';
  amount: number | '';
  profitPercent?: number | '';
  total: number | '';
}

interface InvestorMemo {
  id: string;
  date: string;
  isEdited: boolean;
  entries: InvestEntry[];
  status: 'active' | 'completed';
  completedAt?: number;
  totalInvest?: number;
  totalProfit?: number;
  totalWithdrawn?: number;
  balance?: number;
  investNumber?: string;
  totalInvestAmount?: string;
  investorSignature?: string;
  sellerSignature?: string;
  updatedAt?: string;
}

const InvestorMemoScreen: React.FC<InvestorMemoScreenProps> = ({ onNavigate, investorId, memoId }) => {
  const getInitialMemo = (): InvestorMemo => {
    const memoStr = localStorage.getItem(`investor_memo_${memoId}`);
    if (memoStr) {
      try {
        const parsed = JSON.parse(memoStr);
        if (!parsed.date) {
          parsed.date = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
          parsed.isEdited = false;
        }
        return parsed;
      } catch (e) {}
    }
    return {
      id: memoId,
      date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }),
      isEdited: false,
      entries: [],
      status: 'active',
      investNumber: '',
      totalInvestAmount: ''
    };
  };

  const [memo, setMemo, undo, redo, canUndo, canRedo] = useHistory<InvestorMemo>(getInitialMemo(), `investor_memo_${memoId}`);
  const [profile, setProfile] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [showInvestorCallMenu, setShowInvestorCallMenu] = useState(false);
  const memoRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  
  

  useEffect(() => {
    // Load profile
    const profStr = localStorage.getItem(`investor_profile_${investorId}`);
    if (profStr) {
      try { setProfile(JSON.parse(profStr)); } catch (e) {}
    }

    // Load memo
    const memoStr = localStorage.getItem(`investor_memo_${memoId}`);
    if (memoStr) {
      try { 
        const parsed = JSON.parse(memoStr);
        // Ensure legacy memos get a date
        if (!parsed.date) {
          parsed.date = new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
          parsed.isEdited = false;
        }
        setMemo(parsed); 
      } catch (e) {}
    }

    const handleStorage = () => {
      const memoStr = localStorage.getItem(`investor_memo_${memoId}`);
      if (memoStr) {
        try { setMemo(JSON.parse(memoStr)); } catch (e) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [investorId, memoId]);


    const handleSaveInvestorSig = (dataUrl: string) => {
    setMemo(prev => {
      const next = { ...prev, investorSignature: dataUrl };
      try { localStorage.setItem(`investor_memo_${memoId}`, JSON.stringify(next)); } catch(e) {}
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

    setMemo(prev => {
      const next = { ...prev, sellerSignature: dataUrl };
      try { localStorage.setItem(`investor_memo_${memoId}`, JSON.stringify(next)); } catch(e) {}
      return next;
    });
    setSaveStatus('Signature Saved ✔');
    setTimeout(() => setSaveStatus('Saved'), 1500);
  };

  const handleClearInvestorSig = () => {
    handleSaveInvestorSig('');
  };

  const handleClearSellerSig = () => {
    handleSaveSellerSig('');
  };

  const updateProfile = (field: string, value: string) => {
    const newProfile = { ...profile, [field]: value };
    setProfile(newProfile);
    localStorage.setItem(`investor_profile_${investorId}`, JSON.stringify(newProfile));
  };

  // Totals
  const totalInvested = memo.entries.filter(e => e.type === 'invest').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const calculatedProfitsFromInvest = memo.entries.filter(e => e.type === 'invest').reduce((s, e) => s + (Number(e.total) || 0), 0);
  const totalProfit = memo.entries.filter(e => e.type === 'profit').reduce((s, e) => s + (Number(e.amount) || 0), 0) + calculatedProfitsFromInvest;
  const totalWithdrawn = memo.entries.filter(e => e.type === 'withdraw').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const balance = totalInvested + totalProfit - totalWithdrawn;

  const todayStr = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    if (memo.date && memo.date !== todayStr && memo.updatedAt !== todayStr) {
      setMemo(prev => ({ ...prev, updatedAt: todayStr }));
      return;
    }

    // Autosave memo and update its totals
    const updatedMemo = {
      ...memo,
      totalInvest: totalInvested,
      totalProfit: totalProfit,
      totalWithdrawn: totalWithdrawn,
      balance: balance
    };
    
    // Don't save if it's completely empty on first load, wait for user action
    localStorage.setItem(`investor_memo_${memoId}`, JSON.stringify(updatedMemo));
    setSaveStatus('Saving...');
    const t = setTimeout(() => setSaveStatus('Saved'), 500);
    return () => clearTimeout(t);
  }, [memo, memoId, totalInvested, totalProfit, totalWithdrawn, balance, language, todayStr]);


  const addEntry = () => {
    const newEntry: InvestEntry = {
      id: Date.now().toString(),
      serial: (memo.entries.length + 1).toString(),
      date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }),
      name: '',
      description: '',
      type: 'invest',
      amount: '',
      profitPercent: '',
      total: ''
    };
    setMemo(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
  };

  const addWithdrawEntry = () => {
    const newEntry: InvestEntry = {
      id: Date.now().toString(),
      serial: (memo.entries.length + 1).toString(),
      date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }),
      name: '',
      description: language === 'bn' ? 'উত্তোলন' : 'Withdrawal',
      type: 'withdraw',
      amount: '',
      profitPercent: '',
      total: ''
    };
    setMemo(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
  };

  const updateEntry = (id: string, field: keyof InvestEntry, value: any) => {
    setMemo(prev => {
      const updatedEntries = prev.entries.map(e => {
        if (e.id !== id) return e;
        const newEntry = { ...e, [field]: value };
        if (newEntry.type === 'invest' && (field === 'amount' || field === 'profitPercent')) {
          const amt = Number(newEntry.amount) || 0;
          const pct = Number(newEntry.profitPercent) || 0;
          if (pct > 0) {
             newEntry.total = Number((amt * (pct / 100)).toFixed(2));
          } else if (field === 'profitPercent' && !value) {
             newEntry.total = '';
          }
        }
        return newEntry;
      });
      return { ...prev, entries: updatedEntries };
    });
  };

  const deleteEntry = (id: string) => {
    setMemo(prev => ({ ...prev, entries: prev.entries.filter(e => e.id !== id) }));
  };

  const handleCompleteMemo = () => {
    if (!window.confirm(t('completeInvestPrompt'))) return;
    
    const completedMemo = {
      ...memo,
      status: 'completed' as const,
      completedAt: Date.now(),
      totalInvest: totalInvested,
      totalProfit: totalProfit,
      totalWithdrawn: totalWithdrawn,
      balance: balance
    };
    setMemo(completedMemo);
    localStorage.setItem(`investor_memo_${memoId}`, JSON.stringify(completedMemo));
    onNavigate('investor-memos-list');
  };

  const handleDownload = async () => {
    if (memoRef.current) {
      const canvas = await html2canvas(memoRef.current, { scale: 2, backgroundColor: '#092115' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Investor_${profile.name || 'Memo'}_${memo.date}.pdf`);
    }
  };

  const typeColor = (type: string) => {
    if (type === 'invest') return '#72be44';
    if (type === 'profit') return '#64b5f6';
    return '#ff9800';
  };



  return (
    <div className="memo-screen">
      <div className="screen-header memo-action-bar" data-html2canvas-ignore>
        <button className="btn-icon" onClick={() => onNavigate('investor-memos-list')}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>{t('investorMemoTitle')}</h2>
          <span style={{ fontSize: '0.8rem', color: saveStatus === 'Saved' ? '#72be44' : '#fff', transition: 'color 0.3s' }}>
            {saveStatus === 'Saved' ? (language === 'bn' ? '✔ সেভ হয়েছে' : '✔ Saved') : (language === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...')}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="btn-icon action-undo" onClick={undo} disabled={!canUndo} title="Undo" style={{ opacity: canUndo ? 1 : 0.4 }}>
            <Undo size={24} />
          </button>
          <button className="btn-icon action-redo" onClick={redo} disabled={!canRedo} title="Redo" style={{ opacity: canRedo ? 1 : 0.4 }}>
            <Redo size={24} />
          </button>
          <button className="btn-icon action-download" onClick={handleDownload} title="PDF ডাউনলোড">
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
            <h2 style={{ color: '#64b5f6' }}>{t('investorAccount')}</h2>
          </div>

          <div className="memo-top-meta" style={{ alignItems: 'flex-start' }}>
            <div className="meta-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('nameLabel')} </span>
                <input 
                  type="text"
                  className="supplier-input"
                  value={profile.name || ''}
                  onChange={e => updateProfile('name', e.target.value)}
                  style={{ width: '200px', padding: '4px 8px', fontSize: '1rem', fontWeight: 'bold' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('phoneLabel')} </span>
                <input 
                  type="text"
                  className="supplier-input"
                  value={profile.phone || ''}
                  onChange={e => updateProfile('phone', e.target.value)}
                  style={{ width: '200px', padding: '4px 8px', fontSize: '0.9rem' }}
                />
                  <div style={{ position: 'relative' }}>
                    <Phone 
                      size={18} 
                      style={{ cursor: 'pointer', color: profile.phone ? '#72be44' : '#aaa', marginLeft: '8px' }} 
                      onClick={() => {
                        if (profile.phone) setShowInvestorCallMenu(!showInvestorCallMenu);
                        else alert('Please enter a mobile number first.');
                      }} 
                      data-html2canvas-ignore
                    />
                    {showInvestorCallMenu && profile.phone && (
                      <CallMenu 
                        phones={[profile.phone]} 
                        onClose={() => setShowInvestorCallMenu(false)} 
                        position="right"
                      />
                    )}
                  </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className="memo-label-dark" style={{ width: '80px' }}>{t('addressLabel')} </span>
                <input 
                  type="text"
                  className="supplier-input"
                  value={profile.address || ''}
                  onChange={e => updateProfile('address', e.target.value)}
                  style={{ width: '200px', padding: '4px 8px', fontSize: '0.9rem' }}
                />
              </div>
            </div>
            
            <div className="meta-item right-align" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="memo-label-dark">{t('dateLabel')}: </span>
                  <input 
                    type="text" 
                    className="supplier-input" 
                    value={memo.date} 
                    onChange={e => setMemo(prev => ({ ...prev, date: e.target.value, isEdited: true }))}
                    style={{ background: 'transparent', border: 'none', color: '#fff', width: '130px', padding: '4px 8px', fontSize: '0.9rem', textAlign: 'right', outline: 'none' }}
                  />
                </div>
                {memo.updatedAt && (
                  <div style={{ fontSize: '0.75rem', color: '#ffb74d', marginTop: '2px' }}>
                    পরিবর্তিত তারিখ: {memo.updatedAt}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.85rem' }}>{t('investNo')}: </span>
                <input 
                  type="text" 
                  className="supplier-input" 
                  value={memo.investNumber || ''} 
                  onChange={e => setMemo(prev => ({ ...prev, investNumber: e.target.value }))}
                  style={{ width: '130px', padding: '4px 8px', fontSize: '0.9rem', textAlign: 'right' }}
                  disabled={memo.status === 'completed'}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span className="memo-label-dark" style={{ fontSize: '0.85rem' }}>{t('totalInvestAmount')}: </span>
                <input 
                  type="text" 
                  className="supplier-input" 
                  value={memo.totalInvestAmount || ''} 
                  onChange={e => setMemo(prev => ({ ...prev, totalInvestAmount: e.target.value }))}
                  style={{ width: '130px', padding: '4px 8px', fontSize: '0.9rem', textAlign: 'right' }}
                  disabled={memo.status === 'completed'}
                />
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="memo-dark-table">
              <thead>
                <tr>
                  <th>{t('serial')}</th>
                  <th>{t('dateLabel')}</th>
                  <th>{t('nameCol')}</th>
                  <th>{t('descCol')}</th>
                  <th>{t('typeCol')}</th>
                  <th>{t('amountCol')}</th>
                  <th>{t('profitPercent')}</th>
                  <th>{t('totalProfitCol')}</th>
                  {memo.status !== 'completed' && <th data-html2canvas-ignore></th>}
                </tr>
              </thead>
              <tbody>
                {memo.entries.map(entry => (
                  <tr key={entry.id}>
                    <td data-label={t('serial')}>
                      <input 
                        type="text" 
                        value={entry.serial || ''} 
                        onChange={e => updateEntry(entry.id, 'serial', e.target.value)} 
                        style={{ width: '50px', fontSize: '0.85rem', textAlign: 'center' }} 
                        disabled={memo.status === 'completed'}
                      />
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={entry.date || ''} 
                        onChange={e => updateEntry(entry.id, 'date', e.target.value)} 
                        style={{ width: '100px', fontSize: '0.85rem' }} 
                        disabled={memo.status === 'completed'}
                      />
                    </td>
                    <td data-label={t('nameCol')}>
                      <input 
                        type="text" 
                        value={entry.name || ''} 
                        onChange={e => updateEntry(entry.id, 'name', e.target.value)} 
                        placeholder={t('nameCol')}
                        style={{ width: '120px' }}
                        disabled={memo.status === 'completed'}
                      />
                    </td>
                    <td data-label={t('descCol')}>
                      <input 
                        type="text" 
                        value={entry.description || ''} 
                        onChange={e => updateEntry(entry.id, 'description', e.target.value)} 
                        placeholder={t('descCol')}
                        disabled={memo.status === 'completed'}
                      />
                    </td>
                    <td data-label={t('typeCol')}>
                      <select
                        value={entry.type}
                        onChange={e => updateEntry(entry.id, 'type', e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: typeColor(entry.type), color: '#fff', cursor: memo.status === 'completed' ? 'default' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                        disabled={memo.status === 'completed'}
                      >
                        <option value="invest">{t('typeInvest')}</option>
                        <option value="profit">{t('typeProfit')}</option>
                        <option value="withdraw">{t('typeWithdraw')}</option>
                      </select>
                    </td>
                    <td data-label={t('amountCol')} style={{ fontWeight: 'bold', color: typeColor(entry.type) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {entry.type === 'withdraw' && <span style={{ color: '#ff9800', fontWeight: 'bold' }}>(-)</span>}
                        <MathInput
                          value={entry.amount}
                          onChange={e => updateEntry(entry.id, 'amount', parseMathOrNumber(e.target.value))}
                          placeholder="0.00"
                          style={{ color: typeColor(entry.type), width: '80px' }}
                          disabled={memo.status === 'completed'}
                        />
                      </div>
                    </td>
                    <td data-label={t('profitPercent')}>
                      {entry.type === 'invest' ? (
                        <MathInput
                          value={entry.profitPercent !== undefined ? entry.profitPercent : ''}
                          onChange={e => updateEntry(entry.id, 'profitPercent', parseMathOrNumber(e.target.value))}
                          placeholder="%"
                          style={{ width: '50px' }}
                          disabled={memo.status === 'completed'}
                        />
                      ) : (
                        <span style={{ color: '#888' }}>-</span>
                      )}
                    </td>
                    <td data-label={t('totalProfitCol')}>
                      {entry.type === 'withdraw' ? (
                        <span style={{ color: '#ff9800', fontWeight: 'bold' }}>-</span>
                      ) : (
                        <MathInput
                          value={entry.total}
                          onChange={e => updateEntry(entry.id, 'total', parseMathOrNumber(e.target.value))}
                          placeholder="0.00"
                          style={{ fontWeight: 'bold', width: '80px' }}
                          disabled={memo.status === 'completed' || (entry.type === 'invest' && !!entry.profitPercent)}
                        />
                      )}
                    </td>
                    {memo.status !== 'completed' && (
                      <td data-label="" data-html2canvas-ignore>
                        <button className="btn-icon delete-btn" onClick={() => deleteEntry(entry.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '1rem 2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {memo.status !== 'completed' ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }} data-html2canvas-ignore>
                <button className="add-row-dark-btn" onClick={addEntry} style={{ margin: 0 }}>
                  <Plus size={16} /> {t('addNewRow')}
                </button>
                <button 
                  className="add-row-dark-btn" 
                  onClick={addWithdrawEntry} 
                  style={{ 
                    margin: 0, 
                    background: 'rgba(255, 152, 0, 0.2)', 
                    border: '1px solid #ff9800', 
                    color: '#ffb74d' 
                  }}
                >
                  <MinusCircle size={16} /> {t('addWithdrawalRow')}
                </button>
              </div>
            ) : (
              <div>
                <span style={{ color: '#ff9800', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={18} /> {t('completedMemos')}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginTop: '4px' }}>
                  {t('dateLabel')}: {memo.completedAt ? new Date(memo.completedAt).toLocaleDateString('bn-BD') : ''}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minWidth: '240px', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="memo-label-dark">{t('totalInvestAmountBottom')}</span>
                <span style={{ fontWeight: 'bold', color: '#72be44' }}>৳{totalInvested.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="memo-label-dark">{t('totalProfitBottom')}</span>
                <span style={{ fontWeight: 'bold', color: '#64b5f6' }}>৳{totalProfit.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="memo-label-dark">{t('withdrawalBottom')}</span>
                <span style={{ fontWeight: 'bold', color: '#ff9800' }}>৳{totalWithdrawn.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '0.5rem' }}>
                <span className="memo-label-dark" style={{ fontWeight: 'bold' }}>{t('currentBalance')}</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: balance >= 0 ? '#72be44' : '#ff5252' }}>৳{balance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="memo-dark-footer">
            <MemoSignatureBox 
              label={t('investorSig')}
              signatureData={memo.investorSignature}
              penColor="#64b5f6"
              disabled={memo.status === 'completed'}
              onSave={handleSaveInvestorSig}
              onClear={handleClearInvestorSig}
            />
            
            <MemoSignatureBox 
              label={t('businessSig')}
              signatureData={memo.sellerSignature}
              penColor="#64b5f6"
              disabled={memo.status === 'completed'}
              onSave={handleSaveSellerSig}
              onClear={handleClearSellerSig}
            />
          </div>

          {memo.status !== 'completed' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0 2rem 0', width: '100%' }} data-html2canvas-ignore>
              <button 
                className="btn btn-primary" 
                onClick={handleCompleteMemo}
                style={{ background: '#ff9800', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.8rem 1.5rem', fontSize: '1rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                <CheckCircle2 size={18} /> {t('completedMemos')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default InvestorMemoScreen;
