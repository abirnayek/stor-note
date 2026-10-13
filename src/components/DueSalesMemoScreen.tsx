import React from 'react';
import { type Screen } from '../App';
import SalesMemoScreen from './SalesMemoScreen';
import { getNormalizedMemo } from '../utils/dueSyncUtils';

interface DueMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType?: 'regular' | 'permanent' | 'purchase';
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
      onNavigate('due-list');
    }
  };

  const effectiveType = normMemo.customerType === 'permanent' || normMemo.customerType === 'regular'
    ? normMemo.customerType
    : (dueType === 'permanent' ? 'permanent' : 'regular');

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
