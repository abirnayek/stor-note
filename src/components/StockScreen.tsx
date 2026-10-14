import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { ChevronLeft, Search, Package, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Layers, LayoutGrid, Table, Calendar, ArrowUpDown } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getAllLotsStock, type LotStockSummary, type FishStockItem } from '../utils/stockUtils';

interface StockScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectPurchaseLot?: (lotNumber: number) => void;
}

const StockScreen: React.FC<StockScreenProps> = ({ onNavigate, onSelectPurchaseLot }) => {
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<'cards' | 'detail'>('cards');
  const [selectedLot, setSelectedLot] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [sortBy, setSortBy] = useState<'running_out' | 'lot_serial' | 'remaining_asc' | 'remaining_desc'>('running_out');
  const [lotsStock, setLotsStock] = useState<LotStockSummary[]>([]);

  const loadStockData = () => {
    const data = getAllLotsStock();
    setLotsStock(data);
  };

  useEffect(() => {
    loadStockData();
    window.addEventListener('storage', loadStockData);
    return () => window.removeEventListener('storage', loadStockData);
  }, []);

  // Aggregated totals
  const totalPurchased = lotsStock.reduce((sum, lot) => sum + lot.totalPurchasedKg, 0);
  const totalSold = lotsStock.reduce((sum, lot) => sum + lot.totalSoldKg, 0);
  const totalRemaining = lotsStock.reduce((sum, lot) => sum + lot.totalRemainingKg, 0);
  const totalSoldPercent = totalPurchased > 0 ? Math.min(100, Math.round((totalSold / totalPurchased) * 100)) : 0;
  const totalRemainingPercent = Math.max(0, 100 - totalSoldPercent);

  // Count unique fish across all lots
  const uniqueFishNames = new Set<string>();
  lotsStock.forEach(lot => {
    lot.items.forEach(item => {
      if (item.name) uniqueFishNames.add(item.name.trim().toLowerCase());
    });
  });

  // Flatten items for filtering
  interface DisplayItem extends FishStockItem {
    lotNumber: number;
    supplierName: string;
    lotDate: string;
  }

  const allDisplayItems: DisplayItem[] = [];
  lotsStock.forEach(lot => {
    if (selectedLot === 'all' || lot.lotNumber === selectedLot) {
      lot.items.forEach(item => {
        allDisplayItems.push({
          ...item,
          lotNumber: lot.lotNumber,
          supplierName: lot.supplierName,
          lotDate: lot.date
        });
      });
    }
  });

  const filteredItems = allDisplayItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(item.lotNumber).includes(searchQuery) ||
      String(item.serialNo).includes(searchQuery);

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // RESTOCK PRIORITY SORTING: Items that are running out / low stock appear AT THE TOP!
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'lot_serial') {
      if (a.lotNumber !== b.lotNumber) return a.lotNumber - b.lotNumber;
      return a.serialNo - b.serialNo;
    }

    if (sortBy === 'remaining_asc') {
      if (a.remainingKg !== b.remainingKg) return a.remainingKg - b.remainingKg;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === 'remaining_desc') {
      if (b.remainingKg !== a.remainingKg) return b.remainingKg - a.remainingKg;
      return a.name.localeCompare(b.name);
    }

    // Default: 'running_out' (স্টক শেষ হতে চলেছে এমনগুলো সবার উপরে অগ্রাধিকার পাবে)
    const getPriority = (item: DisplayItem) => {
      // 1. কম স্টক (শেষের মাথায় / শেষ হতে চলেছে)
      if (item.status === 'low_stock') return 1;
      // 2. স্টক শেষ (০ কেজি বাকি)
      if (item.status === 'out_of_stock') return 2;
      // 3. বিক্রি হচ্ছে এমন স্টক (বেশি বিক্রি হওয়া আগে আসবে)
      if (item.soldKg > 0) return 3;
      // 4. অক্ষত স্টক (০% বিক্রি)
      return 4;
    };

    const pA = getPriority(a);
    const pB = getPriority(b);

    if (pA !== pB) {
      return pA - pB;
    }

    // কম স্টকের ভেতরে: যার শতকরা অবশিষ্ট সবচেয়ে কম সে আগে আসবে
    if (pA === 1) {
      const remPctA = a.purchasedKg > 0 ? (a.remainingKg / a.purchasedKg) : 0;
      const remPctB = b.purchasedKg > 0 ? (b.remainingKg / b.purchasedKg) : 0;
      if (remPctA !== remPctB) return remPctA - remPctB;
      return a.remainingKg - b.remainingKg;
    }

    // স্টক শেষ হওয়াদের ভেতরে: বেশি বিক্রয়কৃত আগে
    if (pA === 2) {
      return b.soldKg - a.soldKg;
    }

    // বিক্রি চলমান পণ্যের ভেতরে: বেশি শতকরা বিক্রি হওয়া আগে আসবে (শেষের কাছাকাছি)
    if (pA === 3) {
      const soldPctA = a.purchasedKg > 0 ? (a.soldKg / a.purchasedKg) : 0;
      const soldPctB = b.purchasedKg > 0 ? (b.soldKg / b.purchasedKg) : 0;
      if (soldPctA !== soldPctB) return soldPctB - soldPctA;
      return a.remainingKg - b.remainingKg;
    }

    // অক্ষত পণ্যের ভেতরে: লট ও সিরিয়াল অনুযায়ী
    if (a.lotNumber !== b.lotNumber) return a.lotNumber - b.lotNumber;
    return a.serialNo - b.serialNo;
  });

  const lowStockCount = allDisplayItems.filter(it => it.status === 'low_stock').length;
  const outOfStockCount = allDisplayItems.filter(it => it.status === 'out_of_stock').length;

  const handleCardClick = (lotNumber: number | 'all') => {
    setSelectedLot(lotNumber);
    setViewMode('detail');
  };

  return (
    <div className="stock-screen" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn-icon" 
            onClick={() => {
              if (viewMode === 'detail') {
                setViewMode('cards');
              } else {
                onNavigate('dashboard');
              }
            }} 
            title={viewMode === 'detail' ? (language === 'bn' ? 'লট কার্ডে ফিরুন' : 'Back to Lot Cards') : (language === 'bn' ? 'ড্যাশবোর্ডে ফিরুন' : 'Back to Dashboard')}
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.45rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Package size={24} style={{ color: '#72be44' }} />
              {language === 'bn' ? 'মাছের স্টক হিসাব' : 'Fish Stock Inventory'}
            </h2>
            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
              {language === 'bn' ? 'ক্রয় হিসাব থেকে সংযুক্ত ও বিক্রয়ের সাথে রিয়েল-টাইম সমন্বিত' : 'Linked from purchase lots & updated in real time with memo sales'}
            </span>
          </div>
        </div>

        {/* View Mode Toggle & Global Stock Metric Cards */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          {/* Card View / Table View Switcher */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                border: 'none',
                background: viewMode === 'cards' ? '#72be44' : 'transparent',
                color: viewMode === 'cards' ? '#000' : '#ccc',
                fontWeight: viewMode === 'cards' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.2s'
              }}
            >
              <LayoutGrid size={14} />
              <span>{language === 'bn' ? 'লট কার্ড' : 'Lot Cards'}</span>
            </button>
            <button
              onClick={() => setViewMode('detail')}
              style={{
                padding: '5px 12px',
                borderRadius: '7px',
                border: 'none',
                background: viewMode === 'detail' ? '#72be44' : 'transparent',
                color: viewMode === 'detail' ? '#000' : '#ccc',
                fontWeight: viewMode === 'detail' ? 'bold' : 'normal',
                cursor: 'pointer',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.2s'
              }}
            >
              <Table size={14} />
              <span>{language === 'bn' ? 'স্টক টেবিল' : 'Stock Table'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'center', minWidth: '95px' }}>
              <div style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>মোট ক্রয়</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff' }}>{totalPurchased.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 'normal' }}>কেজি</span></div>
            </div>
            <div style={{ background: 'rgba(255, 152, 0, 0.1)', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(255, 152, 0, 0.3)', textAlign: 'center', minWidth: '95px' }}>
              <div style={{ fontSize: '0.68rem', color: '#ff9800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>মোট বিক্রি</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ffb74d' }}>{totalSold.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 'normal' }}>কেজি</span></div>
            </div>
            <div style={{ background: 'rgba(114, 190, 68, 0.15)', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(114, 190, 68, 0.4)', textAlign: 'center', minWidth: '105px' }}>
              <div style={{ fontSize: '0.68rem', color: '#72be44', textTransform: 'uppercase', letterSpacing: '0.5px' }}>বর্তমান মোট স্টক</div>
              <div style={{ fontSize: '1.12rem', fontWeight: 'bold', color: '#72be44' }}>{totalRemaining.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 'normal' }}>কেজি</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: LOT CARDS GRID (DEFAULT ENTRY VIEW AS REQUESTED)                   */}
      {/* ========================================================================= */}
      {viewMode === 'cards' && (
        <div className="stock-cards-view">
          <div className="stock-cards-grid">
            {/* CARD 1: সব লট (মোট স্টক) */}
            <div 
              className="stock-lot-card stock-summary-card" 
              onClick={() => handleCardClick('all')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                    <div style={{ background: 'rgba(114, 190, 68, 0.2)', padding: '7px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Layers size={22} style={{ color: '#72be44' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {language === 'bn' ? 'সব লট (মোট স্টক)' : 'All Lots (Total Stock)'}
                      </h3>
                      <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {language === 'bn' ? `মোট ${lotsStock.length} টি লট • ${uniqueFishNames.size} টি মাছের প্রজাতি` : `${lotsStock.length} Lots • ${uniqueFishNames.size} Species`}
                      </div>
                    </div>
                  </div>
                  <span style={{ background: 'rgba(114, 190, 68, 0.25)', color: '#72be44', fontWeight: 'bold', fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {language === 'bn' ? 'মোট স্টক' : 'Total Stock'}
                  </span>
                </div>

                {/* Stock metrics summary grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.65rem', borderRadius: '8px', marginBottom: '0.65rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#aaa' }}>মোট ক্রয়</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>
                      {totalPurchased.toFixed(2)} <span style={{ fontSize: '0.65rem', fontWeight: 'normal' }}>কেজি</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '0.68rem', color: '#ffb74d' }}>মোট বিক্রি</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#ffb74d', marginTop: '2px' }}>
                      {totalSold.toFixed(2)} <span style={{ fontSize: '0.65rem', fontWeight: 'normal' }}>কেজি</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: '#72be44' }}>অবশিষ্ট স্টক</div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 'bold', color: '#72be44', marginTop: '2px' }}>
                      {totalRemaining.toFixed(2)} <span style={{ fontSize: '0.65rem', fontWeight: 'normal' }}>কেজি</span>
                    </div>
                  </div>
                </div>

                {/* Sales progress bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#aaa', marginBottom: '4px' }}>
                    <span>বিক্রয়: {totalSoldPercent}%</span>
                    <span>অবশিষ্ট: {totalRemainingPercent}%</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${totalSoldPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #ff9800, #72be44)',
                      borderRadius: '3px',
                      transition: 'width 0.4s'
                    }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#72be44', fontSize: '0.78rem', fontWeight: 'bold' }}>
                <span>{language === 'bn' ? 'সকল মাছের স্টক বিবরণ দেখুন' : 'View Full Stock Details'}</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* CARDS 2..N: INDIVIDUAL LOT CARDS */}
            {lotsStock.map(lot => {
              const lotSoldPercent = lot.totalPurchasedKg > 0 ? Math.min(100, Math.round((lot.totalSoldKg / lot.totalPurchasedKg) * 100)) : 0;
              const lotRemainingPercent = Math.max(0, 100 - lotSoldPercent);
              const hasRemaining = lot.totalRemainingKg > 0.001;
              const isLow = hasRemaining && lot.totalRemainingKg <= lot.totalPurchasedKg * 0.25;

              let badgeText = 'স্টকে আছে';
              let badgeColor = '#72be44';
              let badgeBg = 'rgba(114, 190, 68, 0.2)';
              if (!hasRemaining) {
                badgeText = 'স্টক শেষ';
                badgeColor = '#ff5252';
                badgeBg = 'rgba(255, 82, 82, 0.2)';
              } else if (isLow) {
                badgeText = 'কম স্টক';
                badgeColor = '#ff9800';
                badgeBg = 'rgba(255, 152, 0, 0.2)';
              }

              return (
                <div 
                  key={lot.lotNumber}
                  className="stock-lot-card" 
                  onClick={() => handleCardClick(lot.lotNumber)}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', minWidth: 0 }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '7px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Package size={20} style={{ color: hasRemaining ? '#72be44' : '#888' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {language === 'bn' ? `লট ${lot.lotNumber < 10 ? `০${lot.lotNumber}` : lot.lotNumber}` : `Lot ${lot.lotNumber}`}
                          </h3>
                          {lot.supplierName ? (
                            <div style={{ fontSize: '0.78rem', color: '#ffb74d', marginTop: '1px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              আড়ত: {lot.supplierName}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '1px', whiteSpace: 'nowrap' }}>
                              {lot.items.length} টি মাছের প্রজাতি
                            </div>
                          )}
                        </div>
                      </div>
                      <span style={{ background: badgeBg, color: badgeColor, fontWeight: 'bold', fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Date info if available */}
                    {lot.date && (
                      <div style={{ fontSize: '0.72rem', color: '#999', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.5rem' }}>
                        <Calendar size={11} opacity={0.7} />
                        <span>{lot.date}</span>
                        {lot.supplierName && <span style={{ marginLeft: 'auto', color: '#888' }}>{lot.items.length} টি প্রজাতি</span>}
                      </div>
                    )}

                    {/* Stock Metrics Mini-Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', background: 'rgba(0,0,0,0.2)', padding: '0.55rem 0.65rem', borderRadius: '8px', marginBottom: '0.65rem' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: '#aaa' }}>ক্রয়</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#fff', marginTop: '2px' }}>
                          {lot.totalPurchasedKg.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: '0.68rem', color: '#ffb74d' }}>বিক্রি</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#ffb74d', marginTop: '2px' }}>
                          {lot.totalSoldKg.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.68rem', color: badgeColor }}>অবশিষ্ট</div>
                        <div style={{ fontSize: '0.96rem', fontWeight: 'bold', color: badgeColor, marginTop: '2px' }}>
                          {lot.totalRemainingKg.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#aaa', marginBottom: '3px' }}>
                        <span>বিক্রি: {lotSoldPercent}%</span>
                        <span>বাকি: {lotRemainingPercent}%</span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${lotSoldPercent}%`,
                          height: '100%',
                          background: lotSoldPercent >= 100 ? '#ff5252' : 'linear-gradient(90deg, #ff9800, #72be44)',
                          borderRadius: '3px',
                          transition: 'width 0.4s'
                        }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#72be44', fontSize: '0.78rem', fontWeight: 'bold' }}>
                    <span>{language === 'bn' ? 'লটের স্টক বিবরণ' : 'View Lot Stock'}</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DETAILED TABLE VIEW (OPENS WHEN USER CLICKS A LOT CARD)           */}
      {/* ========================================================================= */}
      {viewMode === 'detail' && (
        <div className="stock-content-wrapper">
          {/* Quick Return to Cards button and Lot Tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500
              }}
            >
              <ChevronLeft size={16} />
              <span>{language === 'bn' ? 'লট কার্ডে ফিরুন' : 'Back to Lot Cards'}</span>
            </button>

            {/* Lot Selector Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', overflowX: 'auto', paddingBottom: '2px' }}>
              <button
                onClick={() => setSelectedLot('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedLot === 'all' ? '2px solid #72be44' : '1px solid rgba(255,255,255,0.1)',
                  background: selectedLot === 'all' ? 'rgba(114, 190, 68, 0.2)' : 'rgba(255,255,255,0.03)',
                  color: selectedLot === 'all' ? '#72be44' : '#ccc',
                  fontWeight: selectedLot === 'all' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontSize: '0.85rem',
                  transition: 'all 0.2s'
                }}
              >
                সব লট ({lotsStock.length})
              </button>

              {lotsStock.map(lot => {
                const isSelected = selectedLot === lot.lotNumber;
                return (
                  <button
                    key={lot.lotNumber}
                    onClick={() => setSelectedLot(lot.lotNumber)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: isSelected ? '2px solid #72be44' : '1px solid rgba(255,255,255,0.1)',
                      background: isSelected ? 'rgba(114, 190, 68, 0.2)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#72be44' : '#ccc',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span>লট {lot.lotNumber < 10 ? `০${lot.lotNumber}` : lot.lotNumber}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.8, background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '10px' }}>
                      {lot.totalRemainingKg} kg
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Lot Info Banner (if a specific lot is selected) */}
          {selectedLot !== 'all' && (() => {
            const lotInfo = lotsStock.find(l => l.lotNumber === selectedLot);
            if (!lotInfo) return null;
            return (
              <div style={{
                background: 'linear-gradient(135deg, rgba(11, 46, 26, 0.8) 0%, rgba(18, 29, 23, 0.9) 100%)',
                border: '1px solid rgba(114, 190, 68, 0.3)',
                borderRadius: '12px',
                padding: '1rem 1.5rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                    লট নম্বর {lotInfo.lotNumber < 10 ? `০${lotInfo.lotNumber}` : lotInfo.lotNumber} এর স্টক বিবরণ
                  </div>
                  <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '4px' }}>
                    {lotInfo.supplierName && <span>আড়ত: <b style={{ color: '#fff' }}>{lotInfo.supplierName}</b> &nbsp;|&nbsp; </span>}
                    {lotInfo.date && <span>তারিখ: {lotInfo.date} &nbsp;|&nbsp; </span>}
                    <span>মাছের প্রজাতি: {lotInfo.items.length} টি</span>
                  </div>
                </div>

                {onSelectPurchaseLot && (
                  <button
                    className="btn-primary"
                    onClick={() => onSelectPurchaseLot(lotInfo.lotNumber)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                  >
                    ক্রয় মেমো দেখুন <ArrowRight size={16} />
                  </button>
                )}
              </div>
            );
          })()}

          {/* Restock Urgency Notification Banner */}
          {(lowStockCount > 0 || outOfStockCount > 0) && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.16) 0%, rgba(239, 68, 68, 0.12) 100%)',
              border: '1px solid rgba(255, 152, 0, 0.45)',
              borderRadius: '10px',
              padding: '0.65rem 1rem',
              marginBottom: '1rem',
              gap: '0.8rem',
              flexWrap: 'wrap',
              boxShadow: '0 4px 14px rgba(255, 152, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#ffb74d', flexShrink: 0 }} />
                <span style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>
                  {language === 'bn' 
                    ? `সতর্কতা: ${lowStockCount > 0 ? `${lowStockCount}টি মাছের স্টক শেষ হতে চলেছে` : ''}${lowStockCount > 0 && outOfStockCount > 0 ? ' এবং ' : ''}${outOfStockCount > 0 ? `${outOfStockCount}টি মাছের স্টক শেষ হয়েছে` : ''} — দ্রুত নতুন ক্রয় করার পরামর্শ দেওয়া হচ্ছে।`
                    : `Notice: ${lowStockCount} items running low, ${outOfStockCount} out of stock — repurchasing recommended.`}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  fontSize: '0.78rem',
                  color: '#ffb74d',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255, 152, 0, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 'bold'
                }}>
                  {language === 'bn' ? '⚡ শেষ হতে চলা পণ্য উপরে প্রদর্শিত হচ্ছে' : '⚡ Ending items prioritized on top'}
                </span>
              </div>
            </div>
          )}

          {/* Search, Status Filters, and Restock Priority Sort Selector */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '340px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="মাছের নাম বা লট দিয়ে খুঁজুন..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: '0.88rem',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    border: statusFilter === 'all' ? '1px solid #fff' : '1px solid rgba(255,255,255,0.1)',
                    background: statusFilter === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  সকল অবস্থা
                </button>
                <button
                  onClick={() => setStatusFilter('in_stock')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    border: statusFilter === 'in_stock' ? '1px solid #72be44' : '1px solid rgba(114, 190, 68, 0.2)',
                    background: statusFilter === 'in_stock' ? 'rgba(114, 190, 68, 0.2)' : 'transparent',
                    color: '#72be44',
                    cursor: 'pointer'
                  }}
                >
                  স্টকে আছে
                </button>
                <button
                  onClick={() => setStatusFilter('low_stock')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    border: statusFilter === 'low_stock' ? '1.5px solid #ff9800' : '1px solid rgba(255, 152, 0, 0.3)',
                    background: statusFilter === 'low_stock' ? 'rgba(255, 152, 0, 0.25)' : 'rgba(255, 152, 0, 0.08)',
                    color: '#ffb74d',
                    fontWeight: statusFilter === 'low_stock' ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  ⚠️ কম স্টক {lowStockCount > 0 ? `(${lowStockCount})` : ''}
                </button>
                <button
                  onClick={() => setStatusFilter('out_of_stock')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    border: statusFilter === 'out_of_stock' ? '1.5px solid #ff5252' : '1px solid rgba(255, 82, 82, 0.3)',
                    background: statusFilter === 'out_of_stock' ? 'rgba(255, 82, 82, 0.25)' : 'rgba(255, 82, 82, 0.08)',
                    color: '#ff5252',
                    fontWeight: statusFilter === 'out_of_stock' ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  ❌ স্টক শেষ {outOfStockCount > 0 ? `(${outOfStockCount})` : ''}
                </button>
              </div>

              {/* Sort selector dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <ArrowUpDown size={14} style={{ color: '#ffb74d' }} />
                <span style={{ fontSize: '0.78rem', color: '#aaa' }}>{language === 'bn' ? 'সর্ট:' : 'Sort:'}</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.82rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '2px 0'
                  }}
                >
                  <option value="running_out" style={{ color: '#000', background: '#fff' }}>
                    {language === 'bn' ? '⚡ শেষ হতে চলেছে আগে (ডিফল্ট)' : '⚡ Running Out First'}
                  </option>
                  <option value="remaining_asc" style={{ color: '#000', background: '#fff' }}>
                    {language === 'bn' ? 'অবশিষ্ট স্টক (কম থেকে বেশি)' : 'Remaining: Low to High'}
                  </option>
                  <option value="remaining_desc" style={{ color: '#000', background: '#fff' }}>
                    {language === 'bn' ? 'অবশিষ্ট স্টক (বেশি থেকে কম)' : 'Remaining: High to Low'}
                  </option>
                  <option value="lot_serial" style={{ color: '#000', background: '#fff' }}>
                    {language === 'bn' ? 'লট ও ক্রমিক অনুযায়ী' : 'By Lot & Serial'}
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Stock Table */}
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="memo-dark-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ width: '60px', textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left' }}>মাছের নাম</th>
                    <th style={{ textAlign: 'center' }}>লট নং</th>
                    <th style={{ textAlign: 'right' }}>ক্রয়কৃত পরিমাণ</th>
                    <th style={{ textAlign: 'right' }}>বিক্রয়কৃত পরিমাণ</th>
                    <th style={{ width: '180px', textAlign: 'center' }}>বিক্রয় অগ্রগতি</th>
                    <th style={{ textAlign: 'right' }}>অবশিষ্ট স্টক</th>
                    <th style={{ textAlign: 'center' }}>অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                        <Package size={48} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                        <div>কোনো মাছের স্টক তথ্য পাওয়া যায়নি</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>
                          ক্রয় হিসাবে লট তৈরি করে মাছের বিবরণ যোগ করলে এখানে স্বয়ংক্রিয়ভাবে স্টক দেখা যাবে।
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedItems.map((item, index) => {
                      const soldPercent = item.purchasedKg > 0 ? Math.min(100, Math.round((item.soldKg / item.purchasedKg) * 100)) : 0;
                      const remainingPercent = Math.max(0, 100 - soldPercent);
                      const isLow = item.status === 'low_stock';
                      const isOut = item.status === 'out_of_stock';

                      let statusBadgeColor = '#72be44';
                      let statusBadgeBg = 'rgba(114, 190, 68, 0.15)';
                      let statusText = 'স্টকে আছে';
                      let StatusIcon = CheckCircle2;

                      if (isOut) {
                        statusBadgeColor = '#ff5252';
                        statusBadgeBg = 'rgba(255, 82, 82, 0.18)';
                        statusText = 'স্টক শেষ';
                        StatusIcon = XCircle;
                      } else if (isLow) {
                        statusBadgeColor = '#ff9800';
                        statusBadgeBg = 'rgba(255, 152, 0, 0.18)';
                        statusText = 'কম স্টক (শেষের পথে)';
                        StatusIcon = AlertTriangle;
                      }

                      return (
                        <tr
                          key={`${item.lotNumber}-${item.id}`}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            background: isLow 
                              ? 'rgba(255, 152, 0, 0.09)' 
                              : (isOut ? 'rgba(239, 68, 68, 0.07)' : undefined),
                            boxShadow: isLow 
                              ? 'inset 4px 0 0 #ff9800' 
                              : (isOut ? 'inset 4px 0 0 #ef4444' : undefined),
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <td data-label="#" style={{ textAlign: 'center', opacity: 0.85, fontWeight: 'bold' }}>{index + 1}</td>
                          <td data-label="মাছের নাম">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#fff' }}>{item.name}</span>
                              {isLow && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#ffb74d',
                                  background: 'rgba(255, 152, 0, 0.25)',
                                  border: '1px solid rgba(255, 152, 0, 0.5)',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontWeight: 'bold',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  ⚠️ শেষ হতে চলেছে (নতুন ক্রয় প্রয়োজন)
                                </span>
                              )}
                              {isOut && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: '#f87171',
                                  background: 'rgba(239, 68, 68, 0.25)',
                                  border: '1px solid rgba(239, 68, 68, 0.5)',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  fontWeight: 'bold',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  ❌ স্টক শেষ (পুনরায় ক্রয় করুন)
                                </span>
                              )}
                            </div>
                            {item.supplierName && (
                              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>আড়ত: {item.supplierName}</div>
                            )}
                          </td>
                          <td data-label="লট নং" style={{ textAlign: 'center' }}>
                            <span style={{ background: 'rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>
                              লট {item.lotNumber}
                            </span>
                          </td>
                          <td data-label="ক্রয়কৃত পরিমাণ" style={{ textAlign: 'right', fontWeight: 500 }}>
                            {item.purchasedKg.toFixed(2)} কেজি
                          </td>
                          <td data-label="বিক্রয়কৃত পরিমাণ" style={{ textAlign: 'right', color: '#ffb74d', fontWeight: 500 }}>
                            {item.soldKg.toFixed(2)} কেজি
                          </td>
                          <td data-label="বিক্রয় অগ্রগতি" style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa' }}>
                                <span>বিক্রি: {soldPercent}%</span>
                                <span>বাকি: {remainingPercent}%</span>
                              </div>
                              <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${soldPercent}%`,
                                    height: '100%',
                                    background: soldPercent >= 100 ? '#ff5252' : 'linear-gradient(90deg, #ff9800, #ff5722)',
                                    borderRadius: '4px',
                                    transition: 'width 0.4s'
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td data-label="অবশিষ্ট স্টক" style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: item.remainingKg > 0 ? '#72be44' : '#ff5252' }}>
                              {item.remainingKg.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#aaa', marginLeft: '4px' }}>কেজি</span>
                          </td>
                          <td data-label="অবস্থা" style={{ textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: statusBadgeColor,
                              background: statusBadgeBg,
                              border: `1px solid ${statusBadgeColor}44`
                            }}>
                              <StatusIcon size={12} />
                              {statusText}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockScreen;
