import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Trash2, FolderOpen } from 'lucide-react';
import { moveToTrash } from '../utils/trashUtils';
import { useLanguage } from '../i18n/LanguageContext';

interface InvestorListScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectInvestor: (investorId: string) => void;
}

const InvestorListScreen: React.FC<InvestorListScreenProps> = ({ onNavigate, onSelectInvestor }) => {
  const [investors, setInvestors] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const { t } = useLanguage();

  useEffect(() => {
    const saved = localStorage.getItem('investor_list');
    if (saved) {
      const parsed = JSON.parse(saved);
      setInvestors(parsed);
      
      const profs: Record<string, any> = {};
      parsed.forEach((id: string) => {
        const profStr = localStorage.getItem(`investor_profile_${id}`);
        if (profStr) {
          try { profs[id] = JSON.parse(profStr); } catch (e) {}
        }
      });
      setProfiles(profs);
    }
  }, []);

  const handleAddInvestor = () => {
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
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('deleteInvestorPrompt'))) return;
    
    const profile = profiles[id] || {};
    moveToTrash({ id, type: 'investor_folder', title: `Investor Folder: ${profile.name || 'Unknown'}`, data: profile });
    
    const newList = investors.filter(i => i !== id);
    setInvestors(newList);
    localStorage.setItem('investor_list', JSON.stringify(newList));
    // Not deleting all memos here to keep it simple, but they are detached.
  };

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <h2>{t('investorAccount')}</h2>
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
          {investors.length === 0 ? t('noInvestor') : `${investors.length} ${t('investorsCount')}`}
        </div>
      </div>

      <div className="lot-grid" style={{ marginTop: '2rem' }}>
        {investors.map(id => {
          const profile = profiles[id] || { name: t('newInvestorFolder') };
          
          return (
            <div key={id} className="lot-card" onClick={() => onSelectInvestor(id)}>
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
                <button className="btn-icon delete-btn" onClick={(e) => handleDelete(id, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        <div className="lot-card empty-card" onClick={handleAddInvestor}>
          <Plus size={48} className="card-icon" style={{ opacity: 0.3 }} />
          <h3 style={{ opacity: 0.5 }}>{t('newInvestorFolder')}</h3>
        </div>
      </div>
    </div>
  );
};

export default InvestorListScreen;
