import React from 'react';
import { type Screen } from '../App';
import SalesMemoScreen from './SalesMemoScreen';

interface DueMemoScreenProps {
  onNavigate: (screen: Screen) => void;
  dueType?: 'regular' | 'permanent' | 'purchase';
  dueId: string;
  isPaid?: boolean;
}

const DueSalesMemoScreen: React.FC<DueMemoScreenProps> = ({ onNavigate, dueType: _dueType, dueId, isPaid = false }) => {
  let targetLotNumber: number | null = null;
  const saved = localStorage.getItem(`due_memo_${dueId}`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.lotNumber) targetLotNumber = parseInt(parsed.lotNumber, 10) || null;
      if (!targetLotNumber && parsed.memoState && parsed.memoState.lotNumberInput) {
        targetLotNumber = parseInt(parsed.memoState.lotNumberInput, 10) || null;
      }
    } catch(e) {}
  }

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
    />
  );
};

export default DueSalesMemoScreen;
