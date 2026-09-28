import { supabase } from './supabaseClient';

let currentUser: any = null;

// Initialize and listen to auth changes
supabase.auth.getSession().then(({ data: { session } }) => {
  currentUser = session?.user || null;
  if (currentUser) {
    pushUnsyncedLocalData(true).then(() => restoreFromCloud());
    setupRealtimeSync();
  }
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  if (currentUser) {
    pushUnsyncedLocalData(true).then(() => restoreFromCloud());
    setupRealtimeSync();
  }
});

let isRestoring = false;

// Auto-sync in background when tab becomes visible or every 10 seconds
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) {
      pushUnsyncedLocalData(true).then(() => restoreFromCloud());
    }
  });

  setInterval(() => {
    if (currentUser && !isRestoring) {
      pushUnsyncedLocalData(true).then(() => restoreFromCloud());
    }
  }, 10000);
}

export const initSyncEngine = () => {
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalGetItem = localStorage.getItem;
  const originalClear = localStorage.clear;

  const updateLocalTimestamp = (key: string) => {
    try {
      const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
      const ts = tsStr ? JSON.parse(tsStr) : {};
      ts[key] = Date.now();
      originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(ts));
    } catch(e) {}
  };

  localStorage.setItem = function(key: string, value: string) {
    originalSetItem.apply(this, [key, value] as any);
    
    if (currentUser && !isRestoring) {
      // Skip auth keys to avoid infinite loops or saving tokens to the db
      if (key.startsWith('sb-') || key === 'local_timestamps') return;
      
      updateLocalTimestamp(key);
      
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
      if (key.startsWith('sb-') || key === 'local_timestamps') return;

      updateLocalTimestamp(key);

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
      .select('key, value, updated_at');
      
    if (error) throw error;
    
    if (data && data.length > 0) {
      // Use original setItem to avoid triggering the interceptor
      const originalSetItem = localStorage.setItem;
      const originalGetItem = localStorage.getItem;
      
      const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
      const localTimestamps = tsStr ? JSON.parse(tsStr) : {};
      let timestampsModified = false;

      const cloudKeys = new Set(data.map(r => r.key));
      
      // Handle cloud -> local
      data.forEach(row => {
        const localTs = localTimestamps[row.key] || 0;
        const cloudTs = new Date(row.updated_at).getTime();
        
        // If cloud is newer OR we don't have a local timestamp (first sync), accept cloud data
        if (cloudTs >= localTs || localTs === 0) {
          if (originalGetItem.call(localStorage, row.key) !== row.value) {
             originalSetItem.call(localStorage, row.key, row.value);
             localTimestamps[row.key] = cloudTs;
             timestampsModified = true;
          }
        } else if (localTs > cloudTs) {
          // Local is newer! Push local to cloud.
          const localValue = originalGetItem.call(localStorage, row.key);
          if (localValue !== null) {
            supabase.from('user_backups').upsert({
              user_id: currentUser.id,
              key: row.key,
              value: localValue,
              updated_at: new Date(localTs).toISOString()
            }).then(() => {});
          }
        }
      });
      
      // Handle local deletes (key exists in local_timestamps but not in cloud)
      Object.keys(localTimestamps).forEach(key => {
        if (!cloudKeys.has(key)) {
          const localValue = originalGetItem.call(localStorage, key);
          if (localValue !== null && Date.now() - localTimestamps[key] < 86400000) { // If modified in last 24h, push it
            supabase.from('user_backups').upsert({
              user_id: currentUser.id,
              key: key,
              value: localValue,
              updated_at: new Date(localTimestamps[key]).toISOString()
            }).then(() => {});
          } else if (localValue === null) {
            // Already deleted locally, clean up timestamp
            delete localTimestamps[key];
            timestampsModified = true;
          }
        }
      });

      if (timestampsModified) {
        originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(localTimestamps));
      }
      window.dispatchEvent(new Event('storage'));
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
          if (key) {
            originalRemoveItem.call(localStorage, key);
            window.dispatchEvent(new Event('storage'));
          }
        } else {
          const key = payload.new?.key;
          const value = payload.new?.value;
          if (key && value && localStorage.getItem(key) !== value) {
            originalSetItem.call(localStorage, key, value);
            window.dispatchEvent(new Event('storage'));
          }
        }
        isRestoring = false;
    })
    .subscribe();
};

export const pushUnsyncedLocalData = async (forceAll: boolean = true) => {
  try {
    if (!currentUser) {
      const { data } = await supabase.auth.getSession();
      currentUser = data.session?.user || null;
    }
    if (!currentUser) return;

    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
    const ts = tsStr ? JSON.parse(tsStr) : {};
    
    const keysToSync = Object.keys(localStorage).filter(k => 
      !k.startsWith('sb-') && k !== 'local_timestamps' && k !== 'device_id' && k !== 'device_permission' && !k.startsWith('localhost_')
    );
    
    const rowsToUpsert: any[] = [];
    const nowISO = new Date().toISOString();
    const nowMs = Date.now();

    for (const key of keysToSync) {
      const value = originalGetItem.call(localStorage, key);
      if (value) {
        if (forceAll || !ts[key]) {
          rowsToUpsert.push({
            user_id: currentUser.id,
            key: key,
            value: value,
            updated_at: nowISO
          });
          ts[key] = nowMs;
        }
      }
    }

    if (rowsToUpsert.length > 0) {
      // Upsert all rows in a single batch request
      const { error } = await supabase.from('user_backups').upsert(rowsToUpsert);
      if (error) console.error('Batch sync error:', error);
    }

    originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(ts));
  } catch (e) {
    console.error('pushUnsyncedLocalData error:', e);
  }
};

export const manualSyncNow = async () => {
  await pushUnsyncedLocalData(true);
  const restored = await restoreFromCloud();
  window.dispatchEvent(new Event('storage'));
  return { success: true, restored };
};

