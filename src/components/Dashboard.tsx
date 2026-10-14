import React from 'react';
import { ShoppingCart, Clock, ShoppingBag, TrendingUp, Package, Users, Lock } from 'lucide-react';
import { type Screen } from '../App';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const devicePermission = localStorage.getItem('device_permission') || 'admin';
  const isViewer = devicePermission === 'view';

  const handleProtectedNavigate = (screen: Screen, sectionNameBn: string) => {
    if (isViewer) {
      alert(
        language === 'bn'
          ? `ভিউয়ার (Viewer) পারমিশনে ${sectionNameBn} দেখার অনুমতি নেই।`
          : `Viewer permission does not have access to view ${sectionNameBn}.`
      );
      return;
    }
    onNavigate(screen);
  };

  return (
    <div className="dashboard">
      <div className="card-grid">
        <div className="dashboard-card" onClick={() => onNavigate('sales-lots')}>
          <ShoppingCart size={48} className="card-icon" />
          <h3>{t('salesAccount')}</h3>
        </div>
        
        <div className="dashboard-card" onClick={() => onNavigate('due-category')}>
          <Clock size={48} className="card-icon" />
          <h3>{t('dueAccount')}</h3>
        </div>

        <div 
          className="dashboard-card" 
          onClick={() => handleProtectedNavigate('reseller-password', 'রিসেলার হিসাব')}
          style={{ position: 'relative', opacity: isViewer ? 0.7 : 1 }}
        >
          {isViewer && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(255, 82, 82, 0.25)',
              border: '1px solid rgba(255, 82, 82, 0.5)',
              color: '#ff8a80',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Lock size={12} /> {language === 'bn' ? 'অনুমতি নেই' : 'No Access'}
            </div>
          )}
          <Users size={48} className="card-icon" />
          <h3>{t('resellerAccount')}</h3>
        </div>
        
        <div 
          className="dashboard-card" 
          onClick={() => handleProtectedNavigate('investor-password', 'বিনিয়োগকারী হিসাব')}
          style={{ position: 'relative', opacity: isViewer ? 0.7 : 1 }}
        >
          {isViewer && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(255, 82, 82, 0.25)',
              border: '1px solid rgba(255, 82, 82, 0.5)',
              color: '#ff8a80',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Lock size={12} /> {language === 'bn' ? 'অনুমতি নেই' : 'No Access'}
            </div>
          )}
          <TrendingUp size={48} className="card-icon" />
          <h3>{t('investorAccount')}</h3>
        </div>
        
        <div 
          className="dashboard-card" 
          onClick={() => handleProtectedNavigate('password', 'ক্রয় হিসাব')}
          style={{ position: 'relative', opacity: isViewer ? 0.7 : 1 }}
        >
          {isViewer && (
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(255, 82, 82, 0.25)',
              border: '1px solid rgba(255, 82, 82, 0.5)',
              color: '#ff8a80',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Lock size={12} /> {language === 'bn' ? 'অনুমতি নেই' : 'No Access'}
            </div>
          )}
          <ShoppingBag size={48} className="card-icon" />
          <h3>{t('purchaseAccount')}</h3>
        </div>

        <div className="dashboard-card" onClick={() => onNavigate('stock')}>
          <Package size={48} className="card-icon" />
          <h3>{t('stockAccount')}</h3>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
