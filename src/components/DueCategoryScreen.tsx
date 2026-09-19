import React from 'react';
import { type Screen } from '../App';
import { ChevronLeft, ShoppingCart, ShoppingBag } from 'lucide-react';

interface DueCategoryScreenProps {
  onNavigate: (screen: Screen) => void;
}

const DueCategoryScreen: React.FC<DueCategoryScreenProps> = ({ onNavigate }) => {
  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <h2>বকেয়া হিসাব (Due Account)</h2>
      </div>

      <div className="card-grid" style={{ marginTop: '2rem' }}>
        <div className="dashboard-card action-card" onClick={() => onNavigate('due-types')}>
          <ShoppingCart size={48} className="card-icon" />
          <h3>বিক্রয় বকেয়া</h3>
        </div>
        
        <div className="dashboard-card action-card" onClick={() => onNavigate('due-purchase-list')}>
          <ShoppingBag size={48} className="card-icon" />
          <h3>ক্রয় বকেয়া</h3>
        </div>
      </div>
    </div>
  );
};

export default DueCategoryScreen;
