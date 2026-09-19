import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Users, UserCheck } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface DueTypesScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectType: (type: 'regular' | 'permanent') => void;
}

const DueTypesScreen: React.FC<DueTypesScreenProps> = ({ onNavigate, onSelectType }) => {
  const { t } = useLanguage();
  const [totalDueAmount, setTotalDueAmount] = useState(0);

  useEffect(() => {
    let total = 0;
    const regularDuesStr = localStorage.getItem('dues_regular');
    const permanentDuesStr = localStorage.getItem('dues_permanent');
    
    const allDues = [
      ...(regularDuesStr ? JSON.parse(regularDuesStr) : []),
      ...(permanentDuesStr ? JSON.parse(permanentDuesStr) : [])
    ];

    allDues.forEach(dueId => {
      const memoStr = localStorage.getItem(`due_memo_${dueId}`);
      if (memoStr) {
        try {
          const memoState = JSON.parse(memoStr);
          if (memoState && Array.isArray(memoState.entries)) {
            const totalPrice = memoState.entries.reduce((sum: number, entry: any) => {
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
            
            const deposit = typeof memoState.deposit === 'number' ? memoState.deposit : (Number(memoState.deposit) || 0);
            total += (totalPrice - deposit);
          }
        } catch (e) {}
      }
    });
    
    setTotalDueAmount(total);
  }, []);

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button className="btn-icon" onClick={() => onNavigate('due-category')}>
          <ChevronLeft size={24} />
        </button>
        <h2>বিক্রয় বকেয়া (Sales Due)</h2>
        
        <div style={{ marginLeft: 'auto', background: 'rgba(255, 152, 0, 0.1)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
          <div style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Total Sales Due</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ff9800' }}>৳ {totalDueAmount.toFixed(2)}</div>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '2rem' }}>
        <div className="dashboard-card action-card" onClick={() => onSelectType('regular')}>
          <Users size={48} className="card-icon" />
          <h3>{t('regularDue')}</h3>
        </div>
        
        <div className="dashboard-card action-card" onClick={() => onSelectType('permanent')}>
          <UserCheck size={48} className="card-icon" />
          <h3>{t('permanentDue')}</h3>
        </div>
      </div>
    </div>
  );
};

export default DueTypesScreen;
