import React, { useState, useEffect, useRef } from 'react';
import { type Screen } from '../App';
import { Plus, ChevronLeft, ChevronRight, Package, Calendar, Trash2, FileText, Folder, Store, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';
import { MONTHS, enToBnDigits } from '../utils/dateUtils';
import { getAllGlobalSalesMemos, deleteSalesMemoCompletely, moveSalesMemoToLot, type SalesMemoGlobalItem } from '../utils/dueSyncUtils';
import { useLanguage } from '../i18n/LanguageContext';

interface SalesLotsScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectLot: (lotNumber: number) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null) => void;
  onSelectMonth?: (monthIndex: number, year: number) => void;
}

type GlobalMemo = SalesMemoGlobalItem;

const SalesLotsScreen: React.FC<SalesLotsScreenProps> = ({ onNavigate, onSelectLot, onSelectMemo, onSelectMonth }) => {
  const [lots, setLots] = useState<number[]>(() => {
    const saved = localStorage.getItem('sales_lots_list');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [globalMemos, setGlobalMemos] = useState<GlobalMemo[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [showNewLotModal, setShowNewLotModal] = useState(false);
  const [newLotNumber, setNewLotNumber] = useState('');
  const [newLotPassword, setNewLotPassword] = useState('');
  const [viewMode, setViewMode] = useState<'both' | 'lots' | 'aratdar'>('both');
  const [memoFilter, setMemoFilter] = useState<'all' | 'lots' | 'aratdar' | 'reseller'>('all');
  const [draggedMemoId, setDraggedMemoId] = useState<string | null>(null);
  const [dragOverLotNumber, setDragOverLotNumber] = useState<number | null>(null);
  const [dropSuccessMsg, setDropSuccessMsg] = useState<string | null>(null);
  const { t, language } = useLanguage();
  const devicePermission = localStorage.getItem('device_permission');
  const hasEditPermission = devicePermission === 'edit' || devicePermission === 'admin';

  const lotScrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const scrollLots = (direction: 'left' | 'right') => {
    if (lotScrollRef.current) {
      const scrollAmount = 240;
      lotScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!lotScrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - lotScrollRef.current.offsetLeft);
    setScrollLeftState(lotScrollRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !lotScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - lotScrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    lotScrollRef.current.scrollLeft = scrollLeftState - walk;
  };
  
  const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const aratdarMemos = globalMemos.filter(m => m.customerType === 'permanent');
  const aratdarCount = aratdarMemos.length;
  const aratdarTotal = aratdarMemos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const aratdarDue = aratdarMemos.reduce((sum, m) => sum + (m.dueAmount || 0), 0);

  const resellerMemos = globalMemos.filter(m => m.customerType === 'reseller');
  const resellerCount = resellerMemos.length;
  const resellerTotal = resellerMemos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const resellerDue = resellerMemos.reduce((sum, m) => sum + (m.dueAmount || 0), 0);

  const lotMemosCount = globalMemos.filter(m => m.lotNumber !== null).length;

  const filteredGlobalMemos = globalMemos.filter(m => {
    if (memoFilter === 'lots') return m.lotNumber !== null;
    if (memoFilter === 'aratdar') return m.customerType === 'permanent';
    if (memoFilter === 'reseller') return m.customerType === 'reseller';
    return true;
  });

  const getMonthStats = (mIndex: number, yr: number) => {
    let count = 0;
    let totalAmount = 0;
    globalMemos.forEach(m => {
      if (m.month === mIndex && m.year === yr) {
        count++;
        totalAmount += m.totalAmount;
      }
    });
    return { count, totalAmount };
  };

  useEffect(() => {
    const loadGlobalMemos = () => {
      const allMemos = getAllGlobalSalesMemos();
      setGlobalMemos(allMemos);
    };

    loadGlobalMemos();

    window.addEventListener('storage', loadGlobalMemos);
    return () => window.removeEventListener('storage', loadGlobalMemos);
  }, [lots]);

  const handleMoveMemoToLot = (memoId: string, targetLot: number) => {
    const res = moveSalesMemoToLot(memoId, targetLot);
    const allMemos = getAllGlobalSalesMemos();
    setGlobalMemos(allMemos);
    const msg = language === 'bn'
      ? `"${res.memoTitle}" মেমোটি সফলভাবে লট নং ${targetLot}-এ স্থানান্তর করা হয়েছে!`
      : `Memo "${res.memoTitle}" moved to Lot #${targetLot} successfully!`;
    setDropSuccessMsg(msg);
    setTimeout(() => setDropSuccessMsg(null), 3500);
  };

  const handleAddLot = () => {
    const nextLot = lots.length > 0 ? Math.max(...lots) + 1 : 1;
    setNewLotNumber(nextLot.toString());
    setNewLotPassword('');
    setShowNewLotModal(true);
  };
  
  const handleAddMemo = () => {
    const listStr = localStorage.getItem(`sales_memo_list_unassigned`);
    const list = listStr ? JSON.parse(listStr) : [];
    const nextId = Date.now().toString();
    list.push(nextId);
    localStorage.setItem(`sales_memo_list_unassigned`, JSON.stringify(list));

    // Pre-initialize memo state
    const initialState = {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: '',
      paidAmount: '',
      customerType: 'regular',
      status: 'draft',
      createdAt: today,
      lastModified: Date.now(),
      sellerSignature: localStorage.getItem('default_seller_signature') || '',
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', profitPercent: '' }]
    };
    localStorage.setItem(`sales_memo_${nextId}`, JSON.stringify(initialState));
    localStorage.setItem(`sales_memo_lot_unassigned_memo_${nextId}`, JSON.stringify(initialState));

    onSelectMemo(nextId, null);
  };

  const confirmAddLot = (skipPassword = false) => {
    const parsedNum = parseInt(newLotNumber, 10);
    const targetLot = (!isNaN(parsedNum) && parsedNum > 0)
      ? parsedNum
      : (lots.length > 0 ? Math.max(...lots) + 1 : 1);

    if (!lots.includes(targetLot)) {
      const newLots = [...lots, targetLot].sort((a, b) => a - b);
      setLots(newLots);
      localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
    }
    
    if (!skipPassword && newLotPassword.trim() !== '') {
      localStorage.setItem(`sales_lot_password_${targetLot}`, newLotPassword.trim());
    }
    
    setShowNewLotModal(false);
    onSelectLot(targetLot);
  };

  const handleDeleteLot = (lot: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`লট নম্বর ${lot} ফোল্ডারটি ডিলিট করতে চান? এই লটের মেমোগুলো অক্ষত থাকবে এবং "সকল মেমো (Global List)" এ দেখতে পাবেন।`)) {
      const newLots = lots.filter(l => l !== lot);
      setLots(newLots);
      localStorage.setItem('sales_lots_list', JSON.stringify(newLots));
      localStorage.removeItem(`sales_lot_password_${lot}`);
      window.dispatchEvent(new Event('storage'));
    }
  };
  
  const handleDeleteMemo = (memo: GlobalMemo, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${memo.name || 'মেমো #' + memo.id}" মেমোটি মুছে ট্র্যাশে পাঠাতে চান?`
      : `Are you sure you want to delete memo "${memo.name || '#' + memo.id}" and move to Trash?`;
    if (window.confirm(confirmMsg)) {
      deleteSalesMemoCompletely(memo.id, { name: memo.name, lotNumber: memo.lotNumber });
      setGlobalMemos(prev => prev.filter(m => m.id !== memo.id));
    }
  };

  return (
    <div className="lots-screen" style={{ paddingBottom: '2rem' }}>
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            key="btn-back-sales-lots"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('dashboard');
            }}
            title="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <h2>{t('salesAccount')}</h2>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Total Lots</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{lots.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 152, 0, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', color: '#ff9800', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Total Memos</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffb74d' }}>{globalMemos.length}</div>
          </div>
        </div>
      </div>

      {/* Drop Success Notification Banner */}
      {dropSuccessMsg && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.95), rgba(76, 175, 80, 0.95))',
          color: '#fff',
          padding: '12px 18px',
          borderRadius: '12px',
          margin: '1rem 0 0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 4px 15px rgba(46, 125, 50, 0.4)',
          animation: 'fadeIn 0.3s ease'
        }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 600 }}>{dropSuccessMsg}</span>
        </div>
      )}

      {/* Top Section View Switcher Pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.25rem 0 0.8rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255, 255, 255, 0.05)', padding: '3px 4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={() => setViewMode('both')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'both' ? 'var(--primary-color)' : 'transparent',
              color: viewMode === 'both' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            সব (উভয়টি পাশাপাশি)
          </button>
          <button
            onClick={() => setViewMode('lots')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'lots' ? 'var(--primary-color)' : 'transparent',
              color: viewMode === 'lots' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            ফোল্ডার / লটসমূহ ({lots.length})
          </button>
          <button
            onClick={() => setViewMode('aratdar')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'aratdar' ? 'var(--primary-color)' : 'transparent',
              color: viewMode === 'aratdar' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            আড়তদার / রিসেলার ({aratdarCount + resellerCount})
          </button>
        </div>
      </div>

      {/* Side-by-Side Section with Vertical Glowing Red Divider */}
      <div className="sales-lots-split-container">
        {/* Left Column: ফোল্ডার / লটসমূহ (Horizontal Slider) */}
        {(viewMode === 'both' || viewMode === 'lots') && (
          <div style={{
            flex: viewMode === 'both' ? '1 1 58%' : '1 1 100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Lots Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={20} style={{ color: '#72be44' }} />
                <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1.1rem', fontWeight: 'bold' }}>
                  ফোল্ডার / লটসমূহ
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#72be44', background: 'rgba(114, 190, 68, 0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {language === 'bn' ? enToBnDigits(lots.length) : lots.length} টি লট
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  className="btn-icon"
                  onClick={() => scrollLots('left')}
                  title="বামে স্লাইড করুন"
                  style={{ padding: '3px 8px', margin: 0 }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="btn-icon"
                  onClick={() => scrollLots('right')}
                  title="ডানে স্লাইড করুন"
                  style={{ padding: '3px 8px', margin: 0 }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Lots Horizontal Sliding Track */}
            <div
              ref={lotScrollRef}
              className="custom-h-scrollbar"
              onMouseDown={handleMouseDown}
              onMouseLeave={handleMouseLeaveOrUp}
              onMouseUp={handleMouseLeaveOrUp}
              onMouseMove={handleMouseMove}
              style={{
                display: 'flex',
                gap: '1rem',
                overflowX: 'auto',
                flexWrap: 'nowrap',
                paddingBottom: '0.8rem',
                paddingTop: '0.2rem',
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: isDragging ? 'auto' : 'smooth',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: isDragging ? 'none' : 'auto'
              }}
            >
              {hasEditPermission && (
                <div
                  className="lot-card add-lot-card"
                  onClick={handleAddLot}
                  style={{
                    flex: '0 0 170px',
                    minWidth: '170px',
                    height: '160px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <div className="add-lot-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Package size={44} />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>ক্রিয়েট লট</h3>
                  </div>
                </div>
              )}

              {lots.map((lot, idx) => {
                const isDragOver = dragOverLotNumber === lot;
                return (
                  <ProtectedMemoWrapper 
                    key={`sales_lot_${lot}_${idx}`} 
                    passwordKey={`sales_lot_password_${lot}`} 
                    name={`লট নং ${lot}`}
                    type="lot"
                    onAccessGranted={() => onSelectLot(lot)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverLotNumber !== lot) setDragOverLotNumber(lot);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverLotNumber(lot);
                    }}
                    onDragLeave={(e) => {
                      e.stopPropagation();
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dragOverLotNumber === lot) setDragOverLotNumber(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const mId = e.dataTransfer.getData('application/memo-id') || e.dataTransfer.getData('text/plain') || draggedMemoId || (window as any).__draggedMemoId;
                      setDragOverLotNumber(null);
                      setDraggedMemoId(null);
                      (window as any).__draggedMemoId = null;
                      if (mId) handleMoveMemoToLot(mId, lot);
                    }}
                  >
                    <div
                      className="lot-card"
                      style={{
                        flex: '0 0 175px',
                        minWidth: '175px',
                        height: '160px',
                        padding: '1.1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxSizing: 'border-box',
                        position: 'relative',
                        border: isDragOver ? '2px dashed #ffb74d' : undefined,
                        boxShadow: isDragOver ? '0 0 20px rgba(255, 152, 0, 0.6)' : undefined,
                        transform: isDragOver ? 'scale(1.03)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Drag Over Drop Indicator Overlay */}
                      {isDragOver && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '12px',
                          background: 'rgba(230, 81, 0, 0.92)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          zIndex: 35,
                          pointerEvents: 'none',
                          backdropFilter: 'blur(3px)'
                        }}>
                          <Package size={36} style={{ color: '#fff' }} />
                          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.88rem', textAlign: 'center', padding: '0 4px' }}>
                            {language === 'bn' ? `লট ${lot}-এ ড্রপ করুন` : `Drop to Lot ${lot}`}
                          </span>
                        </div>
                      )}
                    <div className="lot-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Package size={36} className="lot-icon" />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span className="lot-status">{t('activeLot')}</span>
                      </div>
                      {hasEditPermission && (
                        <div className="card-top-actions">
                          <button className="btn-icon delete-btn" onClick={(e) => handleDeleteLot(lot, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                      <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                        <MemoLockIcon passwordKey={`sales_lot_password_${lot}`} />
                      </div>
                    </div>
                    <div className="lot-card-body" style={{ marginTop: 'auto' }}>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                        লট নাম্বার {lot.toString().padStart(2, '0')}
                      </h3>
                      <div className="lot-date" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#aaa' }}>
                        <Calendar size={13} />
                        <span>{today}</span>
                      </div>
                    </div>
                  </div>
                </ProtectedMemoWrapper>
              );
            })}
            </div>
          </div>
        )}

        {/* Center Glowing Red Line Divider matching user sketch */}
        {viewMode === 'both' && (
          <div
            className="split-divider"
            title="বিভাগ রেখা (Lots | Aratdar/Reseller)"
          />
        )}

        {/* Right Column: আড়তদার / রিসেলার */}
        {(viewMode === 'both' || viewMode === 'aratdar') && (
          <div style={{
            flex: viewMode === 'both' ? '0 0 380px' : '1 1 100%',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Aratdar/Reseller Column Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={20} style={{ color: '#ce93d8' }} />
                <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1.1rem', fontWeight: 'bold' }}>
                  আড়তদার / রিসেলার
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#ffb74d', background: 'rgba(255, 152, 0, 0.15)', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {language === 'bn' ? enToBnDigits(aratdarCount + resellerCount) : aratdarCount + resellerCount} টি মেমো
                </span>
              </div>
            </div>

            {/* Aratdar & Reseller Cards Track */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              paddingBottom: '0.8rem',
              paddingTop: '0.2rem'
            }} className="custom-h-scrollbar">
              {/* Card 1: আড়তদারের মেমো */}
              <div
                className="lot-card"
                onClick={() => onNavigate('aratdar')}
                style={{
                  flex: '1 1 175px',
                  minWidth: '170px',
                  height: '160px',
                  padding: '1.1rem',
                  background: 'linear-gradient(135deg, rgba(48, 22, 68, 0.85), rgba(22, 12, 38, 0.95))',
                  border: '1px solid rgba(171, 71, 188, 0.5)',
                  boxShadow: '0 4px 15px rgba(171, 71, 188, 0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box'
                }}
              >
                <div className="lot-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    background: 'rgba(171, 71, 188, 0.25)',
                    borderRadius: '10px',
                    padding: '7px',
                    color: '#ce93d8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Store size={22} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{
                      background: 'rgba(171, 71, 188, 0.3)',
                      color: '#e1bee7',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      border: '1px solid rgba(171, 71, 188, 0.4)'
                    }}>
                      {language === 'bn' ? enToBnDigits(aratdarCount) : aratdarCount} টি
                    </span>
                    <ArrowRight size={14} style={{ color: '#ce93d8' }} />
                  </div>
                </div>
                <div className="lot-card-body" style={{ marginTop: 'auto' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#f3e5f5', whiteSpace: 'nowrap' }}>
                    আড়তদারের মেমো
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ color: '#ce93d8', fontWeight: 'bold' }}>
                      ৳{Math.round(aratdarTotal).toLocaleString()}
                    </span>
                    {aratdarDue > 0 && (
                      <span style={{ color: '#ff8a80', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        বাকি: ৳{Math.round(aratdarDue).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: রিসেলার */}
              <div
                className="lot-card"
                onClick={() => onNavigate('reseller')}
                style={{
                  flex: '1 1 175px',
                  minWidth: '170px',
                  height: '160px',
                  padding: '1.1rem',
                  background: 'linear-gradient(135deg, rgba(16, 46, 74, 0.85), rgba(9, 24, 42, 0.95))',
                  border: '1px solid rgba(33, 150, 243, 0.5)',
                  boxShadow: '0 4px 15px rgba(33, 150, 243, 0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box'
                }}
              >
                <div className="lot-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    background: 'rgba(33, 150, 243, 0.25)',
                    borderRadius: '10px',
                    padding: '7px',
                    color: '#90caf9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Users size={22} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{
                      background: 'rgba(33, 150, 243, 0.3)',
                      color: '#bbdefb',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      border: '1px solid rgba(33, 150, 243, 0.4)'
                    }}>
                      {language === 'bn' ? enToBnDigits(resellerCount) : resellerCount} টি
                    </span>
                    <ArrowRight size={14} style={{ color: '#90caf9' }} />
                  </div>
                </div>
                <div className="lot-card-body" style={{ marginTop: 'auto' }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', color: '#e3f2fd', whiteSpace: 'nowrap' }}>
                    রিসেলার
                  </h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ color: '#90caf9', fontWeight: 'bold' }}>
                      ৳{Math.round(resellerTotal).toLocaleString()}
                    </span>
                    {resellerDue > 0 && (
                      <span style={{ color: '#ff8a80', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        বাকি: ৳{Math.round(resellerDue).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 12 Monthly Folders Ribbon/Grid */}
      <div className="screen-sub-container" style={{ margin: '1.5rem 0 1.2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calendar size={22} style={{ color: '#72be44' }} />
            <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1.15rem', fontWeight: 'bold' }}>
              {language === 'bn' ? `মাসভিত্তিক ফোল্ডারসমূহ (${enToBnDigits(selectedYear)})` : `Monthly Folders (${selectedYear})`}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '8px' }}>
            <button 
              className="btn-icon" 
              style={{ padding: '2px 6px', margin: 0, fontSize: '0.85rem' }}
              onClick={() => setSelectedYear(prev => prev - 1)}
              title="পূর্ববর্তী বছর"
            >
              ◀
            </button>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem', minWidth: '45px', textAlign: 'center' }}>
              {language === 'bn' ? enToBnDigits(selectedYear) : selectedYear}
            </span>
            <button 
              className="btn-icon" 
              style={{ padding: '2px 6px', margin: 0, fontSize: '0.85rem' }}
              onClick={() => setSelectedYear(prev => prev + 1)}
              title="পরবর্তী বছর"
            >
              ▶
            </button>
          </div>
        </div>

        {/* 12 Months Cards Scroll Container */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          overflowX: 'auto',
          paddingBottom: '0.8rem',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch'
        }}>
          {MONTHS.map(m => {
            const mStats = getMonthStats(m.index, selectedYear);
            return (
              <div
                key={m.index}
                onClick={() => onSelectMonth && onSelectMonth(m.index, selectedYear)}
                style={{
                  flex: '0 0 auto',
                  minWidth: '135px',
                  background: mStats.count > 0 
                    ? 'linear-gradient(135deg, rgba(20, 60, 40, 0.85), rgba(10, 35, 22, 0.95))' 
                    : 'rgba(255, 255, 255, 0.04)',
                  border: mStats.count > 0 
                    ? '1px solid rgba(114, 190, 68, 0.45)' 
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 'bold' }}>
                    {language === 'bn' ? enToBnDigits(m.index.toString().padStart(2, '0')) : m.index.toString().padStart(2, '0')}
                  </span>
                  <Folder size={18} style={{ color: mStats.count > 0 ? '#72be44' : '#666' }} />
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '0.98rem', color: '#fff' }}>
                  {language === 'bn' ? m.nameBn : m.nameEn}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.75rem', color: mStats.count > 0 ? '#72be44' : '#666', fontWeight: 'bold' }}>
                    {language === 'bn' ? enToBnDigits(mStats.count) : mStats.count} {language === 'bn' ? 'টি মেমো' : 'memos'}
                  </span>
                  {mStats.totalAmount > 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#ffb74d', fontWeight: 'bold' }}>
                      ৳{Math.round(mStats.totalAmount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Memos Header & Category Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1.5rem 0 0.8rem', flexWrap: 'wrap', gap: '0.8rem' }}>
        <h3 style={{ margin: 0, opacity: 0.9, fontSize: '1.15rem', fontWeight: 'bold' }}>
          সকল মেমো (Global List)
        </h3>

        <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255, 255, 255, 0.05)', padding: '3px 4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
          <button
            onClick={() => setMemoFilter('all')}
            style={{
              padding: '4px 10px',
              borderRadius: '7px',
              border: 'none',
              background: memoFilter === 'all' ? 'var(--primary-color)' : 'transparent',
              color: memoFilter === 'all' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            সব ({globalMemos.length})
          </button>
          <button
            onClick={() => setMemoFilter('lots')}
            style={{
              padding: '4px 10px',
              borderRadius: '7px',
              border: 'none',
              background: memoFilter === 'lots' ? 'var(--primary-color)' : 'transparent',
              color: memoFilter === 'lots' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            লট ভিত্তিক ({lotMemosCount})
          </button>
          <button
            onClick={() => setMemoFilter('aratdar')}
            style={{
              padding: '4px 10px',
              borderRadius: '7px',
              border: 'none',
              background: memoFilter === 'aratdar' ? '#ab47bc' : 'transparent',
              color: memoFilter === 'aratdar' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            আড়তদার ({aratdarCount})
          </button>
          <button
            onClick={() => setMemoFilter('reseller')}
            style={{
              padding: '4px 10px',
              borderRadius: '7px',
              border: 'none',
              background: memoFilter === 'reseller' ? '#2196f3' : 'transparent',
              color: memoFilter === 'reseller' ? '#fff' : '#aaa',
              fontWeight: 'bold',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            রিসেলার ({resellerCount})
          </button>
        </div>
      </div>
      
      <div className="lot-grid">
        {hasEditPermission && (
          <div className="lot-card add-lot-card" onClick={handleAddMemo}>
            <div className="add-lot-content">
              <Plus size={48} />
              <h3>নতুন মেমো</h3>
            </div>
          </div>
        )}

        {filteredGlobalMemos.map(memo => (
          <ProtectedMemoWrapper 
            key={memo.uniqueKey} 
            passwordKey={`memo_password_${memo.id}`} 
            name={memo.name || `মেমো #${memo.id}`}
            type="memo"
            onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber)}
          >
            <div 
              className="lot-card"
              draggable={true}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', memo.id);
                e.dataTransfer.setData('application/memo-id', memo.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedMemoId(memo.id);
                (window as any).__draggedMemoId = memo.id;
              }}
              onDragEnd={() => {
                setDraggedMemoId(null);
                setDragOverLotNumber(null);
                (window as any).__draggedMemoId = null;
              }}
              style={{
                cursor: 'grab',
                opacity: draggedMemoId === memo.id ? 0.35 : 1,
                boxShadow: draggedMemoId === memo.id ? '0 0 16px rgba(255, 183, 77, 0.5)' : undefined,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} style={{ opacity: 0.7 }} />
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{memo.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', background: `${memo.statusColor}33`, color: memo.statusColor, fontWeight: 'bold' }}>
                      {memo.statusText}
                    </span>
                    {memo.customerType === 'permanent' && (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(171, 71, 188, 0.25)', color: '#ce93d8', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(171, 71, 188, 0.4)' }}>
                        আড়তদার
                      </span>
                    )}
                    {memo.customerType === 'reseller' && (
                      <span style={{ fontSize: '0.75rem', background: 'rgba(33, 150, 243, 0.25)', color: '#90caf9', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', border: '1px solid rgba(33, 150, 243, 0.4)' }}>
                        রিসেলার
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                      Lot: {memo.lotNumber !== null ? memo.lotNumber : 'N/A'}
                    </span>
                    {memo.totalAmount > 0 && (
                      <span style={{ fontSize: '0.8rem', background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        ৳ {memo.totalAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {memo.dateStr && (
                    <div style={{ fontSize: '0.75rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={12} opacity={0.7} />
                      <span>{memo.dateStr}</span>
                      {memo.timeStr && <span>({memo.timeStr})</span>}
                    </div>
                  )}
                </div>
                {hasEditPermission && (
                  <div className="card-top-actions">
                    <button className="btn-icon delete-btn" onClick={(e) => handleDeleteMemo(memo, e)} style={{ padding: '4px', margin: 0, color: '#ff5252' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                <div className="card-bottom-actions" onClick={(e) => e.stopPropagation()}>
                  <MemoLockIcon passwordKey={`memo_password_${memo.id}`} />
                </div>
              </div>

              {/* Drag indicator chip */}
              <div style={{ marginTop: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                <span style={{ 
                  fontSize: '0.74rem', 
                  color: '#ffb74d', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px',
                  background: 'rgba(255, 152, 0, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px dashed rgba(255, 152, 0, 0.35)'
                }}>
                  <Package size={12} />
                  {language === 'bn' ? '+ ড্র্যাগ করে লটে রাখুন' : '+ Drag to Lot'}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  {memo.lotNumber !== null 
                    ? (language === 'bn' ? `বর্তমান: লট ${memo.lotNumber}` : `Current: Lot ${memo.lotNumber}`)
                    : (language === 'bn' ? 'লটবিহীন' : 'No Lot')}
                </span>
              </div>
            </div>
          </ProtectedMemoWrapper>
        ))}
      </div>


      {showNewLotModal && (
        <div className="modal-overlay" onClick={() => setShowNewLotModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">নতুন লট ফোল্ডার তৈরি করুন</h2>
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
              <label>লট নম্বর</label>
              <input 
                type="number" 
                value={newLotNumber}
                onChange={(e) => setNewLotNumber(e.target.value)}
                placeholder="লট নম্বর লিখুন (যেমন: 1, 2, 3)"
                className="modal-input"
                min="1"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>পাসওয়ার্ড (ঐচ্ছিক)</label>
              <input 
                type="password" 
                value={newLotPassword}
                onChange={(e) => setNewLotPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন..."
                className="modal-input"
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

export default SalesLotsScreen;



