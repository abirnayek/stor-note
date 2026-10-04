import { useState, useCallback, useRef, useEffect } from 'react';

export function useHistory<T>(initialState: T, storageKey?: string, maxHistory: number = 100) {
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([]);
  const isInternalUpdate = useRef(false);
  const debounceTimerRef = useRef<any>(null);
  const lastPushedStateRef = useRef<string>(JSON.stringify(initialState));

  useEffect(() => {
    if (!storageKey) return;
    
    const handleStorage = () => {
      if (isInternalUpdate.current) {
         isInternalUpdate.current = false;
         return;
      }
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState(parsed);
        } catch(e) {}
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  const setWithHistory = useCallback((newState: T | ((prev: T) => T)) => {
    isInternalUpdate.current = true;
    setState((prev) => {
      const nextState = typeof newState === 'function' ? (newState as Function)(prev) : newState;
      
      const prevSerialized = JSON.stringify(prev);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        if (prevSerialized !== lastPushedStateRef.current) {
          try {
            historyRef.current.push(JSON.parse(prevSerialized));
            if (historyRef.current.length > maxHistory) {
              historyRef.current.shift();
            }
            lastPushedStateRef.current = prevSerialized;
          } catch(e) {}
        }
      }, 400);

      return nextState;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    isInternalUpdate.current = true;
    const previousState = historyRef.current.pop()!;
    lastPushedStateRef.current = JSON.stringify(previousState);
    setState(previousState);
  }, []);

  const canUndo = historyRef.current.length > 0;

  return [state, setWithHistory, undo, canUndo] as const;
}
