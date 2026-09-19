import React, { useState } from 'react';
import { type Screen } from '../App';
import { Plus, ChevronLeft, Package, Calendar, Trash2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';

interface SalesLotsScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectLot: (lotNumber: number) => void;
}

const SalesLotsScreen: React.FC<SalesLotsScreenProps> = ({ onNavigate, onSelectLot }) => {
  const [lots, setLots] = useState<number[]>(() => {
    const saved = localStorage.getItem('sales_lots_list');
    return saved ? JSON.parse(saved) : [1];
  });
  const [activeLot, setActiveLot] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const { t, language } = useLanguage();
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleAddLot = () => {
    const nextLot = lots.length > 0 ? Math.max(...lots) + 1 : 1;
    const newLots = [...lots, nextLot];
    setLots(newLots);
    localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
    setActiveLot(nextLot);
    setPassword('');
  };

  const handleDeleteLot = (lot: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this sales memo?')) {
      const memoDataStr = localStorage.getItem(`sales_memo_lot_${lot}`);
      const memoData = memoDataStr ? JSON.parse(memoDataStr) : {};
      
      moveToTrash({
        id: `sales_lot_${lot}`,
        type: 'sales_lot',
        title: `Sales Memo ${lot}`,
        data: memoData
      });

      const newLots = lots.filter(l => l !== lot);
      setLots(newLots);
      localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
      localStorage.removeItem(`sales_memo_lot_${lot}`);
    }
  };

  const handlePasswordSubmit = (lot: number, e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1234') { 
      onSelectLot(lot);
      setPassword('');
      setActiveLot(null);
    } else {
      alert(t('incorrectPassword') || 'Incorrect Password');
    }
  };

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <h2>{t('salesAccount')}</h2>
      </div>

      <div className="lot-grid">
        {lots.map(lot => (
          <div 
            key={lot} 
            className={`lot-card ${activeLot === lot ? 'active-lock' : ''}`} 
            onClick={() => {
              setActiveLot(lot);
              setPassword('');
            }}
          >
            {activeLot === lot ? (
              <form onSubmit={(e) => handlePasswordSubmit(lot, e)} className="lot-password-form" onClick={(e) => e.stopPropagation()}>
                <div className="password-input-wrapper">
                   <span className="password-label" style={{color: '#000'}}>PassWord:</span>
                   <input 
                     type="password" 
                     autoFocus 
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                   />
                </div>
              </form>
            ) : (
              <>
                <div className="lot-card-header">
                  <Package size={40} className="lot-icon" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="lot-status">{t('activeLot')}</span>
                    <button className="btn-icon delete-btn" onClick={(e) => handleDeleteLot(lot, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="lot-card-body">
                  <h3>{t('salesAccount')} {lot.toString().padStart(2, '0')}</h3>
                  <div className="lot-date">
                    <Calendar size={14} /> 
                    <span>{today}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        
        <div className="lot-card add-lot-card" onClick={handleAddLot}>
          <div className="add-lot-content">
            <Plus size={48} />
            <h3>{t('newLot')}</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesLotsScreen;
