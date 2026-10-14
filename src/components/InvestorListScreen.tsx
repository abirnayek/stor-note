import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, FolderOpen, Wallet, Calendar, Users, TrendingUp } from 'lucide-react';
import { moveToTrash } from '../utils/trashUtils';
import { useLanguage } from '../i18n/LanguageContext';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';

interface InvestorListScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectInvestor: (investorId: string) => void;
}

const InvestorListScreen: React.FC<InvestorListScreenProps> = ({ onNavigate, onSelectInvestor }) => {
  const [investors, setInvestors] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [investorTotals, setInvestorTotals] = useState<Record<string, number>>({});
  const [investorGrossTotals, setInvestorGrossTotals] = useState<Record<string, number>>({});
  const [investorWithdrawnTotals, setInvestorWithdrawnTotals] = useState<Record<string, number>>({});
  const [grandTotal, setGrandTotal] = useState<number>(0);
  const [grandGrossTotal, setGrandGrossTotal] = useState<number>(0);
  const [grandWithdrawnTotal, setGrandWithdrawnTotal] = useState<number>(0);
  const [latestDate, setLatestDate] = useState<string>('');
  const { t, language } = useLanguage();
  const devicePermission = localStorage.getItem('device_permission');
  const hasEditPermission = devicePermission === 'admin';

  const loadInvestors = () => {
    const saved = localStorage.getItem('investor_list');
    let investorIds: string[] = [];
    if (saved) {
      try {
        investorIds = JSON.parse(saved);
      } catch (e) {}
    }
    setInvestors(investorIds);
    
    const profs: Record<string, any> = {};
    const totals: Record<string, number> = {};
    const grossTotals: Record<string, number> = {};
    const withdrawnTotals: Record<string, number> = {};
    let overallNet = 0;
    let overallGross = 0;
    let overallWithdrawn = 0;
    let foundLatestDate = '';

    investorIds.forEach((id: string) => {
      const profStr = localStorage.getItem(`investor_profile_${id}`);
      if (profStr) {
        try { profs[id] = JSON.parse(profStr); } catch (e) {}
      }

      // Calculate total investment and withdrawals for this investor
      let investorInvestSum = 0;
      let investorWithdrawnSum = 0;
      const memoIdsStr = localStorage.getItem(`investor_memos_${id}`);
      let memoIds: string[] = [];
      if (memoIdsStr) {
        try { memoIds = JSON.parse(memoIdsStr); } catch (e) {}
      }

      const allMemoIds = new Set<string>(memoIds);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`investor_memo_${id}_`)) {
          allMemoIds.add(k.replace('investor_memo_', ''));
        }
      }

      allMemoIds.forEach(mId => {
        const mStr = localStorage.getItem(`investor_memo_${mId}`);
        if (!mStr) return;
        try {
          const m = JSON.parse(mStr);
          // Only active memos count toward active ongoing investment pool
          if (m.status === 'completed') return;

          let inv = 0;
          if (m.totalInvest !== undefined && m.totalInvest !== null && !isNaN(Number(m.totalInvest))) {
            inv = Number(m.totalInvest);
          } else if (Array.isArray(m.entries)) {
            inv = m.entries
              .filter((e: any) => e.type === 'invest')
              .reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          }

          let withdr = 0;
          if (m.totalWithdrawn !== undefined && m.totalWithdrawn !== null && !isNaN(Number(m.totalWithdrawn))) {
            withdr = Number(m.totalWithdrawn);
          } else if (Array.isArray(m.entries)) {
            withdr = m.entries
              .filter((e: any) => e.type === 'withdraw')
              .reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
          }

          if (inv > 0) {
            investorInvestSum += inv;
          }
          if (withdr > 0) {
            investorWithdrawnSum += withdr;
          }

          const mDate = m.updatedAt || m.date;
          if (mDate && !foundLatestDate) {
            foundLatestDate = mDate;
          }
        } catch (e) {}
      });

      const netInvest = investorInvestSum - investorWithdrawnSum;
      totals[id] = netInvest;
      grossTotals[id] = investorInvestSum;
      withdrawnTotals[id] = investorWithdrawnSum;

      overallNet += netInvest;
      overallGross += investorInvestSum;
      overallWithdrawn += investorWithdrawnSum;
    });

    setProfiles(profs);
    setInvestorTotals(totals);
    setInvestorGrossTotals(grossTotals);
    setInvestorWithdrawnTotals(withdrawnTotals);
    setGrandTotal(overallNet);
    setGrandGrossTotal(overallGross);
    setGrandWithdrawnTotal(overallWithdrawn);

    const todayFormatted = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    setLatestDate(foundLatestDate || todayFormatted);
  };

  useEffect(() => {
    loadInvestors();
    window.addEventListener('storage', loadInvestors);
    window.addEventListener('focus', loadInvestors);
    return () => {
      window.removeEventListener('storage', loadInvestors);
      window.removeEventListener('focus', loadInvestors);
    };
  }, [language]);

  const handleAddInvestor = () => {
    if (!hasEditPermission) {
      alert(language === 'bn' ? 'শুধুমাত্র অ্যাডমিন নতুন বিনিয়োগকারী ফোল্ডার তৈরি করতে পারবেন।' : 'Only Admin can add new investor folders.');
      return;
    }
    const id = `investor_${Date.now()}`;
    const name = prompt(t('investorNamePrompt'));
    if (!name) return;

    const newList = [...investors, id];
    setInvestors(newList);
    localStorage.setItem('investor_list', JSON.stringify(newList));
    
    const profile = { id, name, phone: '', address: '' };
    localStorage.setItem(`investor_profile_${id}`, JSON.stringify(profile));
    setProfiles(prev => ({ ...prev, [id]: profile }));
    
    // Initialize empty memos list
    localStorage.setItem(`investor_memos_${id}`, JSON.stringify([]));
    window.dispatchEvent(new Event('storage'));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('deleteInvestorPrompt'))) return;
    
    const profile = profiles[id] || {};
    moveToTrash({ id, type: 'investor_folder', title: `Investor Folder: ${profile.name || 'Unknown'}`, data: profile });
    
    const newList = investors.filter(i => i !== id);
    setInvestors(newList);
    localStorage.setItem('investor_list', JSON.stringify(newList));
    window.dispatchEvent(new Event('storage'));
    loadInvestors();
  };

  return (
    <div className="lots-screen">
      <div className="screen-header" style={{ flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={24} />
          </button>
          <h2>{t('investorAccount')}</h2>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Total Investment Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(114, 190, 68, 0.16) 0%, rgba(20, 50, 24, 0.3) 100%)',
            border: '1px solid rgba(114, 190, 68, 0.45)',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)',
            padding: '6px 14px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(114, 190, 68, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#72be44',
              flexShrink: 0
            }}>
              <TrendingUp size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#c8d6e5', fontWeight: 600 }}>
                  {t('totalAllInvestorsInvest')}
                </span>
                <span style={{
                  fontSize: '0.7rem',
                  color: '#72be44',
                  background: 'rgba(114, 190, 68, 0.15)',
                  border: '1px solid rgba(114, 190, 68, 0.3)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Calendar size={11} />
                  {latestDate}
                </span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#72be44', letterSpacing: '0.5px', lineHeight: 1.2, marginTop: '2px' }}>
                ৳ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              {grandWithdrawnTotal > 0 && (
                <div style={{ fontSize: '0.68rem', color: '#a0aec0', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{language === 'bn' ? 'আসল বিনিয়োগ:' : 'Gross:'} ৳ {grandGrossTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span style={{ color: '#ffb74d' }}>•</span>
                  <span style={{ color: '#ffb74d' }}>{language === 'bn' ? 'উত্তোলন:' : 'Withdrawn:'} ৳ {grandWithdrawnTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Investor Count Badge */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            padding: '8px 16px',
            borderRadius: '20px',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}>
            <Users size={16} style={{ color: 'var(--primary-color)' }} />
            {investors.length === 0 ? t('noInvestor') : `${investors.length} ${t('investorsCount')}`}
          </div>
        </div>
      </div>

      <div className="lot-grid">
        {investors.map(id => {
          const profile = profiles[id] || { name: t('newInvestorFolder') };
          const passwordKey = `investor_folder_password_${id}`;
          const invTotal = investorTotals[id] || 0;
          const invWithdrawn = investorWithdrawnTotals[id] || 0;
          const invGross = investorGrossTotals[id] || 0;
          
          return (
            <ProtectedMemoWrapper 
              key={id} 
              passwordKey={passwordKey} 
              name={profile.name}
              type="folder"
              onAccessGranted={() => onSelectInvestor(id)}
            >
              <div className="lot-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FolderOpen size={20} style={{ color: 'var(--primary-color)' }} />
                        <span className="lot-number">{profile.name}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '4px', paddingLeft: '28px' }}>
                        {t('clickToViewFolder')}
                      </div>
                    </div>
                    {hasEditPermission && (
                      <button className="btn-icon delete-btn" onClick={(e) => handleDelete(id, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{
                  marginTop: '1rem',
                  paddingTop: '0.6rem',
                  borderTop: '1px dashed rgba(255, 255, 255, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  fontSize: '0.88rem'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#aaa', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Wallet size={14} style={{ color: '#72be44' }} />
                      {t('currentInvest')}
                    </span>
                    <span style={{ color: '#72be44', fontWeight: 'bold' }}>
                      ৳ {invTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {invWithdrawn > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.74rem',
                      color: '#a0aec0',
                      paddingLeft: '19px'
                    }}>
                      <span>{language === 'bn' ? 'আসল:' : 'Gross:'} ৳ {invGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span style={{ color: '#ffb74d' }}>{t('withdrawnLabel')} -৳ {invWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                  <MemoLockIcon passwordKey={passwordKey} />
                </div>
              </div>
            </ProtectedMemoWrapper>
          );
        })}

        {hasEditPermission && (
          <div className="lot-card empty-card" onClick={handleAddInvestor}>
            <Plus size={48} className="card-icon" style={{ opacity: 0.3 }} />
            <h3 style={{ opacity: 0.5 }}>{t('newInvestorFolder')}</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestorListScreen;
