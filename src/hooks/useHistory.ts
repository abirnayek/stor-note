import { useState, useCallback, useRef } from 'react';

export function useHistory<T>(initialState: T, maxHistory: number = 100) {
  const [state, setState] = useState<T>(initialState);
  const historyRef = useRef<T[]>([]);

  const setWithHistory = useCallback((newState: T | ((prev: T) => T)) => {
    setState((prev) => {
      const nextState = typeof newState === 'function' ? (newState as Function)(prev) : newState;
      
      // Save deep copy of prev to history
      historyRef.current.push(JSON.parse(JSON.stringify(prev)));
      if (historyRef.current.length > maxHistory) {
        historyRef.current.shift(); // Remove oldest
      }
      return nextState;
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const previousState = historyRef.current.pop()!;
    setState(previousState);
  }, []);

  const canUndo = historyRef.current.length > 0;

  return [state, setWithHistory, undo, canUndo] as const;
}
