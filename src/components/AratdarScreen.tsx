import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Plus, Search, Trash2, UserCheck, CheckCircle2, AlertCircle, Calendar, FileText } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getAllGlobalSalesMemos, getAratdarMemos, type SalesMemoGlobalItem } from '../utils/dueSyncUtils';
import { moveToTrash } from '../utils/trashUtils';
import { ProtectedMemoWrapper } from './MemoLock';

interface AratdarScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
  onBack?: () => void;
}

const AratdarScreen: React.FC<AratdarScreenProps> = ({ onNavigate, onSelectMemo, onBack }) => {
  const [memos, setMemos] = useState<SalesMemoGlobalItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'paid'>('all');
  const { language } = useLanguage();

  const loadMemos = () => {
    const list = getAratdarMemos();
    setMemos(list);
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
      customerType: 'permanent',
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
      ? `আপনি কি "${memo.name || 'মেমো #' + memo.id}" আড়তদার মেমোটি মুছে ট্র্যাশে পাঠাতে চান?`
      : `Are you sure you want to move Aratdar Memo "${memo.name || '#' + memo.id}" to Trash?`;

    if (window.confirm(confirmMsg)) {
      const canonicalKey = `sales_memo_${memo.id}`;
      const memoDataStr = localStorage.getItem(canonicalKey) || localStorage.getItem(`due_memo_${memo.id}`);

      if (memoDataStr) {
        try {
          moveToTrash({
            id: canonicalKey,
            type: 'sales_lot',
            title: `Aratdar Memo - ${memo.name || '#' + memo.id}`,
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
          <button
            key="btn-back-aratdar"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              if (onBack) {
                onBack();
              } else {
                onNavigate('sales-lots');
              }
            }}
            title="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: 'rgba(171, 71, 188, 0.15)', border: '1px solid rgba(171, 71, 188, 0.3)', borderRadius: '10px', padding: '6px', display: 'flex' }}>
              <UserCheck size={24} style={{ color: '#ce93d8' }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{language === 'bn' ? 'আড়তদারের মেমো' : 'Aratdar Memos'}</h2>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>{language === 'bn' ? 'আড়তদারের সকল বিক্রয় মেমো ও হিসাব' : 'Aratdar Sales & Memos'}</span>
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

          {/* Add New Memo Button */}
          <button
            onClick={handleAddMemo}
            className="btn-primary"
            style={{
              background: 'linear-gradient(135deg, #8e24aa, #ab47bc)',
              color: '#ffffff',
              fontWeight: 'bold',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(171, 71, 188, 0.3)'
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
            {language === 'bn' ? 'মোট আড়তদার মেমো' : 'Total Aratdar Memos'}
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
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ce93d8' }}>
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
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#72be44' }}>
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
            background: statusFilter === 'all' ? '#ab47bc' : 'rgba(255,255,255,0.06)',
            color: statusFilter === 'all' ? '#ffffff' : '#bbb',
            border: statusFilter === 'all' ? '1px solid #ab47bc' : '1px solid rgba(255,255,255,0.15)',
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
            <div style={{ background: 'rgba(171, 71, 188, 0.1)', borderRadius: '50%', padding: '1.2rem', color: '#ce93d8' }}>
              <UserCheck size={48} />
            </div>
            <div style={{ maxWidth: '420px' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.2rem' }}>
                {language === 'bn' ? 'কোনো আড়তদার মেমো পাওয়া যায়নি' : 'No Aratdar Memos Found'}
              </h3>
              <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {language === 'bn'
                  ? 'নতুন মেমো তৈরি করতে উপরের "+ নতুন মেমো" বাটনে চাপুন, অথবা যেকোনো বিক্রয় মেমোতে ধরন হিসেবে "আড়তদারের কাছে বিক্রয়" নির্বাচন করুন।'
                  : 'Click "+ New Memo" above or select "Aratdar" as the customer type on any sales memo to see it here.'}
              </p>
            </div>
            <button
              onClick={handleAddMemo}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #8e24aa, #ab47bc)',
                color: '#ffffff',
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
              <span>{language === 'bn' ? '+ নতুন আড়তদার মেমো তৈরি করুন' : '+ Create Aratdar Memo'}</span>
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
            marginTop: 0,
            padding: '1rem 0'
          }}>
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
                      border: isDue ? '1px solid rgba(255, 152, 0, 0.45)' : (isPaid ? '1px solid rgba(114, 190, 68, 0.45)' : '1px solid var(--border-color)'),
                      borderRadius: '14px',
                      padding: '1.15rem 1.25rem',
                      background: 'rgba(18, 48, 32, 0.85)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.9rem',
                      minHeight: 'auto',
                      height: 'auto',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Header line of card */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span
                          title={`Memo #${memo.id}`}
                          style={{
                            background: 'rgba(171, 71, 188, 0.2)',
                            color: '#ce93d8',
                            border: '1px solid rgba(171, 71, 188, 0.4)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          #{memo.id.length > 8 ? memo.id.slice(-6) : memo.id}
                        </span>
                        {memo.lotNumber && (
                          <span style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '6px',
                            padding: '2px 7px',
                            fontSize: '0.72rem',
                            whiteSpace: 'nowrap'
                          }}>
                            Lot {memo.lotNumber}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                            gap: '4px',
                            whiteSpace: 'nowrap'
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
                            gap: '4px',
                            whiteSpace: 'nowrap'
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
                            fontSize: '0.72rem',
                            whiteSpace: 'nowrap'
                          }}>
                            {language === 'bn' ? 'খসড়া' : 'Draft'}
                          </span>
                        )}

                        <button
                          className="btn-icon delete-btn"
                          title="Delete Memo"
                          onClick={(e) => handleDeleteMemo(memo, e)}
                          style={{
                            margin: 0,
                            padding: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: '#ff5252',
                            cursor: 'pointer',
                            opacity: 0.75,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div style={{ width: '100%' }}>
                      <div style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#ffffff',
                        wordBreak: 'break-word',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px'
                      }}>
                        <FileText size={17} style={{ color: '#ce93d8', opacity: 0.9, flexShrink: 0 }} />
                        <span>{memo.name || (language === 'bn' ? 'বেনামী আড়তদার' : 'Unnamed Aratdar')}</span>
                      </div>
                      {memo.dateStr && (
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '4px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={12} style={{ opacity: 0.7 }} />
                          <span>{memo.dateStr}</span>
                          {memo.timeStr && <span>• {memo.timeStr}</span>}
                        </div>
                      )}
                    </div>

                    {/* Financial summary bar inside card */}
                    <div style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: '6px',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {language === 'bn' ? 'মোট বিল' : 'Total Bill'}
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          ৳ {memo.totalAmount ? formatNumber(memo.totalAmount) : '0.00'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '0 4px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {language === 'bn' ? 'জমা' : 'Paid'}
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#4ade80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                          ৳ {memo.paidAmount ? formatNumber(memo.paidAmount) : '0.00'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {language === 'bn' ? 'বাকি' : 'Due'}
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: memo.dueAmount > 0 ? '#fb923c' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
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

export default AratdarScreen;
