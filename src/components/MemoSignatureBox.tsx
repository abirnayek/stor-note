import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Trash2, Check, Edit3, Save } from 'lucide-react';

interface MemoSignatureBoxProps {
  label: string;
  signatureData?: string;
  penColor?: string;
  disabled?: boolean;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}

export const MemoSignatureBox: React.FC<MemoSignatureBoxProps> = ({
  label,
  signatureData,
  penColor = '#72be44',
  disabled = false,
  onSave,
  onClear,
}) => {
  const sigPad = useRef<SignatureCanvas>(null);
  const [isEditing, setIsEditing] = useState(!signatureData);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!signatureData) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [signatureData]);

  const handleSave = () => {
    if (sigPad.current) {
      if (sigPad.current.isEmpty()) {
        onSave('');
      } else {
        const data = sigPad.current.toDataURL('image/png');
        onSave(data);
      }
      setJustSaved(true);
      setTimeout(() => {
        setJustSaved(false);
        setIsEditing(false);
      }, 500);
    }
  };

  const handleStrokeEnd = () => {
    if (sigPad.current && !sigPad.current.isEmpty()) {
      const data = sigPad.current.toDataURL('image/png');
      onSave(data);
    }
  };

  const handleClear = () => {
    if (sigPad.current) {
      sigPad.current.clear();
    }
    onClear();
    setIsEditing(true);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className="sig-box-dark" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '220px' }}>
      <div 
        className="sig-canvas-container" 
        style={{ 
          position: 'relative', 
          width: '100%', 
          height: '90px', 
          background: 'rgba(0, 0, 0, 0.45)', 
          borderRadius: '8px', 
          overflow: 'hidden', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          border: '1.5px dashed rgba(114, 190, 68, 0.4)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
        }}
      >
        {signatureData && !isEditing ? (
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
            <img 
              src={signatureData} 
              alt={label} 
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
            />
            {!disabled && (
              <div 
                style={{ 
                  position: 'absolute', 
                  top: '4px', 
                  right: '4px', 
                  display: 'flex', 
                  gap: '4px',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '2px 4px',
                  borderRadius: '6px'
                }} 
                data-html2canvas-ignore
              >
                <button
                  type="button"
                  style={{ 
                    background: '#2196f3', 
                    color: '#fff', 
                    padding: '3px 8px', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    border: 'none', 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                  onClick={handleStartEdit}
                  title="স্বাক্ষর পরিবর্তন করুন"
                >
                  <Edit3 size={12} /> এডিট
                </button>
                <button
                  type="button"
                  style={{ 
                    background: '#e53935', 
                    color: '#fff', 
                    padding: '3px 6px', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    border: 'none', 
                    display: 'flex', 
                    alignItems: 'center' 
                  }}
                  onClick={handleClear}
                  title="স্বাক্ষর মুছুন"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <SignatureCanvas
              ref={sigPad}
              penColor={penColor}
              canvasProps={{
                className: 'sigCanvas',
                style: { width: '100%', height: '100%', cursor: 'crosshair' }
              }}
              onEnd={handleStrokeEnd}
            />
          </div>
        )}
      </div>

      {/* Control Buttons below the canvas during editing */}
      {(!signatureData || isEditing) && !disabled && (
        <div 
          style={{ 
            display: 'flex', 
            gap: '8px', 
            marginTop: '6px', 
            width: '100%', 
            justifyContent: 'center' 
          }} 
          data-html2canvas-ignore
        >
          <button
            type="button"
            style={{ 
              background: justSaved ? '#4caf50' : '#72be44', 
              color: '#000', 
              padding: '4px 12px', 
              borderRadius: '6px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px', 
              fontWeight: 'bold', 
              fontSize: '12px', 
              cursor: 'pointer', 
              border: 'none',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              transition: 'all 0.2s'
            }}
            onClick={handleSave}
          >
            {justSaved ? <Check size={14} /> : <Save size={14} />}
            {justSaved ? 'সেভ হয়েছে ✔' : 'সেভ (Save)'}
          </button>
          
          <button
            type="button"
            style={{ 
              background: 'rgba(234, 67, 53, 0.2)', 
              color: '#ff6b6b', 
              border: '1px solid rgba(234, 67, 53, 0.4)', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px' 
            }}
            onClick={handleClear}
            title="মুছুন"
          >
            <Trash2 size={12} /> মুছুন
          </button>
        </div>
      )}

      <span style={{ marginTop: '4px', fontSize: '0.85rem', color: '#ccc', fontWeight: 500 }}>{label}</span>
    </div>
  );
};
