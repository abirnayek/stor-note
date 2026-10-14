import React, { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';

export interface MathInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number;
  debounceMs?: number;
  onTripleClick?: () => void;
  onAddRow?: () => void;
  isLastRow?: boolean;
}

export interface DebouncedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: string | number;
  debounceMs?: number;
  onTripleClick?: () => void;
  onAddRow?: () => void;
  isLastRow?: boolean;
}

/**
 * Tracks column index of the last active input for auto-focusing on the same column in newly added row.
 */
export let lastFocusedColIndex: number | null = null;

/**
 * Focuses the newly added row in a table.
 */
export const focusNewTableRow = (tableSelector = '.memo-dark-table') => {
  setTimeout(() => {
    const table = document.querySelector(tableSelector) || document.querySelector('table');
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const inputs = Array.from(lastRow.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
        if (inputs.length > 0) {
          const idx = (lastFocusedColIndex !== null && inputs[lastFocusedColIndex]) ? lastFocusedColIndex : 0;
          inputs[idx]?.focus();
        }
      }
    }
  }, 60);
};

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
 * Supports:
 * - 3 Enters in any cell to add a new row
 * - 1 Down Arrow on the last row (when no row below it) to add a new row
 * - Up/Down arrow table row navigation
 * - Triple click / triple tap to add a new row
 */
export const MathInput: React.FC<MathInputProps> = ({ 
  value, 
  onChange, 
  onBlur, 
  onFocus,
  onKeyDown, 
  onTripleClick,
  onAddRow,
  isLastRow,
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
  const lastEmittedValueRef = useRef<string>(value !== undefined && value !== null ? value.toString() : '');

  const lastClickTimeRef = useRef(0);
  const clickCountRef = useRef(0);
  const lastTouchTimeRef = useRef(0);
  const touchCountRef = useRef(0);
  const enterCountRef = useRef(0);
  const lastEnterTimeRef = useRef(0);

  const triggerAddRow = () => {
    const fn = onAddRow || onTripleClick;
    if (fn) {
      fn();
    }
  };

  const recordColIndex = () => {
    const currentInput = inputRef.current;
    const currentTr = currentInput?.closest('tr');
    if (currentTr && currentInput) {
      const currentInputs = Array.from(currentTr.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
      const colIndex = currentInputs.indexOf(currentInput);
      lastFocusedColIndex = colIndex >= 0 ? colIndex : 0;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 650) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 3 || e.detail >= 3) {
      clickCountRef.current = 0;
      recordColIndex();
      triggerAddRow();
    }
    if (props.onClick) {
      props.onClick(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastTouchTimeRef.current < 550) {
      touchCountRef.current += 1;
    } else {
      touchCountRef.current = 1;
    }
    lastTouchTimeRef.current = now;

    if (touchCountRef.current >= 3) {
      touchCountRef.current = 0;
      recordColIndex();
      triggerAddRow();
    }
    if (props.onTouchEnd) {
      props.onTouchEnd(e);
    }
  };

  // Sync with prop changes (both external updates and unfocused sync)
  useEffect(() => {
    const strVal = value !== undefined && value !== null ? value.toString() : '';
    if (strVal !== lastEmittedValueRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setLocalValue(strVal);
      localValueRef.current = strVal;
      lastEmittedValueRef.current = strVal;
    } else if (!isFocusedRef.current) {
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
    lastEmittedValueRef.current = val;
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
    recordColIndex();
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
      recordColIndex();

      const now = Date.now();
      if (now - lastEnterTimeRef.current < 1500) {
        enterCountRef.current += 1;
      } else {
        enterCountRef.current = 1;
      }
      lastEnterTimeRef.current = now;

      if (enterCountRef.current >= 3) {
        enterCountRef.current = 0;
        triggerAddRow();
      }
    } else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
      enterCountRef.current = 0;
    }

    if (e.key === 'ArrowDown') {
      commitValue();
      const currentInput = inputRef.current;
      const currentTr = currentInput?.closest('tr');
      if (currentTr) {
        const currentInputs = Array.from(currentTr.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
        const colIndex = currentInput ? currentInputs.indexOf(currentInput) : 0;
        lastFocusedColIndex = colIndex >= 0 ? colIndex : 0;

        const nextTr = currentTr.nextElementSibling as HTMLTableRowElement | null;
        if (nextTr && nextTr.tagName === 'TR') {
          e.preventDefault();
          const nextInputs = Array.from(nextTr.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
          if (nextInputs.length > 0) {
            const target = (colIndex >= 0 && nextInputs[colIndex]) ? nextInputs[colIndex] : nextInputs[0];
            target.focus();
          }
        } else {
          // No line below it! "atar niche r kono line na thakle sakhane notun line jog hobe"
          e.preventDefault();
          triggerAddRow();
        }
      } else if (isLastRow) {
        e.preventDefault();
        lastFocusedColIndex = 0;
        triggerAddRow();
      }
    }

    if (e.key === 'ArrowUp') {
      commitValue();
      const currentInput = inputRef.current;
      const currentTr = currentInput?.closest('tr');
      if (currentTr) {
        const currentInputs = Array.from(currentTr.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
        const colIndex = currentInput ? currentInputs.indexOf(currentInput) : 0;
        lastFocusedColIndex = colIndex >= 0 ? colIndex : 0;

        const prevTr = currentTr.previousElementSibling as HTMLTableRowElement | null;
        if (prevTr && prevTr.tagName === 'TR') {
          e.preventDefault();
          const prevInputs = Array.from(prevTr.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
          if (prevInputs.length > 0) {
            const target = (colIndex >= 0 && prevInputs[colIndex]) ? prevInputs[colIndex] : prevInputs[0];
            target.focus();
          }
        }
      }
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
      onTouchEnd={handleTouchEnd}
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
 * Supports:
 * - 3 Enters in any cell to add a new row
 * - 1 Down Arrow on the last row (when no row below it) to add a new row
 * - Up/Down arrow table row navigation
 * - Triple click / triple tap to add a new row
 */
export const DebouncedInput: React.FC<DebouncedInputProps> = ({
  value,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  onTripleClick,
  onAddRow,
  isLastRow,
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
  const lastEmittedValueRef = useRef<string>(value !== undefined && value !== null ? value.toString() : '');

  const lastClickTimeRef = useRef(0);
  const clickCountRef = useRef(0);
  const lastTouchTimeRef = useRef(0);
  const touchCountRef = useRef(0);
  const enterCountRef = useRef(0);
  const lastEnterTimeRef = useRef(0);

  const triggerAddRow = () => {
    const fn = onAddRow || onTripleClick;
    if (fn) {
      fn();
    }
  };

  const recordColIndex = () => {
    const currentInput = inputRef.current;
    const currentTr = currentInput?.closest('tr');
    if (currentTr && currentInput) {
      const currentInputs = Array.from(currentTr.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
      const colIndex = currentInputs.indexOf(currentInput);
      lastFocusedColIndex = colIndex >= 0 ? colIndex : 0;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 650) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 3 || e.detail >= 3) {
      clickCountRef.current = 0;
      recordColIndex();
      triggerAddRow();
    }
    if (props.onClick) {
      props.onClick(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    const now = Date.now();
    if (now - lastTouchTimeRef.current < 550) {
      touchCountRef.current += 1;
    } else {
      touchCountRef.current = 1;
    }
    lastTouchTimeRef.current = now;

    if (touchCountRef.current >= 3) {
      touchCountRef.current = 0;
      recordColIndex();
      triggerAddRow();
    }
    if (props.onTouchEnd) {
      props.onTouchEnd(e);
    }
  };

  useEffect(() => {
    const strVal = value !== undefined && value !== null ? value.toString() : '';
    if (strVal !== lastEmittedValueRef.current) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setLocalValue(strVal);
      localValueRef.current = strVal;
      lastEmittedValueRef.current = strVal;
    } else if (!isFocusedRef.current) {
      setLocalValue(strVal);
      localValueRef.current = strVal;
    }
  }, [value]);

  const triggerChange = (val: string) => {
    lastEmittedValueRef.current = val;
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
    recordColIndex();
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
      recordColIndex();

      const now = Date.now();
      if (now - lastEnterTimeRef.current < 1500) {
        enterCountRef.current += 1;
      } else {
        enterCountRef.current = 1;
      }
      lastEnterTimeRef.current = now;

      if (enterCountRef.current >= 3) {
        enterCountRef.current = 0;
        triggerAddRow();
      }
    } else if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
      enterCountRef.current = 0;
    }

    if (e.key === 'ArrowDown') {
      commitValue();
      const currentInput = inputRef.current;
      const currentTr = currentInput?.closest('tr');
      if (currentTr) {
        const currentInputs = Array.from(currentTr.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
        const colIndex = currentInput ? currentInputs.indexOf(currentInput) : 0;
        lastFocusedColIndex = colIndex >= 0 ? colIndex : 0;

        const nextTr = currentTr.nextElementSibling as HTMLTableRowElement | null;
        if (nextTr && nextTr.tagName === 'TR') {
          e.preventDefault();
          const nextInputs = Array.from(nextTr.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
          if (nextInputs.length > 0) {
            const target = (colIndex >= 0 && nextInputs[colIndex]) ? nextInputs[colIndex] : nextInputs[0];
            target.focus();
          }
        } else {
          // No line below it! "atar niche r kono line na thakle sakhane notun line jog hobe"
          e.preventDefault();
          triggerAddRow();
        }
      } else if (isLastRow) {
        e.preventDefault();
        lastFocusedColIndex = 0;
        triggerAddRow();
      }
    }

    if (e.key === 'ArrowUp') {
      commitValue();
      const currentInput = inputRef.current;
      const currentTr = currentInput?.closest('tr');
      if (currentTr) {
        const currentInputs = Array.from(currentTr.querySelectorAll('input:not([type="hidden"]):not([disabled])'));
        const colIndex = currentInput ? currentInputs.indexOf(currentInput) : 0;
        lastFocusedColIndex = colIndex >= 0 ? colIndex : 0;

        const prevTr = currentTr.previousElementSibling as HTMLTableRowElement | null;
        if (prevTr && prevTr.tagName === 'TR') {
          e.preventDefault();
          const prevInputs = Array.from(prevTr.querySelectorAll('input:not([type="hidden"]):not([disabled])')) as HTMLInputElement[];
          if (prevInputs.length > 0) {
            const target = (colIndex >= 0 && prevInputs[colIndex]) ? prevInputs[colIndex] : prevInputs[0];
            target.focus();
          }
        }
      }
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
      onTouchEnd={handleTouchEnd}
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
