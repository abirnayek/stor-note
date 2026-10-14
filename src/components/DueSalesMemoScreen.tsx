import React from 'react';
import { type Screen } from '../App';
import SalesMemoScreen from './SalesMemoScreen';
import MemoScreen from './MemoScreen';
import { getNormalizedMemo } from '../utils/dueSyncUtils';

interface DueMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType?: 'regular' | 'permanent' | 'purchase' | 'reseller';
  dueId: string;
  isPaid?: boolean;
}

const DueSalesMemoScreen: React.FC<DueMemoScreenProps> = ({ onNavigate, dueType = 'regular', dueId, isPaid = false }) => {
  const normMemo = getNormalizedMemo(dueId);
  const targetLotNumber = normMemo.lotNumber;

  const handleBack = () => {
    if (isPaid) {
      onNavigate('paid-due-list');
    } else {
      onNavigate(dueType === 'purchase' || normMemo.customerType === 'purchase' ? 'due-purchase-list' : 'due-list');
    }
  };

  // Strict guard: If this is a purchase memo/due, NEVER open SalesMemoScreen!
  if (dueType === 'purchase' || normMemo.customerType === 'purchase' || dueId.startsWith('purchase_')) {
    let lotNum = targetLotNumber || 1;
    if (dueId.startsWith('purchase_lot_')) {
      lotNum = parseInt(dueId.replace('purchase_lot_', ''), 10) || lotNum;
    }
    return (
      <MemoScreen
        onNavigate={onNavigate}
        lotNumber={lotNum}
        onBack={handleBack}
      />
    );
  }

  const effectiveType = (normMemo.customerType === 'permanent' || normMemo.customerType === 'regular' || normMemo.customerType === 'reseller')
    ? normMemo.customerType
    : (dueType === 'permanent' ? 'permanent' : (dueType === 'reseller' ? 'reseller' : 'regular'));

  return (
    <SalesMemoScreen
      onNavigate={onNavigate}
      onBack={handleBack}
      lotNumber={targetLotNumber}
      memoId={dueId}
      defaultCustomerType={effectiveType}
    />
  );
};

export default DueSalesMemoScreen;
