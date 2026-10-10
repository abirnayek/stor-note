import React, { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';

export interface MathInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number;
  debounceMs?: number;
  onTripleClick?: () => void;
}

export interface DebouncedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number;
  debounceMs?: number;
  onTripleClick?: () => void;
}

/**
 * Utility to safely parse math expressions or raw numbers from input.
 * Supports Bengali numerals (০-৯ -> 0-9), common math operators (+, -, *, /, ×, ÷), and commas.
 */
export const parseMathOrNumber = (val: string | number | undefined | null): number | '' => {
  if (val === '' || val === null || val === undefined) return '';
  if (typeof val === 'number') return isNaN(val) ? '' : val;
  const str = val.toString().trim();
  if (!str) return '';
  
  // Direct numeric check
  const directNum = Number(str);
  if (!isNaN(directNum)) return directNum;
  
  // Convert Bengali numerals & common operators
  const converted = str
    .replace(/[০-৯]/g, (d) => (d.charCodeAt(0) - 0x09e6).toString())
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '');
  
  const sanitized = converted.replace(/[^\d.+\-*/()]/g, '');
  if (!sanitized) return '';
  
  try {
    // eslint-disable-next-line no-new-func
    const res = new Function('return ' + sanitized)();
    if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
      return parseFloat(res.toFixed(4));
    }
  } catch (e) {}
  
  const parsedFloat = parseFloat(converted);
  return isNaN(parsedFloat) ? '' : parsedFloat;
};

/**
 * Debounced Math Input component.
 * Instant local typing for zero lag, debounced parent updates for reactive totals without re-render stutter,
 * and automatic evaluation of math expressions on Enter or Blur.
 */
export const MathInput: React.FC<MathInputProps> = ({ 
  value, 
  onChange, 
  onBlur, 
  onFocus,
  onKeyDown, 
  onTripleClick,
  debounceMs = 500,
  ...props 
}) => {
  const [localValue, setLocalValue] = useState(value !== undefined && value !== null ? value.toString() : '');
  const localValueRef = useRef(localValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);
  const timerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const lastClickTimeRef = useRef(0);
  const clickCountRef = useRef(0);

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 450) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 3 || e.detail >= 3) {
      clickCountRef.current = 0;
      if (onTripleClick) {
        onTripleClick();
      }
    }
    if (props.onClick) {
      props.onClick(e);
    }
  };

  // Sync with prop changes when NOT focused
  useEffect(() => {
    const strVal = value !== undefined && value !== null ? value.toString() : '';
    if (!isFocusedRef.current) {
      setLocalValue(strVal);
      localValueRef.current = strVal;
    }
  }, [value]);

  const evaluateExpression = (expr: string): string => {
    if (!expr || !expr.trim()) return '';
    try {
      let converted = expr.replace(/[০-৯]/g, (d) => (d.charCodeAt(0) - 0x09e6).toString());
      converted = converted.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
      
      const sanitized = converted.replace(/[^\d.+\-*/()]/g, '');
      if (!sanitized) return '';

      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + sanitized)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(4)).toString();
      }
      return expr;
    } catch (e) {
      return expr;
    }
  };

  const triggerChange = (val: string) => {
    if (onChangeRef.current) {
      const mockEvent = {
        target: { value: val, name: props.name || '' },
        currentTarget: { value: val, name: props.name || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChangeRef.current(mockEvent);
    }
  };

  const commitValue = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const current = localValueRef.current;
    if (current) {
      const evaluated = evaluateExpression(current);
      setLocalValue(evaluated);
      localValueRef.current = evaluated;
      
      const parsed = parseMathOrNumber(evaluated);
      triggerChange(parsed !== '' ? parsed.toString() : evaluated);
    } else {
      setLocalValue('');
      localValueRef.current = '';
      triggerChange('');
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    commitValue();
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue();
      inputRef.current?.blur();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="text"
      value={localValue}
      onFocus={handleFocus}
      onClick={handleClick}
      onChange={(e) => {
        const val = e.target.value;
        setLocalValue(val);
        localValueRef.current = val;
        
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          const parsed = parseMathOrNumber(val);
          triggerChange(parsed !== '' ? parsed.toString() : val);
        }, debounceMs);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};

/**
 * General Debounced Input component for text fields.
 * Ensures typing text (names, phones, addresses) does not lag or stutter on keystrokes.
 */
export const DebouncedInput: React.FC<DebouncedInputProps> = ({
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  onTripleClick,
  debounceMs = 500,
  ...props
}) => {
  const [localValue, setLocalValue] = useState<string>(value !== undefined && value !== null ? value.toString() : '');
  const localValueRef = useRef(localValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);
  const timerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const lastClickTimeRef = useRef(0);
  const clickCountRef = useRef(0);

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 450) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 3 || e.detail >= 3) {
      clickCountRef.current = 0;
      if (onTripleClick) {
        onTripleClick();
      }
    }
    if (props.onClick) {
      props.onClick(e);
    }
  };

  useEffect(() => {
    const strVal = value !== undefined && value !== null ? value.toString() : '';
    if (!isFocusedRef.current) {
      setLocalValue(strVal);
      localValueRef.current = strVal;
    }
  }, [value]);

  const triggerChange = (val: string) => {
    if (onChangeRef.current) {
      const mockEvent = {
        target: { value: val, name: props.name || '' },
        currentTarget: { value: val, name: props.name || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChangeRef.current(mockEvent);
    }
  };

  const commitValue = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    triggerChange(localValueRef.current);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    if (onFocus) {
      onFocus(e);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    commitValue();
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitValue();
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <input
      {...props}
      ref={inputRef}
      value={localValue}
      onFocus={handleFocus}
      onClick={handleClick}
      onChange={(e) => {
        const val = e.target.value;
        setLocalValue(val);
        localValueRef.current = val;

        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
          triggerChange(val);
        }, debounceMs);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
