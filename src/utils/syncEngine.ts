import { supabase } from './supabaseClient';

let currentUser: any = null;

// Initialize and listen to auth changes
supabase.auth.getSession().then(({ data: { session } }) => {
  currentUser = session?.user || null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
});

let isRestoring = false;

export const initSyncEngine = () => {
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;

  localStorage.setItem = function(key: string, value: string) {
    originalSetItem.apply(this, [key, value] as any);
    
    if (currentUser && !isRestoring) {
      // Skip auth keys to avoid infinite loops or saving tokens to the db
      if (key.startsWith('sb-')) return;
      
      supabase.from('user_backups').upsert({
        user_id: currentUser.id,
        key: key,
        value: value,
        updated_at: new Date().toISOString()
      }).then(({ error }) => {
        if (error) console.error('Sync error:', error);
      });
    }
  };

  localStorage.removeItem = function(key: string) {
    originalRemoveItem.apply(this, [key] as any);
    
    if (currentUser && !isRestoring) {
      if (key.startsWith('sb-')) return;

      supabase.from('user_backups').delete().match({ 
        user_id: currentUser.id, 
        key: key 
      }).then(({ error }) => {
        if (error) console.error('Sync error:', error);
      });
    }
  };
  
  // We generally don't use localStorage.clear() in the app for data, but just in case
  localStorage.clear = function() {
    originalClear.apply(this);
  };
};

export const restoreFromCloud = async () => {
  // Ensure we have the user before attempting restore
  if (!currentUser) {
    const { data } = await supabase.auth.getSession();
    currentUser = data.session?.user || null;
  }
  if (!currentUser) return false;
  
  isRestoring = true;
  try {
    const { data, error } = await supabase
      .from('user_backups')
      .select('key, value');
      
    if (error) throw error;
    
    if (data && data.length > 0) {
      // Use original setItem to avoid triggering the interceptor
      const originalSetItem = localStorage.setItem;
      data.forEach(row => {
        // Only set if not already set or different
        if (localStorage.getItem(row.key) !== row.value) {
           originalSetItem.call(localStorage, row.key, row.value);
        }
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to restore from cloud', error);
    return false;
  } finally {
    isRestoring = false;
  }
};

export const setupRealtimeSync = () => {
  if (!currentUser) return;
  
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  
  supabase
    .channel('user_backups_changes')
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_backups', 
        filter: `user_id=eq.${currentUser.id}` 
      }, 
      (payload: any) => {
        isRestoring = true; // prevent our own listeners from firing back
        if (payload.eventType === 'DELETE') {
          const key = payload.old?.key;
          if (key) originalRemoveItem.call(localStorage, key);
        } else {
          const key = payload.new?.key;
          const value = payload.new?.value;
          if (key && value && localStorage.getItem(key) !== value) {
            originalSetItem.call(localStorage, key, value);
            // Optionally dispatch an event so React re-renders, but most data is read on navigate
            window.dispatchEvent(new Event('storage'));
          }
        }
        isRestoring = false;
    })
    .subscribe();
};
