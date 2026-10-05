import React, { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';

interface MathInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number;
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

export const MathInput: React.FC<MathInputProps> = ({ value, onChange, onBlur, onKeyDown, ...props }) => {
  const [localValue, setLocalValue] = useState(value !== undefined && value !== null ? value.toString() : '');
  const localValueRef = useRef(value !== undefined && value !== null ? value.toString() : '');
  const lastSentValueRef = useRef(value !== undefined && value !== null ? value.toString() : '');
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const strVal = value !== undefined && value !== null ? value.toString() : '';
    const isFocused = inputRef.current && document.activeElement === inputRef.current;
    
    if (!isFocused) {
      if (strVal !== localValueRef.current) {
        setLocalValue(strVal);
        localValueRef.current = strVal;
        lastSentValueRef.current = strVal;
      }
    } else {
      if (strVal !== lastSentValueRef.current && strVal !== localValueRef.current) {
        setLocalValue(strVal);
        localValueRef.current = strVal;
        lastSentValueRef.current = strVal;
      }
    }
  }, [value]);

  const evaluateExpression = (expr: string): string => {
    if (!expr || !expr.trim()) return '';
    try {
      // 1. Bengali numerals conversion (০-৯ -> 0-9)
      let converted = expr.replace(/[০-৯]/g, (d) => (d.charCodeAt(0) - 0x09e6).toString());
      // 2. Operators & commas
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
    lastSentValueRef.current = val;
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
    const current = localValueRef.current;
    if (current) {
      const evaluated = evaluateExpression(current);
      setLocalValue(evaluated);
      localValueRef.current = evaluated;
      triggerChange(evaluated);
    } else {
      setLocalValue('');
      localValueRef.current = '';
      triggerChange('');
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
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
      onChange={(e) => {
        const val = e.target.value;
        setLocalValue(val);
        localValueRef.current = val;
        
        // Check if value can be parsed cleanly so linked totals update in real-time
        const parsed = parseMathOrNumber(val);
        if (parsed !== '') {
          triggerChange(parsed.toString());
        } else {
          triggerChange(val);
        }
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};

