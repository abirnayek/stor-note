import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, FileText, CheckCircle2, Calendar } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface InvestorMemosListScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectMemo: (memoId: string) => void;
  investorId: string;
}

const InvestorMemosListScreen: React.FC<InvestorMemosListScreenProps> = ({ onNavigate, onSelectMemo, investorId }) => {
  const [activeMemos, setActiveMemos] = useState<any[]>([]);
  const [completedMemos, setCompletedMemos] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({});
  const { t } = useLanguage();

  useEffect(() => {
    // Load profile
    const profStr = localStorage.getItem(`investor_profile_${investorId}`);
    if (profStr) {
      try { setProfile(JSON.parse(profStr)); } catch (e) {}
    }

    // Load memos
    loadMemos();
    
    window.addEventListener('storage', loadMemos);
    return () => window.removeEventListener('storage', loadMemos);
  }, [investorId]);

  const loadMemos = () => {
    const memosListStr = localStorage.getItem(`investor_memos_${investorId}`);
    if (memosListStr) {
      try {
        const memoIds: string[] = JSON.parse(memosListStr);
        const active: any[] = [];
        const completed: any[] = [];

        // Current time for 6-month check (6 months ≈ 180 days)
        const sixMonthsMs = 180 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const validMemoIds: string[] = [];

        memoIds.forEach(id => {
          const memoStr = localStorage.getItem(`investor_memo_${id}`);
          if (memoStr) {
            try {
              const memo = JSON.parse(memoStr);
              memo.id = id;
              
              if (memo.status === 'completed') {
                // Check if older than 6 months
                if (memo.completedAt && (now - memo.completedAt > sixMonthsMs)) {
                  localStorage.removeItem(`investor_memo_${id}`); // Auto delete
                } else {
                  completed.push(memo);
                  validMemoIds.push(id);
                }
              } else {
                active.push(memo);
                validMemoIds.push(id);
              }
            } catch (e) {}
          }
        });

        // Update list if some were deleted
        if (validMemoIds.length !== memoIds.length) {
          localStorage.setItem(`investor_memos_${investorId}`, JSON.stringify(validMemoIds));
        }

        setActiveMemos(active);
        setCompletedMemos(completed.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)));
      } catch (e) {}
    }
  };

  const handleAddMemo = () => {
    const newId = `${investorId}_memo_${Date.now()}`;
    const memosListStr = localStorage.getItem(`investor_memos_${investorId}`);
    const memosList = memosListStr ? JSON.parse(memosListStr) : [];
    
    memosList.push(newId);
    localStorage.setItem(`investor_memos_${investorId}`, JSON.stringify(memosList));
    
    // Create empty memo
    const initialMemo = {
      date: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }),
      isEdited: false,
      entries: [],
      status: 'active'
    };
    localStorage.setItem(`investor_memo_${newId}`, JSON.stringify(initialMemo));
    
    onSelectMemo(newId);
  };

  const totalInvestmentAmount = activeMemos.reduce((sum, memo) => sum + (Number(memo.totalInvest) || 0), 0);

  return (
    <div className="due-list-screen">
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => onNavigate('investor-list')}>
            <ChevronLeft size={24} />
          </button>
          <h2>{profile.name || 'Investor'}{t('investorMemos')}</h2>
        </div>
        
        {totalInvestmentAmount > 0 && (
          <div style={{ border: '1px solid #72be44', padding: '0.4rem 1rem', borderRadius: '4px', color: '#72be44', fontWeight: 'bold', background: 'rgba(114, 190, 68, 0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>মোট বিনিয়োগ (Total Investment):</span> 
            <span>৳ {totalInvestmentAmount.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="content-layout">
        {/* Main Content - Active Memos */}
        <div className="main-content">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} /> {t('activeMemos')} ({activeMemos.length})
          </h3>
          
          <div className="lot-grid">
            {activeMemos.map(memo => (
              <div key={memo.id} className="lot-card" onClick={() => onSelectMemo(memo.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} style={{ color: 'var(--primary-color)' }} />
                    <span className="lot-number">{memo.date}</span>
                    {memo.isEdited && <span style={{ fontSize: '10px', color: '#aaa' }}>(edited)</span>}
                  </div>
                </div>
                
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: '#aaa' }}>{t('totalInvestAmount')}</span>
                    <span style={{ color: '#72be44', fontWeight: 'bold' }}>৳{memo.totalInvest || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ color: '#aaa' }}>{t('balanceAmount')}</span>
                    <span style={{ color: (memo.balance || 0) >= 0 ? '#64b5f6' : '#ff5252', fontWeight: 'bold' }}>
                      ৳{memo.balance || 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="lot-card empty-card" onClick={handleAddMemo}>
              <Plus size={48} className="card-icon" style={{ opacity: 0.3 }} />
              <h3 style={{ opacity: 0.5 }}>{t('createNewMemo')}</h3>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Completed Memos */}
        <div className="right-sidebar">
          <div className="sidebar-header">
            <CheckCircle2 size={20} style={{ color: '#72be44' }} />
            <h3>{t('completedMemos')}</h3>
          </div>
          <div className="sidebar-content">
            {completedMemos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa', marginTop: '2rem' }}>{t('noCompletedMemos')}</p>
            ) : (
              completedMemos.map(memo => (
                <div key={memo.id} className="paid-due-card" onClick={() => onSelectMemo(memo.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold' }}>{memo.date}</span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                      {memo.completedAt ? new Date(memo.completedAt).toLocaleDateString('bn-BD') : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#aaa' }}>{t('totalWithdrawal')}</span>
                    <span style={{ color: '#72be44', fontWeight: 'bold' }}>৳{memo.totalWithdrawn || 0}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestorMemosListScreen;
