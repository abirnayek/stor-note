import React, { useRef, useEffect } from 'react';
import { Phone, MessageCircle } from 'lucide-react';

interface CallMenuProps {
  phones: string[];
  onClose: () => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const CallMenu: React.FC<CallMenuProps> = ({ phones, onClose, position = 'bottom' }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const finalPhone = cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone;
    return `https://wa.me/${finalPhone}`;
  };

  const getTelLink = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `tel:${cleanPhone}`;
  };

  const posStyles: React.CSSProperties = {
    position: 'absolute',
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '12px',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: '150px'
  };

  if (position === 'bottom') {
    posStyles.top = '100%';
    posStyles.left = 0;
    posStyles.marginTop = '8px';
  } else if (position === 'left') {
    posStyles.top = 0;
    posStyles.right = '100%';
    posStyles.marginRight = '8px';
  } else if (position === 'right') {
    posStyles.top = 0;
    posStyles.left = '100%';
    posStyles.marginLeft = '8px';
  }

  return (
    <div ref={menuRef} style={posStyles} data-html2canvas-ignore>
      {phones.map((phone, idx) => (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {phones.length > 1 && <div style={{ fontSize: '0.8rem', color: '#aaa', marginBottom: '-4px' }}>{phone}</div>}
          <a href={getWhatsAppLink(phone)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366', textDecoration: 'none', fontSize: '0.9rem', padding: '4px', borderRadius: '4px', transition: 'background 0.2s' }}>
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a href={getTelLink(phone)} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', textDecoration: 'none', fontSize: '0.9rem', padding: '4px', borderRadius: '4px', transition: 'background 0.2s' }}>
            <Phone size={16} /> Mobile Call
          </a>
          {idx < phones.length - 1 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />}
        </div>
      ))}
    </div>
  );
};

export default CallMenu;
