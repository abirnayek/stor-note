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

  return (
    <SalesMemoScreen
      onNavigate={onNavigate}
      onBack={handleBack}
      lotNumber={targetLotNumber}
      memoId={dueId}
      defaultCustomerType={dueType === 'permanent' ? 'permanent' : 'regular'}
    />
  );
};

export default DueSalesMemoScreen;
