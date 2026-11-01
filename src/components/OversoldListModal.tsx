import React from 'react';
import { X, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import { type FishSalesSummary, getFishSalesBreakdown } from '../utils/stockUtils';

export interface OversoldItemDetail {
  lotNumber: number;
  fishName: string;
  purchasedKg: number;
  soldKg: number;
  oversoldKg: number;
}

interface OversoldListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: OversoldItemDetail[];
  totalOversoldKg: number;
  onOpenFishSales: (summary: FishSalesSummary) => void;
}

export const OversoldListModal: React.FC<OversoldListModalProps> = ({
  isOpen,
  onClose,
  title,
  items,
  totalOversoldKg,
  onOpenFishSales
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #18221c 0%, #0d1611 100%)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(239, 68, 68, 0.2)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(239, 68, 68, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#fca5a5' }}>
                মোট অতিরিক্ত বিক্রি: <b style={{ fontSize: '0.85rem' }}>-{totalOversoldKg.toFixed(2)} কেজি</b> (ক্রয়ের চেয়ে বেশি বিক্রি)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '8px',
              color: '#ccc',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
            নিচের মাছগুলো ক্রয় পরিমাণের চেয়ে বেশি বিক্রি করা হয়েছে। যে কোনো মাছের উপরে বা <b>"মেমো দেখুন"</b> বাটনে ক্লিক করলে যে মেমোগুলোতে এই মাছ বিক্রি হয়েছে তার সম্পূর্ণ তালিকা দেখতে পাবেন:
          </div>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#888' }}>
              কোনো অতিরিক্ত বিক্রি পাওয়া যায়নি।
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={`${item.lotNumber}-${item.fishName}-${idx}`}
                onClick={() => {
                  const summary = getFishSalesBreakdown(item.fishName, item.lotNumber);
                  onOpenFishSales(summary);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 'bold', color: '#fff' }}>
                      {item.fishName}
                    </span>
                    <span
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      লট {item.lotNumber < 10 ? `০${item.lotNumber}` : item.lotNumber}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span>ক্রয়: <b style={{ color: '#fff' }}>{item.purchasedKg.toFixed(2)} কেজি</b></span>
                    <span>বিক্রি: <b style={{ color: '#ffb74d' }}>{item.soldKg.toFixed(2)} কেজি</b></span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: '#f87171', fontWeight: 600 }}>অতিরিক্ত বিক্রি</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#ef4444' }}>
                      -{item.oversoldKg.toFixed(2)} <span style={{ fontSize: '0.72rem', fontWeight: 'normal' }}>কেজি</span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      color: '#93c5fd',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <FileText size={13} />
                    <span>মেমো দেখুন</span>
                    <ChevronRight size={13} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.25)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
