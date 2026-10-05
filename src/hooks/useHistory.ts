import { useState, useCallback, useRef, useEffect } from 'react';

export function useHistory<T>(initialState: T, storageKey?: string, maxHistory: number = 100) {
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([]); // Past states stack for Undo
  const redoRef = useRef<T[]>([]);    // Future states stack for Redo
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
      const nextSerialized = JSON.stringify(nextState);

      if (prevSerialized === nextSerialized) return prev;

      // Clear redo stack on new user action
      redoRef.current = [];

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
      }, 300);

      return nextState;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    isInternalUpdate.current = true;
    setState((current) => {
      const previousState = historyRef.current.pop()!;
      redoRef.current.push(JSON.parse(JSON.stringify(current)));
      lastPushedStateRef.current = JSON.stringify(previousState);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(previousState)); } catch(e) {}
      }
      return previousState;
    });
  }, [storageKey]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    isInternalUpdate.current = true;
    setState((current) => {
      const nextState = redoRef.current.pop()!;
      historyRef.current.push(JSON.parse(JSON.stringify(current)));
      lastPushedStateRef.current = JSON.stringify(nextState);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(nextState)); } catch(e) {}
      }
      return nextState;
    });
  }, [storageKey]);

  const canUndo = historyRef.current.length > 0;
  const canRedo = redoRef.current.length > 0;

  return [state, setWithHistory, undo, redo, canUndo, canRedo] as const;
}
