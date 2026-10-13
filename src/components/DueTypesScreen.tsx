import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Users, UserCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { syncAllDueAccounts, getNormalizedMemo } from '../utils/dueSyncUtils';

interface DueTypesScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectType: (type: 'regular' | 'permanent' | 'reseller') => void;
}

const DueTypesScreen: React.FC<DueTypesScreenProps> = ({ onNavigate, onSelectType }) => {
  const { t } = useLanguage();
  const [totalDueAmount, setTotalDueAmount] = useState(0);
  const [regularCount, setRegularCount] = useState(0);
  const [regularDueTotal, setRegularDueTotal] = useState(0);
  const [permanentCount, setPermanentCount] = useState(0);
  const [permanentDueTotal, setPermanentDueTotal] = useState(0);
  const [resellerCount, setResellerCount] = useState(0);
  const [resellerDueTotal, setResellerDueTotal] = useState(0);

  useEffect(() => {
    const calculateTotal = () => {
      const synced = syncAllDueAccounts();
      
      let regTotal = 0;
      synced.regularDues.forEach(id => {
        regTotal += getNormalizedMemo(id).dueAmount;
      });

      let permTotal = 0;
      synced.permanentDues.forEach(id => {
        permTotal += getNormalizedMemo(id).dueAmount;
      });

      let resTotal = 0;
      synced.resellerDues.forEach(id => {
        resTotal += getNormalizedMemo(id).dueAmount;
      });

      setRegularCount(synced.regularDues.length);
      setRegularDueTotal(regTotal);
      setPermanentCount(synced.permanentDues.length);
      setPermanentDueTotal(permTotal);
      setResellerCount(synced.resellerDues.length);
      setResellerDueTotal(resTotal);
      setTotalDueAmount(regTotal + permTotal + resTotal);
    };

    calculateTotal();
    
    window.addEventListener('storage', calculateTotal);
    window.addEventListener('settingsChange', calculateTotal);
    return () => {
      window.removeEventListener('storage', calculateTotal);
      window.removeEventListener('settingsChange', calculateTotal);
    };
  }, []);

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button
          key="btn-back-due-types"
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('due-category');
          }}
          title="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <h2>বিক্রয় বকেয়া (Sales Due)</h2>
        
        <div style={{ marginLeft: 'auto', background: 'rgba(255, 152, 0, 0.1)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
          <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Sales Due</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ff9800' }}>৳ {totalDueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '2rem' }}>
        <div className="dashboard-card action-card" onClick={() => onSelectType('regular')}>
          <Users size={48} className="card-icon" />
          <h3>{t('regularDue')}</h3>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{regularCount} টি মেমো</span>
            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ff9800' }}>৳ {regularDueTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        
        <div className="dashboard-card action-card" onClick={() => onSelectType('permanent')}>
          <UserCheck size={48} className="card-icon" />
          <h3>{t('permanentDue')}</h3>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{permanentCount} টি মেমো</span>
            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ff9800' }}>৳ {permanentDueTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="dashboard-card action-card" onClick={() => onSelectType('reseller')}>
          <Users size={48} className="card-icon" style={{ color: '#00e676' }} />
          <h3>{t('resellerDue')}</h3>
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>{resellerCount} টি মেমো</span>
            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#ff9800' }}>৳ {resellerDueTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DueTypesScreen;
