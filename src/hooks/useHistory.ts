import { useState, useCallback, useRef, useEffect } from 'react';

export interface SetHistoryOptions {
  recordHistory?: boolean; // default true. If false, updates state without affecting history/redo
  immediate?: boolean;     // default false. If true, immediately pushes a history checkpoint without debouncing
}

export type SetWithHistory<T> = (
  newState: T | ((prev: T) => T),
  options?: SetHistoryOptions
) => void;

export function useHistory<T>(initialState: T | (() => T), storageKey?: string, maxHistory: number = 100) {
  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef<T>(state);
  stateRef.current = state;

  const historyRef = useRef<T[]>([]); // Past states stack for Undo
  const redoRef = useRef<T[]>([]);    // Future states stack for Redo
  const pendingBaseStateRef = useRef<T | null>(null); // Base state before a debounced typing burst
  const debounceTimerRef = useRef<any>(null);

  const [historyCount, setHistoryCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const persistTimerRef = useRef<any>(null);

  const persistState = useCallback((val: T, immediate = false) => {
    if (!storageKey) return;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (immediate) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(val));
      } catch (e) {}
    } else {
      persistTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(val));
        } catch (e) {}
      }, 300);
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        if (storageKey && stateRef.current) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(stateRef.current));
          } catch (e) {}
        }
      }
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    
    const handleStorage = (e: StorageEvent) => {
      // Only reload if the event is a genuine StorageEvent for this exact storageKey from another tab/window
      if (!e.key || e.key !== storageKey) return;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (JSON.stringify(parsed) === JSON.stringify(stateRef.current)) {
            return;
          }
          setState(parsed);
          stateRef.current = parsed;
        } catch(e) {}
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const setWithHistory: SetWithHistory<T> = useCallback((
    newState: T | ((prev: T) => T),
    options?: SetHistoryOptions
  ) => {
    const recordHistory = options?.recordHistory !== false;
    const immediate = options?.immediate === true;

    setState((prev) => {
      const nextState = typeof newState === 'function' ? (newState as Function)(prev) : newState;
      
      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(nextState);

      if (prevSerialized === nextSerialized) return prev;

      if (!recordHistory) {
        // Programmatic / background update: update state & storage without disturbing history or redo
        stateRef.current = nextState;
        persistState(nextState, true);
        return nextState;
      }

      // New user action clears redo stack
      if (redoRef.current.length > 0) {
        redoRef.current = [];
        setRedoCount(0);
      }

      if (immediate) {
        // If there was an active typing session pending, commit it first
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        if (pendingBaseStateRef.current !== null) {
          const baseSerialized = JSON.stringify(pendingBaseStateRef.current);
          if (baseSerialized !== prevSerialized) {
            historyRef.current.push(JSON.parse(baseSerialized));
          }
          pendingBaseStateRef.current = null;
        }

        // Commit previous state as an immediate discrete checkpoint
        historyRef.current.push(JSON.parse(prevSerialized));
        if (historyRef.current.length > maxHistory) {
          historyRef.current.shift();
        }
        setHistoryCount(historyRef.current.length);
      } else {
        // User typing action: establish baseline state for this edit sequence
        if (pendingBaseStateRef.current === null) {
          pendingBaseStateRef.current = JSON.parse(prevSerialized);
          setHistoryCount(historyRef.current.length + 1); // Instantly enable Undo button while typing
        }

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          if (pendingBaseStateRef.current !== null) {
            const baseSerialized = JSON.stringify(pendingBaseStateRef.current);
            const currentSerialized = JSON.stringify(stateRef.current);
            if (baseSerialized !== currentSerialized) {
              historyRef.current.push(JSON.parse(baseSerialized));
              if (historyRef.current.length > maxHistory) {
                historyRef.current.shift();
              }
            }
            pendingBaseStateRef.current = null;
            setHistoryCount(historyRef.current.length);
          }
        }, 400);
      }

      stateRef.current = nextState;
      persistState(nextState, immediate);
      return nextState;
    });
  }, [maxHistory, persistState]);

  const undo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setState((current) => {
      let previousState: T | undefined;

      // If user was in the middle of typing, rolling back to the typing baseline is the first undo step
      if (pendingBaseStateRef.current !== null) {
        previousState = pendingBaseStateRef.current;
        pendingBaseStateRef.current = null;
        redoRef.current.push(JSON.parse(JSON.stringify(current)));
      } else if (historyRef.current.length > 0) {
        previousState = historyRef.current.pop();
        if (previousState) {
          redoRef.current.push(JSON.parse(JSON.stringify(current)));
        }
      }

      if (!previousState) return current;

      if (redoRef.current.length > maxHistory) {
        redoRef.current.shift();
      }

      stateRef.current = previousState;
      persistState(previousState, true);

      setHistoryCount(historyRef.current.length);
      setRedoCount(redoRef.current.length);

      return previousState;
    });
  }, [persistState, maxHistory]);

  const redo = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      pendingBaseStateRef.current = null;
    }

    if (redoRef.current.length === 0) return;

    setState((current) => {
      const nextState = redoRef.current.pop();
      if (!nextState) return current;

      historyRef.current.push(JSON.parse(JSON.stringify(current)));
      if (historyRef.current.length > maxHistory) {
        historyRef.current.shift();
      }

      stateRef.current = nextState;
      persistState(nextState, true);

      setHistoryCount(historyRef.current.length);
      setRedoCount(redoRef.current.length);

      return nextState;
    });
  }, [persistState, maxHistory]);

  const canUndo = historyCount > 0 || pendingBaseStateRef.current !== null;
  const canRedo = redoCount > 0;

  return [state, setWithHistory, undo, redo, canUndo, canRedo] as const;
}
