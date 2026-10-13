import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Search, Trash2, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getAllGlobalSalesMemos, getResellerMemos, type SalesMemoGlobalItem } from '../utils/dueSyncUtils';
import { moveToTrash } from '../utils/trashUtils';
import { ProtectedMemoWrapper } from './MemoLock';

interface ResellerScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
}

const ResellerScreen: React.FC<ResellerScreenProps> = ({ onNavigate, onSelectMemo }) => {
  const [memos, setMemos] = useState<SalesMemoGlobalItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'paid'>('all');
  const { t, language } = useLanguage();

  const loadMemos = () => {
    const resellerList = getResellerMemos();
    setMemos(resellerList);
  };

  useEffect(() => {
    loadMemos();
    window.addEventListener('storage', loadMemos);
    return () => window.removeEventListener('storage', loadMemos);
  }, []);

  const handleAddMemo = () => {
    let nextId = Date.now().toString();
    const allGlobal = getAllGlobalSalesMemos();
    const numericIds = allGlobal.map(m => Number(m.id)).filter(n => !isNaN(n) && n > 0 && n < 1000000000);
    if (numericIds.length > 0) {
      nextId = (Math.max(...numericIds) + 1).toString();
    } else {
      nextId = '1';
    }

    const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const initialState = {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: '',
      lotNumber: '',
      paidAmount: '',
      customerType: 'reseller',
      status: 'draft',
      createdAt: today,
      createdAtTime: currentTime,
      sellerSignature: localStorage.getItem('default_seller_signature') || '',
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', profitPercent: '' }]
    };

    localStorage.setItem(`sales_memo_${nextId}`, JSON.stringify(initialState));

    try {
      const tsRaw = localStorage.getItem('local_timestamps');
      let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
      tsMap[`sales_memo_${nextId}`] = Date.now();
      localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
    } catch (e) {}

    window.dispatchEvent(new Event('storage'));
    onSelectMemo(nextId, null);
  };

  const handleDeleteMemo = (memo: SalesMemoGlobalItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${memo.name || 'মেমো #' + memo.id}" রিসেলার মেমোটি মুছে ট্র্যাশে পাঠাতে চান?`
      : `Are you sure you want to move Reseller Memo "${memo.name || '#' + memo.id}" to Trash?`;

    if (window.confirm(confirmMsg)) {
      const canonicalKey = `sales_memo_${memo.id}`;
      const memoDataStr = localStorage.getItem(canonicalKey) || localStorage.getItem(`due_memo_${memo.id}`);

      if (memoDataStr) {
        try {
          moveToTrash({
            id: canonicalKey,
            type: 'sales_lot',
            title: `Reseller Memo - ${memo.name || '#' + memo.id}`,
            data: JSON.parse(memoDataStr)
          });
        } catch (err) {}
      }

      localStorage.removeItem(canonicalKey);
      localStorage.removeItem(`due_memo_${memo.id}`);
      localStorage.removeItem(`sales_memo_lot_unassigned_memo_${memo.id}`);
      if (memo.lotNumber) {
        localStorage.removeItem(`sales_memo_lot_${memo.lotNumber}_memo_${memo.id}`);
      }

      setMemos(prev => prev.filter(m => m.id !== memo.id));
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Filtered memos
  const filteredMemos = memos.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.dateStr && m.dateStr.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter === 'due') {
      matchesStatus = m.status === 'due' || m.dueAmount > 0;
    } else if (statusFilter === 'paid') {
      matchesStatus = m.status === 'paid' && m.dueAmount <= 0;
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalSales = memos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const totalPaid = memos.reduce((sum, m) => sum + (m.paidAmount || 0), 0);
  const totalDue = memos.reduce((sum, m) => sum + (m.dueAmount || 0), 0);

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="lots-screen" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-icon" onClick={() => onNavigate('dashboard')} title="Back to Dashboard">
            <ChevronLeft size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: 'rgba(0, 230, 118, 0.15)', border: '1px solid rgba(0, 230, 118, 0.3)', borderRadius: '10px', padding: '6px', display: 'flex' }}>
              <Users size={24} style={{ color: '#00e676' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{t('reseller') || 'রিসেলার'}</h2>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{language === 'bn' ? 'রিসেলার মেমো তালিকা ও হিসাব' : 'Reseller Sales & Memos'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', color: '#888' }} />
            <input
              type="text"
              placeholder={language === 'bn' ? 'নাম বা মেমো নং দিয়ে খুঁজুন...' : 'Search name or memo #...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.45rem 0.8rem 0.45rem 2.2rem',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                width: '210px'
              }}
            />
          </div>

          {/* Add New Reseller Memo Button */}
          <button
            onClick={handleAddMemo}
            className="btn-primary"
            style={{
              background: 'linear-gradient(135deg, #00c853, #00e676)',
              color: '#003300',
              fontWeight: 'bold',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 230, 118, 0.3)'
            }}
          >
            <Plus size={18} />
            <span>{language === 'bn' ? '+ নতুন মেমো' : '+ New Memo'}</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginTop: '1.5rem'
      }}>
        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট মেমো' : 'Total Memos'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff' }}>
            {memos.length}
          </span>
        </div>

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট বিক্রয়' : 'Total Sales'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#72be44' }}>
            ৳ {formatNumber(totalSales)}
          </span>
        </div>

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট জমা (পরিশোধ)' : 'Total Paid'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#00e676' }}>
            ৳ {formatNumber(totalPaid)}
          </span>
        </div>

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: totalDue > 0 ? '1px solid rgba(255, 152, 0, 0.4)' : '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট বাকি' : 'Total Due'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: totalDue > 0 ? '#ff9800' : '#888' }}>
            ৳ {formatNumber(totalDue)}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setStatusFilter('all')}
          style={{
            background: statusFilter === 'all' ? '#00e676' : 'rgba(255,255,255,0.06)',
            color: statusFilter === 'all' ? '#003300' : '#bbb',
            border: statusFilter === 'all' ? '1px solid #00e676' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {language === 'bn' ? 'সব' : 'All'} ({memos.length})
        </button>

        <button
          onClick={() => setStatusFilter('due')}
          style={{
            background: statusFilter === 'due' ? '#ff9800' : 'rgba(255,255,255,0.06)',
            color: statusFilter === 'due' ? '#000' : '#bbb',
            border: statusFilter === 'due' ? '1px solid #ff9800' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {language === 'bn' ? 'বকেয়া' : 'Due'} ({memos.filter(m => m.status === 'due' || m.dueAmount > 0).length})
        </button>

        <button
          onClick={() => setStatusFilter('paid')}
          style={{
            background: statusFilter === 'paid' ? '#72be44' : 'rgba(255,255,255,0.06)',
            color: statusFilter === 'paid' ? '#000' : '#bbb',
            border: statusFilter === 'paid' ? '1px solid #72be44' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '20px',
            padding: '5px 14px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {language === 'bn' ? 'পরিশোধিত' : 'Paid'} ({memos.filter(m => m.status === 'paid' && m.dueAmount <= 0).length})
        </button>
      </div>

      {/* Memos List */}
      <div style={{ marginTop: '1.5rem' }}>
        {filteredMemos.length === 0 ? (
          <div style={{
            background: 'rgba(18, 48, 32, 0.4)',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '3rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{ background: 'rgba(0, 230, 118, 0.1)', borderRadius: '50%', padding: '1.2rem', color: '#00e676' }}>
              <Users size={48} />
            </div>
            <div style={{ maxWidth: '420px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.2rem' }}>
                {language === 'bn' ? 'কোনো রিসেলার মেমো পাওয়া যায়নি' : 'No Reseller Memos Found'}
              </h3>
              <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {language === 'bn'
                  ? 'নতুন মেমো তৈরি করতে উপরের "+ নতুন মেমো" বাটনে চাপুন, অথবা যেকোনো বিক্রয় মেমোতে ধরন হিসেবে "রিসেলার" নির্বাচন করুন।'
                  : 'Click "+ New Memo" above or select "Reseller" as the customer type on any sales memo to see it here.'}
              </p>
            </div>
            <button
              onClick={handleAddMemo}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #00c853, #00e676)',
                color: '#003300',
                fontWeight: 'bold',
                border: 'none',
                padding: '0.6rem 1.4rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '0.5rem'
              }}
            >
              <Plus size={18} />
              <span>{language === 'bn' ? '+ নতুন রিসেলার মেমো তৈরি করুন' : '+ Create Reseller Memo'}</span>
            </button>
          </div>
        ) : (
          <div className="lot-grid" style={{ marginTop: 0 }}>
            {filteredMemos.map(memo => {
              const isDue = memo.status === 'due' || memo.dueAmount > 0;
              const isPaid = memo.status === 'paid' && memo.dueAmount <= 0;

              return (
                <ProtectedMemoWrapper
                  key={memo.id}
                  passwordKey={`memo_password_sales_memo_${memo.id}`}
                  onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber)}
                >
                  <div
                    className="lot-card action-card"
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: isDue ? '1px solid rgba(255, 152, 0, 0.35)' : '1px solid var(--border-color)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Header line of card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          background: 'rgba(0, 230, 118, 0.15)',
                          color: '#00e676',
                          border: '1px solid rgba(0, 230, 118, 0.3)',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}>
                          #{memo.id}
                        </span>
                        {memo.lotNumber && (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#bbb',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '0.72rem'
                          }}>
                            Lot {memo.lotNumber}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isPaid && (
                          <span style={{
                            background: 'rgba(114, 190, 68, 0.2)',
                            color: '#72be44',
                            border: '1px solid rgba(114, 190, 68, 0.4)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={12} /> {language === 'bn' ? 'পরিশোধিত' : 'Paid'}
                          </span>
                        )}
                        {isDue && (
                          <span style={{
                            background: 'rgba(255, 152, 0, 0.18)',
                            color: '#ff9800',
                            border: '1px solid rgba(255, 152, 0, 0.4)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <AlertCircle size={12} /> {language === 'bn' ? 'বকেয়া' : 'Due'}
                          </span>
                        )}
                        {!isPaid && !isDue && (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#aaa',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.72rem'
                          }}>
                            {language === 'bn' ? 'খসড়া' : 'Draft'}
                          </span>
                        )}

                        <button
                          className="btn-icon delete-btn"
                          title="Delete Memo"
                          onClick={(e) => handleDeleteMemo(memo, e)}
                          style={{ margin: 0, padding: '4px', opacity: 0.6 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div style={{ width: '100%', marginBottom: '0.8rem' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', wordBreak: 'break-word', textAlign: 'left' }}>
                        {memo.name || (language === 'bn' ? 'বেনামী রিসেলার' : 'Unnamed Reseller')}
                      </div>
                      {memo.dateStr && (
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px', textAlign: 'left' }}>
                          📅 {memo.dateStr} {memo.timeStr ? `• ${memo.timeStr}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Financial summary bar inside card */}
                    <div style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.72rem', color: '#aaa' }}>{language === 'bn' ? 'মোট বিল' : 'Total Bill'}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                          ৳ {memo.totalAmount ? formatNumber(memo.totalAmount) : '0.00'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: '#aaa' }}>{language === 'bn' ? 'জমা' : 'Paid'}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#72be44' }}>
                          ৳ {memo.paidAmount ? formatNumber(memo.paidAmount) : '0.00'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span style={{ fontSize: '0.72rem', color: '#aaa' }}>{language === 'bn' ? 'বাকি' : 'Due'}</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: memo.dueAmount > 0 ? '#ff9800' : '#888' }}>
                          ৳ {memo.dueAmount ? formatNumber(memo.dueAmount) : '0.00'}
                        </span>
                      </div>
                    </div>
                  </div>
                </ProtectedMemoWrapper>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResellerScreen;
