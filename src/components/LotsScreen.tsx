import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { Plus, ChevronLeft, Package, Calendar, Trash2, Search } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { useLanguage } from '../i18n/LanguageContext';
import { moveToTrash } from '../utils/trashUtils';

interface LotsScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectLot: (lotNumber: number) => void;
}

const LotsScreen: React.FC<LotsScreenProps> = ({ onNavigate, onSelectLot }) => {
  const [lots, setLots] = useState<number[]>([]);
  
  useEffect(() => {
    const loadLots = () => {
      const saved = localStorage.getItem('purchase_lots_list');
      try {
        const parsed = saved ? JSON.parse(saved) : [1];
        setLots(Array.isArray(parsed) ? parsed : [1]);
      } catch (e) {
        setLots([1]);
      }
    };
    loadLots();
    window.addEventListener('storage', loadLots);
    return () => window.removeEventListener('storage', loadLots);
  }, []);
      const [searchQuery, setSearchQuery] = useState('');
  const [showNewLotModal, setShowNewLotModal] = useState(false);
  const [newLotPassword, setNewLotPassword] = useState('');
  const { t, language } = useLanguage();
  const devicePermission = localStorage.getItem('device_permission');
  const hasEditPermission = devicePermission === 'edit' || devicePermission === 'admin';
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleAddLot = () => {
    setShowNewLotModal(true);
    setNewLotPassword('');
  };

  const confirmAddLot = (skipPassword = false) => {
    const nextLot = lots.length > 0 ? Math.max(...lots) + 1 : 1;
    const newLots = [...lots, nextLot];
    setLots(newLots);
    localStorage.setItem('purchase_lots_list', JSON.stringify(newLots));
    
    if (!skipPassword && newLotPassword.trim() !== '') {
      localStorage.setItem(`lot_password_${nextLot}`, newLotPassword.trim());
    }
    
    setShowNewLotModal(false);
    onSelectLot(nextLot);
  };

  const handleDeleteLot = (lot: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this lot?')) {
      const memoDataStr = localStorage.getItem(`memo_lot_${lot}`);
      const memoData = memoDataStr ? JSON.parse(memoDataStr) : {};
      
      moveToTrash({
        id: `lot_${lot}`,
        type: 'purchase_lot',
        title: `Purchase Lot ${lot}`,
        data: memoData
      });

      const newLots = lots.filter(l => l !== lot);
      setLots(newLots);
      localStorage.setItem('purchase_lots_list', JSON.stringify(newLots));
      localStorage.removeItem(`memo_lot_${lot}`);
    }
  };

    const filteredLots = lots.filter(lot => {
    if (!searchQuery) return true;
    
    const memoDataStr = localStorage.getItem(`memo_lot_${lot}`);
    let supplierName = '';
    if (memoDataStr) {
      try {
        const memo = JSON.parse(memoDataStr);
        supplierName = memo.supplierName || '';
      } catch (e) {}
    }
    
    const query = searchQuery.toLowerCase();
    return lot.toString().includes(query) || supplierName.toLowerCase().includes(query);
  });

  // Calculate total due across all purchase lots
  const totalPurchaseDue = lots.reduce((total, lot) => {
    const memoDataStr = localStorage.getItem(`memo_lot_${lot}`);
    if (memoDataStr) {
      try {
        const memo = JSON.parse(memoDataStr);
        const lotTotalAmount = Number(memo.totalPriceMain) || 0;
        const lotPaidAmount = Number(memo.paidAmount) || 0;
        const lotDue = lotTotalAmount - lotPaidAmount;
        if (lotDue > 0) {
          return total + lotDue;
        }
      } catch (e) {}
    }
    return total;
  }, 0);

  return (
    <div className="lots-screen">
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={24} />
          </button>
          <h2>{t('lotsList')}</h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
          {totalPurchaseDue > 0 && (
            <div style={{ border: '1px solid #ff5252', padding: '0.4rem 1rem', borderRadius: '4px', color: '#ff5252', fontWeight: 'bold', background: 'rgba(255, 82, 82, 0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem' }}>Total Due:</span> 
              <span>{totalPurchaseDue.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>
            <Search size={18} opacity={0.7} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Lots..."
              style={{ 
                background: 'transparent', 
                color: '#fff', 
                border: 'none', 
                outline: 'none',
                padding: '0.2rem',
                width: '150px'
              }}
            />
          </div>
        </div>
      </div>

      <div className="lot-grid">
        {filteredLots.map(lot => {
          const memoDataStr = localStorage.getItem(`memo_lot_${lot}`);
          let supplierName = '';
          let totalAmount = 0;
          let paidAmount = 0;
          let dueAmount = 0;
          if (memoDataStr) {
            try {
              const memo = JSON.parse(memoDataStr);
              supplierName = memo.supplierName || '';
              totalAmount = Number(memo.totalPriceMain) || 0;
              paidAmount = Number(memo.paidAmount) || 0;
              dueAmount = totalAmount - paidAmount;
            } catch (e) {}
          }

          return (
            <ProtectedMemoWrapper key={lot} passwordKey={`lot_password_${lot}`} onAccessGranted={() => onSelectLot(lot)}>
            <div className="lot-card">
                  <div className="lot-card-header">
                    <Package size={40} className="lot-icon" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="lot-status">{t('activeLot')}</span>
                    </div>
                    <div className="card-top-actions">
                        <button className="btn-icon delete-btn" onClick={(e) => handleDeleteLot(lot, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                      <MemoLockIcon passwordKey={`lot_password_${lot}`} />
                    </div>
                  </div>
                  <div className="lot-card-body">
                    <h3>{t('lotPrefix')} {lot.toString().padStart(2, '0')}</h3>
                    {supplierName && (
                      <div style={{ fontSize: '0.95rem', color: '#ffb74d', marginBottom: '0.2rem', fontWeight: 500 }}>
                        {supplierName}
                      </div>
                    )}
                    {(supplierName && totalAmount > 0) ? (
                      <div style={{ marginBottom: '0.5rem' }}>
                        {dueAmount <= 0 ? (
                          <span style={{ display: 'inline-block', background: '#72be44', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Paid</span>
                        ) : (
                          <span style={{ display: 'inline-block', background: '#ff5252', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>Due: {dueAmount.toFixed(2)}</span>
                        )}
                      </div>
                    ) : null}
                    <div className="lot-date">
                      <Calendar size={14} /> 
                      <span>{today}</span>
                    </div>
                  </div>
            </div>
            </ProtectedMemoWrapper>
          );
        })}
        
        <div className="lot-card add-lot-card" onClick={handleAddLot}>
            <div className="add-lot-content">
              <Plus size={48} />
              <h3>{t('newLot')}</h3>
            </div>
          </div>
      </div>

      {showNewLotModal && (
        <div className="modal-overlay" onClick={() => setShowNewLotModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">লটের পাসওয়ার্ড সেট করুন</h2>
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>পাসওয়ার্ড (ঐচ্ছিক)</label>
              <input 
                type="password" 
                value={newLotPassword}
                onChange={(e) => setNewLotPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন..."
                className="modal-input"
                autoFocus
              />
            </div>
            
            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => confirmAddLot(true)} style={{ flex: 1 }}>
                Skip (পাসওয়ার্ড ছাড়া)
              </button>
              <button className="btn btn-primary" onClick={() => confirmAddLot(false)} style={{ flex: 1 }}>
                লট তৈরি করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LotsScreen;







