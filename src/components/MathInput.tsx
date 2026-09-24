import React, { useState, useEffect, type InputHTMLAttributes } from 'react';

interface MathInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const MathInput: React.FC<MathInputProps> = ({ value, onChange, onBlur, onKeyDown, ...props }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '');

  useEffect(() => {
    if (value?.toString() !== localValue) {
      setLocalValue(value?.toString() || '');
    }
  }, [value]);

  const evaluateExpression = (expr: string): string => {
    try {
      const sanitized = expr.replace(/[^\d.+\-*/()]/g, '');
      if (!sanitized) return '';
      
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + sanitized)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Number.isInteger(result) ? result.toString() : result.toFixed(2);
      }
      return '';
    } catch (e) {
      return expr;
    }
  };

  const triggerChange = (val: string) => {
    if (onChange) {
      // Create a mock event to be drop-in compatible with standard onChange
      const mockEvent = {
        target: { value: val, name: props.name || '' },
        currentTarget: { value: val, name: props.name || '' },
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange(mockEvent);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const evaluated = evaluateExpression(val);
      if (evaluated !== val) {
        setLocalValue(evaluated);
        triggerChange(evaluated);
      } else {
        triggerChange(val);
      }
    } else {
      triggerChange('');
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value;
      if (val) {
        const evaluated = evaluateExpression(val);
        if (evaluated !== val) {
          setLocalValue(evaluated);
          triggerChange(evaluated);
        } else {
          triggerChange(val);
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
      type="text"
      inputMode="text"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        if (onChange) onChange(e);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
