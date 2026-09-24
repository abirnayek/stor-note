import React from 'react';
import { ShoppingCart, Clock, ShoppingBag, TrendingUp } from 'lucide-react';
import { type Screen } from '../App';
import { useLanguage } from '../i18n/LanguageContext';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t } = useLanguage();

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
        
        <div className="dashboard-card" onClick={() => onNavigate('investor-password')}>
          <TrendingUp size={48} className="card-icon" />
          <h3>{t('investorAccount')}</h3>
        </div>
        
        <div className="dashboard-card action-card" onClick={() => onNavigate('lots')}>
          <ShoppingBag size={48} className="card-icon" />
          <h3>{t('purchaseAccount')}</h3>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
