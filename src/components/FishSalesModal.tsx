import React, { useState } from 'react';
import { X, Package, FileText, TrendingUp, TrendingDown, Search, ExternalLink } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { type FishSalesSummary } from '../utils/stockUtils';

interface FishSalesModalProps {
  salesSummary: FishSalesSummary | null;
  onClose: () => void;
  onSelectSalesMemo?: (memoId: string, lotNumber: number | null) => void;
}

export const FishSalesModal: React.FC<FishSalesModalProps> = ({
  salesSummary,
  onClose,
  onSelectSalesMemo
}) => {
  const { language } = useLanguage();
  const [fishMemoSearch, setFishMemoSearch] = useState('');
  const [fishMemoFilter, setFishMemoFilter] = useState<'all' | 'profit' | 'loss'>('all');

  if (!salesSummary) return null;

  const filteredFishMemos = (salesSummary.memos || []).filter(memo => {
    if (fishMemoSearch.trim()) {
      const q = fishMemoSearch.toLowerCase();
      const matchMemo = memo.memoId.toLowerCase().includes(q);
      const matchCust = (memo.customerName || '').toLowerCase().includes(q);
      const matchMobile = (memo.mobile || '').toLowerCase().includes(q);
      if (!matchMemo && !matchCust && !matchMobile) return false;
    }
    if (fishMemoFilter === 'profit' && memo.profit <= 0) return false;
    if (fishMemoFilter === 'loss' && memo.profit >= 0) return false;
    return true;
  });

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#0c2419',
          border: '1px solid rgba(114, 190, 68, 0.4)',
          borderRadius: '16px',
          maxWidth: '960px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'linear-gradient(135deg, rgba(16, 52, 34, 0.95) 0%, rgba(12, 36, 25, 0.98) 100%)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', color: '#fff', fontWeight: 'bold' }}>
                {salesSummary.fishName}
              </h3>
              <span
                style={{
                  background: 'rgba(114, 190, 68, 0.2)',
                  border: '1px solid rgba(114, 190, 68, 0.4)',
                  color: '#72be44',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  fontSize: '0.82rem',
                  fontWeight: 'bold'
                }}
              >
                লট {salesSummary.lotNumber < 10 ? `০${salesSummary.lotNumber}` : salesSummary.lotNumber}
              </span>
              {salesSummary.supplierName && (
                <span style={{ fontSize: '0.85rem', color: '#ffb74d', fontWeight: 500 }}>
                  (আড়ত: {salesSummary.supplierName})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#aaa', marginTop: '4px' }}>
              {language === 'bn' 
                ? 'এই মাছটি যেসব বিক্রয় মেমোর মাধ্যমে বিক্রি করা হয়েছে এবং লাভ-লসের পূর্ণাঙ্গ হিসাব' 
                : 'Sales memos and profit-loss breakdown for this fish'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 82, 82, 0.3)';
              e.currentTarget.style.borderColor = '#ff5252';
              e.currentTarget.style.color = '#ff5252';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = '#fff';
            }}
            title={language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div style={{ padding: '1.2rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* TOP 4 SUMMARY METRICS CARDS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '0.85rem'
            }}
          >
            {/* 1. টোটাল বিক্রয় হয়েছে */}
            <div
              style={{
                background: 'rgba(255, 152, 0, 0.08)',
                border: '1px solid rgba(255, 152, 0, 0.3)',
                borderRadius: '12px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#ffb74d', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Package size={14} />
                <span>মোট বিক্রয় হয়েছে</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#fff', marginTop: '6px' }}>
                {salesSummary.totalSoldKg.toFixed(2)} <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: 'normal' }}>কেজি</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: '#bbb', marginTop: '4px' }}>
                অবশিষ্ট স্টক: <b style={{ color: salesSummary.remainingKg > 0 ? '#72be44' : '#ff5252' }}>{salesSummary.remainingKg.toFixed(2)} কেজি</b>
              </div>
            </div>

            {/* 2. দাম পাওয়া গেছে */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FileText size={14} />
                <span>দাম পাওয়া গেছে (বিক্রয় মূল্য)</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#60a5fa', marginTop: '6px' }}>
                ৳ {salesSummary.totalRevenue.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#bbb', marginTop: '4px' }}>
                গড় বিক্রয় দর: <b>৳ {salesSummary.avgSaleRate.toFixed(2)}</b> /কেজি
              </div>
            </div>

            {/* 3. লাভ হয়েছে */}
            <div
              style={{
                background: 'rgba(74, 222, 128, 0.08)',
                border: '1px solid rgba(74, 222, 128, 0.35)',
                borderRadius: '12px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: '#86efac', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <TrendingUp size={14} style={{ color: '#4ade80' }} />
                <span>লাভ হয়েছে</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#4ade80', marginTop: '6px' }}>
                ৳ {salesSummary.totalProfit.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#bbb', marginTop: '4px' }}>
                নিট মুনাফা: <b style={{ color: salesSummary.netProfit >= 0 ? '#4ade80' : '#f87171' }}>
                  ৳ {salesSummary.netProfit.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </b>
              </div>
            </div>

            {/* 4. লস হয়েছে */}
            <div
              style={{
                background: salesSummary.totalLoss > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                border: salesSummary.totalLoss > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ fontSize: '0.78rem', color: salesSummary.totalLoss > 0 ? '#fca5a5' : '#aaa', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <TrendingDown size={14} style={{ color: salesSummary.totalLoss > 0 ? '#f87171' : '#aaa' }} />
                <span>লস হয়েছে</span>
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: salesSummary.totalLoss > 0 ? '#f87171' : '#888', marginTop: '6px' }}>
                ৳ {salesSummary.totalLoss.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#bbb', marginTop: '4px' }}>
                {salesSummary.totalLoss > 0 ? 'বিক্রয় দরে ক্ষতি' : 'কোনো ক্ষতি হয়নি'}
              </div>
            </div>
          </div>

          {/* Search & Filter bar for memos */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.7rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(0, 0, 0, 0.25)',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.07)'
            }}
          >
            {/* Search input */}
            <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '380px' }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }}
              />
              <input
                type="text"
                value={fishMemoSearch}
                onChange={e => setFishMemoSearch(e.target.value)}
                placeholder="মেমো নং বা ক্রেতার নাম খুঁজুন..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 34px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFishMemoFilter('all')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: fishMemoFilter === 'all' ? '1px solid #72be44' : '1px solid rgba(255,255,255,0.1)',
                  background: fishMemoFilter === 'all' ? 'rgba(114, 190, 68, 0.2)' : 'transparent',
                  color: fishMemoFilter === 'all' ? '#72be44' : '#bbb',
                  fontWeight: fishMemoFilter === 'all' ? 'bold' : 'normal'
                }}
              >
                সব মেমো ({salesSummary.memos.length})
              </button>
              <button
                type="button"
                onClick={() => setFishMemoFilter('profit')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: fishMemoFilter === 'profit' ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.1)',
                  background: fishMemoFilter === 'profit' ? 'rgba(74, 222, 128, 0.2)' : 'transparent',
                  color: fishMemoFilter === 'profit' ? '#86efac' : '#bbb',
                  fontWeight: fishMemoFilter === 'profit' ? 'bold' : 'normal'
                }}
              >
                লাভজনক ({salesSummary.memos.filter(m => m.profit > 0).length})
              </button>
              {salesSummary.totalLoss > 0 && (
                <button
                  type="button"
                  onClick={() => setFishMemoFilter('loss')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    border: fishMemoFilter === 'loss' ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.1)',
                    background: fishMemoFilter === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: fishMemoFilter === 'loss' ? '#fca5a5' : '#bbb',
                    fontWeight: fishMemoFilter === 'loss' ? 'bold' : 'normal'
                  }}
                >
                  লস ({salesSummary.memos.filter(m => m.profit < 0).length})
                </button>
              )}
            </div>
          </div>

          {/* Memos List Table */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden'
            }}
          >
            <div className="table-responsive">
              <table className="memo-dark-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ width: '50px', textAlign: 'center' }}>#</th>
                    <th style={{ textAlign: 'left' }}>মেমো নং</th>
                    <th style={{ textAlign: 'left' }}>ক্রেতার নাম</th>
                    <th style={{ textAlign: 'center' }}>তারিখ ও সময়</th>
                    <th style={{ textAlign: 'right' }}>বিক্রয় পরিমাণ</th>
                    <th style={{ textAlign: 'right' }}>বিক্রয় দর</th>
                    <th style={{ textAlign: 'right' }}>মোট মূল্য</th>
                    <th style={{ textAlign: 'right' }}>ক্রয় দর</th>
                    <th style={{ textAlign: 'right' }}>লাভ / লস</th>
                    <th style={{ textAlign: 'center', width: '100px' }}>অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFishMemos.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#888' }}>
                        <FileText size={36} style={{ opacity: 0.3, marginBottom: '0.4rem' }} />
                        <div>কোনো বিক্রয় মেমো পাওয়া যায়নি</div>
                      </td>
                    </tr>
                  ) : (
                    filteredFishMemos.map((memo, idx) => {
                      const isProfit = memo.profit > 0;
                      const isLoss = memo.profit < 0;

                      return (
                        <tr
                          key={`${memo.memoId}-${idx}`}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                          }}
                        >
                          <td style={{ textAlign: 'center', opacity: 0.7 }}>{idx + 1}</td>
                          <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>
                            #{memo.memoId}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#fff' }}>
                              {memo.customerName || 'খুচরা ক্রেতা'}
                            </div>
                            {memo.mobile && (
                              <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                {memo.mobile}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa', whiteSpace: 'nowrap' }}>
                            <div>{memo.date || '—'}</div>
                            {memo.time && <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{memo.time}</div>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#ffb74d' }}>
                            {memo.weightKg.toFixed(2)} কেজি
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            ৳ {memo.saleRate.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                            ৳ {memo.totalSalePrice.toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right', color: '#aaa' }}>
                            ৳ {memo.buyRate.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                color: isProfit ? '#4ade80' : isLoss ? '#f87171' : '#aaa',
                                background: isProfit
                                  ? 'rgba(74, 222, 128, 0.15)'
                                  : isLoss
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(255, 255, 255, 0.05)',
                                border: isProfit
                                  ? '1px solid rgba(74, 222, 128, 0.3)'
                                  : isLoss
                                  ? '1px solid rgba(239, 68, 68, 0.3)'
                                  : '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              {isProfit ? `+ ৳ ${memo.profit.toFixed(2)}` : isLoss ? `- ৳ ${Math.abs(memo.profit).toFixed(2)}` : '৳ 0.00'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                if (onSelectSalesMemo) {
                                  onSelectSalesMemo(memo.memoId, memo.lotNumber || salesSummary.lotNumber);
                                }
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'rgba(59, 130, 246, 0.2)',
                                border: '1px solid rgba(59, 130, 246, 0.5)',
                                color: '#93c5fd',
                                fontSize: '0.78rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.4)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                                e.currentTarget.style.color = '#93c5fd';
                              }}
                              title={language === 'bn' ? 'মেমোর বিস্তারিত দেখুন' : 'View full memo'}
                            >
                              <span>{language === 'bn' ? 'মেমো দেখুন' : 'View'}</span>
                              <ExternalLink size={12} />
                            </button>
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

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
            মোট বিক্রয় মেমো: <b style={{ color: '#fff' }}>{filteredFishMemos.length}</b> টি
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
