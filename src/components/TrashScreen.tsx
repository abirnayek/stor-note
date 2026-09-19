import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { getTrashItems, type TrashedItem, restoreFromTrash, permanentlyDeleteFromTrash, cleanupTrash } from '../utils/trashUtils';

interface TrashScreenProps {
  onNavigate: (screen: Screen) => void;
}

const TrashScreen: React.FC<TrashScreenProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<TrashedItem[]>([]);

  useEffect(() => {
    // Run cleanup on mount
    cleanupTrash();
    setItems(getTrashItems());
  }, []);

  const handleRestore = (item: TrashedItem) => {
    if (window.confirm(`Are you sure you want to restore "${item.title}"?`)) {
      restoreFromTrash(item);
      setItems(getTrashItems());
    }
  };

  const handlePermanentDelete = (id: string) => {
    if (window.confirm('Are you sure you want to PERMANENTLY delete this? This cannot be undone.')) {
      permanentlyDeleteFromTrash(id);
      setItems(getTrashItems());
    }
  };

  const getDaysRemaining = (deletedAt: number) => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const expiryDate = deletedAt + thirtyDaysMs;
    const remainingMs = expiryDate - Date.now();
    const days = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <div className="lots-screen">
      <div className="screen-header">
        <button className="btn-icon" onClick={() => onNavigate('dashboard')}>
          <ChevronLeft size={24} />
        </button>
        <h2>Trash Bin</h2>
        <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
          {items.length} Items
        </div>
      </div>

      <div style={{ padding: '1rem 2rem', color: '#ff9800', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 152, 0, 0.1)', margin: '1rem 2rem', borderRadius: '8px' }}>
        <AlertTriangle size={20} />
        <span>Items in the trash will be permanently deleted after 30 days.</span>
      </div>

      <div style={{ padding: '0 2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
            <Trash2 size={48} style={{ margin: '0 auto', marginBottom: '1rem' }} />
            <h3>Trash is empty</h3>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="lot-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row', width: '100%', padding: '1.5rem', cursor: 'default' }}>
              <div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>{item.title}</h3>
                <span style={{ fontSize: '0.9rem', color: '#888' }}>
                  Deleted on: {new Date(item.deletedAt).toLocaleDateString()} ({getDaysRemaining(item.deletedAt)} days remaining)
                </span>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn-primary btn-3d" 
                  style={{ background: '#72be44', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                  onClick={() => handleRestore(item)}
                >
                  <RefreshCw size={16} /> Restore
                </button>
                <button 
                  className="btn-primary btn-3d" 
                  style={{ background: '#ff5252', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                  onClick={() => handlePermanentDelete(item.id)}
                >
                  <Trash2 size={16} /> Delete Forever
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TrashScreen;
