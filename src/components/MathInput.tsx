import React, { useState, useEffect, useRef, type InputHTMLAttributes } from 'react';

interface MathInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const MathInput: React.FC<MathInputProps> = ({ value, onChange, onBlur, onKeyDown, ...props }) => {
  const [localValue, setLocalValue] = useState(value !== undefined && value !== null ? value.toString() : '');
  const localValueRef = useRef(value !== undefined && value !== null ? value.toString() : '');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const strVal = value !== undefined && value !== null ? value.toString() : '';
    if (strVal !== localValueRef.current) {
      setLocalValue(strVal);
      localValueRef.current = strVal;
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

  // Ensure any pending value is committed when unmounting (e.g. clicking Back button)
  useEffect(() => {
    return () => {
      const val = localValueRef.current;
      if (val) {
        const evaluated = evaluateExpression(val);
        triggerChange(evaluated || val);
      }
    };
  }, []);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const evaluated = evaluateExpression(val);
      if (evaluated !== val) {
        setLocalValue(evaluated);
        localValueRef.current = evaluated;
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
          localValueRef.current = evaluated;
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
        const val = e.target.value;
        setLocalValue(val);
        localValueRef.current = val;
        if (val === '' || !isNaN(Number(val))) {
          triggerChange(val);
        }
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
};
