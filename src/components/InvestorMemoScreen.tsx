import React, { useState, useEffect, useRef } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, Download, CheckCircle2, Phone } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import CallMenu from './CallMenu';
import { useLanguage } from '../i18n/LanguageContext';

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
}

const InvestorMemoScreen: React.FC<InvestorMemoScreenProps> = ({ onNavigate, investorId, memoId }) => {
  const [memo, setMemo] = useState<InvestorMemo>({
    id: memoId,
    date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }),
    isEdited: false,
    entries: [],
    status: 'active',
    investNumber: '',
    totalInvestAmount: ''
  });
  const [profile, setProfile] = useState<any>({});
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [showInvestorCallMenu, setShowInvestorCallMenu] = useState(false);
  const memoRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  
  const sigPadInvestor = useRef<SignatureCanvas>(null);
  const sigPadSeller = useRef<SignatureCanvas>(null);

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
  }, [investorId, memoId]);

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

  useEffect(() => {
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
  }, [memo, memoId, totalInvested, totalProfit, totalWithdrawn, balance]);


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
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-icon action-download" onClick={handleDownload} title="PDF ডাউনলোড">
            <Download size={24} />
          </button>
        </div>
      </div>

      <div className="memo-wrapper">
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="memo-label-dark">{t('dateLabel')}: </span>
                <input 
                  type="text" 
                  className="supplier-input" 
                  value={memo.date} 
                  onChange={e => setMemo(prev => ({ ...prev, date: e.target.value, isEdited: true }))}
                  style={{ width: '130px', padding: '4px 8px', fontSize: '0.9rem', textAlign: 'right' }}
                />
              </div>
              {memo.isEdited && (
                <span style={{ fontSize: '10px', color: '#ff9800', marginRight: '4px' }}>(edited)</span>
              )}
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
                      <input
                        type="number"
                        value={entry.amount}
                        onChange={e => updateEntry(entry.id, 'amount', e.target.value ? Number(e.target.value) : '')}
                        placeholder="0.00"
                        style={{ color: typeColor(entry.type), width: '80px' }}
                        disabled={memo.status === 'completed'}
                      />
                    </td>
                    <td data-label={t('profitPercent')}>
                      <input
                        type="number"
                        value={entry.profitPercent !== undefined ? entry.profitPercent : ''}
                        onChange={e => updateEntry(entry.id, 'profitPercent', e.target.value ? Number(e.target.value) : '')}
                        placeholder="%"
                        style={{ width: '50px', display: entry.type === 'invest' ? 'block' : 'none' }}
                        disabled={memo.status === 'completed'}
                      />
                    </td>
                    <td data-label={t('totalProfitCol')}>
                      <input
                        type="number"
                        value={entry.total}
                        onChange={e => updateEntry(entry.id, 'total', e.target.value ? Number(e.target.value) : '')}
                        placeholder="0.00"
                        style={{ fontWeight: 'bold', width: '80px' }}
                        disabled={memo.status === 'completed' || (entry.type === 'invest' && !!entry.profitPercent)}
                      />
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
              <button className="add-row-dark-btn" onClick={addEntry} data-html2canvas-ignore style={{ margin: 0 }}>
                <Plus size={16} /> {t('addNewRow')}
              </button>
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

          <div className="memo-dark-footer" style={{ position: 'relative' }}>
            <div className="sig-box-dark">
              <div className="sig-canvas-container">
                <SignatureCanvas 
                  ref={sigPadInvestor}
                  penColor="#64b5f6"
                  canvasProps={{ className: 'sigCanvas' }} 
                />
                {memo.status !== 'completed' && (
                  <button className="btn-icon clear-sig-btn" onClick={() => sigPadInvestor.current?.clear()} data-html2canvas-ignore>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <span>{t('investorSig')}</span>
            </div>
            
            {memo.status !== 'completed' && (
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '2rem' }} data-html2canvas-ignore>
                <button 
                  className="btn btn-primary" 
                  onClick={handleCompleteMemo}
                  style={{ background: '#ff9800', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <CheckCircle2 size={18} /> {t('completedMemos')}
                </button>
              </div>
            )}

            <div className="sig-box-dark">
              <div className="sig-canvas-container">
                <SignatureCanvas 
                  ref={sigPadSeller}
                  penColor="#64b5f6"
                  canvasProps={{ className: 'sigCanvas' }} 
                />
                {memo.status !== 'completed' && (
                  <button className="btn-icon clear-sig-btn" onClick={() => sigPadSeller.current?.clear()} data-html2canvas-ignore>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <span>{t('businessSig')}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default InvestorMemoScreen;
