import { supabase } from './supabaseClient';

let currentUser: any = null;

export const getStoredUserCached = () => {
  if (currentUser) return currentUser;
  try {
    const cachedStr = localStorage.getItem('cached_user_session');
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      currentUser = parsed.user || parsed;
      return currentUser;
    }
    // Also check standard Supabase auth token in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed.user) {
            currentUser = parsed.user;
            return currentUser;
          }
        }
      }
    }
  } catch(e) {}
  return null;
};

export const getPendingKeys = (): string[] => {
  try {
    const raw = localStorage.getItem('pending_offline_sync_keys');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const markKeyPending = (key: string) => {
  try {
    const keys = getPendingKeys();
    if (!keys.includes(key)) {
      keys.push(key);
      localStorage.setItem('pending_offline_sync_keys', JSON.stringify(keys));
    }
  } catch {}
};

export const removePendingKey = (key: string) => {
  try {
    const keys = getPendingKeys().filter(k => k !== key);
    localStorage.setItem('pending_offline_sync_keys', JSON.stringify(keys));
  } catch {}
};

export const getDeletedTombstones = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem('deleted_keys_tombstones');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const addDeletedTombstone = (key: string, ts: number = Date.now()) => {
  try {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    const raw = originalGetItem.call(localStorage, 'deleted_keys_tombstones');
    const tombstones: Record<string, number> = raw ? JSON.parse(raw) : {};
    tombstones[key] = ts;
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    Object.keys(tombstones).forEach(k => {
      if (now - tombstones[k] > ninetyDays) {
        delete tombstones[k];
      }
    });
    originalSetItem.call(localStorage, 'deleted_keys_tombstones', JSON.stringify(tombstones));
  } catch {}
};

export const removeDeletedTombstone = (key: string) => {
  try {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    const raw = originalGetItem.call(localStorage, 'deleted_keys_tombstones');
    if (!raw) return;
    const tombstones: Record<string, number> = JSON.parse(raw);
    if (tombstones[key]) {
      delete tombstones[key];
      originalSetItem.call(localStorage, 'deleted_keys_tombstones', JSON.stringify(tombstones));
    }
  } catch {}
};

export const getDeletedMemoIds = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem('deleted_memo_ids');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const markMemoDeleted = (memoId: string, ts: number = Date.now()) => {
  if (!memoId) return;
  try {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;

    // 1. Record in deleted_memo_ids
    const rawMemos = originalGetItem.call(localStorage, 'deleted_memo_ids');
    const memoTombstones: Record<string, number> = rawMemos ? JSON.parse(rawMemos) : {};
    memoTombstones[memoId] = ts;
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    Object.keys(memoTombstones).forEach(id => {
      if (now - memoTombstones[id] > ninetyDays) delete memoTombstones[id];
    });
    originalSetItem.call(localStorage, 'deleted_memo_ids', JSON.stringify(memoTombstones));

    // 2. Also register tombstones for all known key variants of this memo
    const keysToTombstone = [
      `sales_memo_${memoId}`,
      `due_memo_${memoId}`,
      `due_memo_regular_${memoId}`,
      `due_memo_permanent_${memoId}`,
      `due_memo_reseller_${memoId}`,
      `due_memo_purchase_${memoId}`,
      `sales_memo_lot_unassigned_memo_${memoId}`,
      `memo_password_sales_memo_${memoId}`,
      `memo_password_due_memo_${memoId}`
    ];
    for (let l = 1; l <= 100; l++) {
      keysToTombstone.push(`sales_memo_lot_${l}_memo_${memoId}`);
      keysToTombstone.push(`memo_password_sales_memo_lot_${l}_memo_${memoId}`);
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.endsWith(`_memo_${memoId}`) || k.includes(`_${memoId}_`) || k.endsWith(`_${memoId}`))) {
        keysToTombstone.push(k);
      }
    }

    keysToTombstone.forEach(k => {
      addDeletedTombstone(k, ts);
      markKeyPending(`__DELETE__:${k}`);
    });

    // 3. Immediately inform Supabase to delete these keys
    const user = currentUser || getStoredUserCached();
    if (user && navigator.onLine) {
      keysToTombstone.forEach(k => {
        supabase.from('user_backups').delete().match({
          user_id: user.id,
          key: k
        }).then(() => {});
      });
    }
  } catch (e) {}
};

export const isMemoDeleted = (memoId: string): boolean => {
  if (!memoId) return false;
  try {
    const rawMemos = localStorage.getItem('deleted_memo_ids');
    if (!rawMemos) return false;
    const memoTombstones: Record<string, number> = JSON.parse(rawMemos);
    return Boolean(memoTombstones[memoId]);
  } catch {
    return false;
  }
};

export const unmarkMemoDeleted = (memoId: string) => {
  if (!memoId) return;
  try {
    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    const rawMemos = originalGetItem.call(localStorage, 'deleted_memo_ids');
    if (rawMemos) {
      const memoTombstones: Record<string, number> = JSON.parse(rawMemos);
      delete memoTombstones[memoId];
      originalSetItem.call(localStorage, 'deleted_memo_ids', JSON.stringify(memoTombstones));
    }
    removeDeletedTombstone(`sales_memo_${memoId}`);
    removeDeletedTombstone(`due_memo_${memoId}`);
    removeDeletedTombstone(`sales_memo_lot_unassigned_memo_${memoId}`);
    for (let l = 1; l <= 100; l++) {
      removeDeletedTombstone(`sales_memo_lot_${l}_memo_${memoId}`);
    }
  } catch {}
};

export const isKeyDeleted = (key: string): boolean => {
  if (!key) return false;
  const tombstones = getDeletedTombstones();
  if (tombstones[key]) return true;

  let memoId: string | null = null;
  if (key.startsWith('sales_memo_') && !key.startsWith('sales_memo_lot_') && !key.startsWith('sales_memo_list_')) {
    memoId = key.replace('sales_memo_', '');
  } else if (key.startsWith('due_memo_')) {
    memoId = key.replace('due_memo_', '');
  } else if (key.includes('_memo_')) {
    const parts = key.split('_memo_');
    if (parts[1]) memoId = parts[1];
  }
  if (memoId && isMemoDeleted(memoId)) {
    return true;
  }
  return false;
};

export const syncFromCloud = async () => {
  if (!navigator.onLine) return false;
  const user = currentUser || getStoredUserCached();
  if (!user) return false;
  // Always push pending deletions and offline edits first so cloud is up to date
  await pushUnsyncedLocalData(false);
  const restored = await restoreFromCloud();
  return restored;
};

// Initialize and listen to auth changes
supabase.auth.getSession().then(({ data: { session } }) => {
  currentUser = session?.user || getStoredUserCached();
  if (currentUser && navigator.onLine) {
    syncFromCloud();
    setupRealtimeSync();
  }
}).catch(() => {
  currentUser = getStoredUserCached();
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || getStoredUserCached();
  if (currentUser && navigator.onLine) {
    syncFromCloud();
    setupRealtimeSync();
  }
});

let isRestoring = false;

// Auto-sync when device comes ONLINE
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[SyncEngine] Network is back ONLINE. Processing offline sync queue...');
    currentUser = currentUser || getStoredUserCached();
    if (currentUser) {
      try {
        await pushUnsyncedLocalData(false);
        await syncFromCloud();
        setupRealtimeSync();
        window.dispatchEvent(new CustomEvent('network_sync_status', { detail: { online: true, synced: true } }));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error('[SyncEngine] Error syncing on online event:', err);
      }
    }
  });

  window.addEventListener('offline', () => {
    console.log('[SyncEngine] Device is OFFLINE. Operations will be queued locally.');
    window.dispatchEvent(new CustomEvent('network_sync_status', { detail: { online: false } }));
  });

  // Auto-sync in background when tab becomes visible or periodically (only when online)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (currentUser || getStoredUserCached()) && navigator.onLine) {
      syncFromCloud();
    }
  });

  setInterval(() => {
    if ((currentUser || getStoredUserCached()) && !isRestoring && navigator.onLine) {
      syncFromCloud();
    }
  }, 10000);
}

const syncTimers: Record<string, any> = {};

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
    const prevValue = originalGetItem.call(localStorage, key);
    
    // Skip internal auth and queue keys
    if (
      key.startsWith('sb-') || 
      key === 'local_timestamps' || 
      key === 'pending_offline_sync_keys' || 
      key === 'deleted_keys_tombstones' ||
      key === 'deleted_memo_ids' ||
      key === 'cached_user_session' || 
      key === 'cached_is_authenticated' ||
      key === 'device_id' ||
      key === 'device_permission'
    ) {
      originalSetItem.apply(this, [key, value] as any);
      return;
    }

    // IF THIS KEY WAS MARKED AS DELETED:
    // Only block recreating it during background cloud restoration
    if (isRestoring && isKeyDeleted(key)) {
      return;
    }

    // If re-saving or creating a genuine key locally, clear any stale tombstone and pending delete marker
    removeDeletedTombstone(key);
    removePendingKey(`__DELETE__:${key}`);

    originalSetItem.apply(this, [key, value] as any);

    if (prevValue === value) return;

    updateLocalTimestamp(key);

    if (!isRestoring) {
      // Mark as pending offline sync in case internet is not available or request fails
      markKeyPending(key);

      const user = currentUser || getStoredUserCached();
      if (user && navigator.onLine) {
        if (syncTimers[key]) {
          clearTimeout(syncTimers[key]);
        }
        syncTimers[key] = setTimeout(() => {
          delete syncTimers[key];
          const activeUser = currentUser || getStoredUserCached();
          if (!activeUser || !navigator.onLine) return;
          
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session || !session.user || session.user.id !== activeUser.id) return;
            supabase.from('user_backups').upsert({
              user_id: activeUser.id,
              key: key,
              value: value,
              updated_at: new Date().toISOString()
            }).then(({ error }) => {
              if (!error) {
                removePendingKey(key);
              }
            });
          }).catch(() => {});

          if (realtimeChannel) {
            try {
              realtimeChannel.send({
                type: 'broadcast',
                event: 'storage_sync',
                payload: { key, value, ts: Date.now(), action: 'SET' }
              });
            } catch(e) {}
          }
        }, 400);
      }
    }
  };

  localStorage.removeItem = function(key: string) {
    originalRemoveItem.apply(this, [key] as any);
    
    if (
      key.startsWith('sb-') || 
      key === 'local_timestamps' || 
      key === 'pending_offline_sync_keys' || 
      key === 'deleted_keys_tombstones' ||
      key === 'deleted_memo_ids' ||
      key === 'cached_user_session' || 
      key === 'cached_is_authenticated' ||
      key === 'device_id' ||
      key === 'device_permission'
    ) return;

    if (syncTimers[key]) {
      clearTimeout(syncTimers[key]);
      delete syncTimers[key];
    }
    removePendingKey(key);

    const now = Date.now();
    addDeletedTombstone(key, now);

    try {
      const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
      const ts = tsStr ? JSON.parse(tsStr) : {};
      delete ts[key];
      originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(ts));
    } catch(e) {}

    if (!isRestoring) {
      const deleteKey = `__DELETE__:${key}`;
      markKeyPending(deleteKey);

      const user = currentUser || getStoredUserCached();
      if (user && navigator.onLine) {
        supabase.from('user_backups').delete().match({ 
          user_id: user.id, 
          key: key 
        }).then(({ error }) => {
          if (!error) {
            removePendingKey(deleteKey);
          } else {
            console.error('[SyncEngine] Delete error, kept in offline queue:', error);
          }
        });

        if (realtimeChannel) {
          try {
            realtimeChannel.send({
              type: 'broadcast',
              event: 'storage_sync',
              payload: { key, ts: now, action: 'DELETE' }
            });
          } catch(e) {}
        }
      }
    }
  };
  
  localStorage.clear = function() {
    originalClear.apply(this);
  };
};

export const restoreFromCloud = async () => {
  if (!navigator.onLine) return false;
  if (!currentUser) {
    currentUser = getStoredUserCached();
  }
  if (!currentUser) return false;
  
  isRestoring = true;
  try {
    // Fetch all rows from cloud with pagination to avoid 1000-row limit truncation
    const data: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: pageData, error } = await supabase
        .from('user_backups')
        .select('key, value, updated_at')
        .range(from, from + pageSize - 1);
        
      if (error) throw error;
      if (!pageData || pageData.length === 0) break;
      data.push(...pageData);
      if (pageData.length < pageSize) break;
      from += pageSize;
    }
    
    if (data && data.length > 0) {
      const originalSetItem = localStorage.setItem;
      const originalRemoveItem = localStorage.removeItem;
      const originalGetItem = localStorage.getItem;
      
      const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
      const localTimestamps = tsStr ? JSON.parse(tsStr) : {};
      let timestampsModified = false;
      let hasDataChanged = false;

      const cloudKeys = new Set(data.map(r => r.key));
      const pendingKeys = new Set(getPendingKeys());
      
      data.forEach(row => {
        // A. If this key is deleted or value is __DELETED__, purge and NEVER restore!
        if (row.value === '__DELETED__' || isKeyDeleted(row.key)) {
          originalRemoveItem.call(localStorage, row.key);
          if (currentUser && navigator.onLine) {
            supabase.from('user_backups').delete().match({
              user_id: currentUser.id,
              key: row.key
            }).then(() => {});
          }
          return;
        }

        // B. If this key has an unsynced offline change or pending delete, DO NOT overwrite!
        if (pendingKeys.has(row.key) || pendingKeys.has(`__DELETE__:${row.key}`)) {
          return;
        }

        const cloudTs = new Date(row.updated_at).getTime();
        const localTs = localTimestamps[row.key] || 0;
        const localValue = originalGetItem.call(localStorage, row.key);
        
        if (cloudTs >= localTs || localTs === 0) {
          if (localValue !== row.value) {
             originalSetItem.call(localStorage, row.key, row.value);
             localTimestamps[row.key] = cloudTs;
             timestampsModified = true;
             hasDataChanged = true;
          }
        } else if (localTs > cloudTs && navigator.onLine) {
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
      
      // Handle local keys not present in cloud: upload them to cloud to prevent data loss!
      Object.keys(localTimestamps).forEach(key => {
        if (!cloudKeys.has(key)) {
          const localValue = originalGetItem.call(localStorage, key);
          if (localValue !== null && !isKeyDeleted(key) && navigator.onLine) {
            supabase.from('user_backups').upsert({
              user_id: currentUser.id,
              key: key,
              value: localValue,
              updated_at: new Date(localTimestamps[key] || Date.now()).toISOString()
            }).then(() => {});
          }
        }
      });

      if (timestampsModified) {
        originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(localTimestamps));
      }
      if (hasDataChanged) {
        window.dispatchEvent(new Event('storage'));
      }
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

let realtimeChannel: any = null;
let currentSubscribedUserId: string | null = null;

export const setupRealtimeSync = () => {
  if (!navigator.onLine) return;
  const user = currentUser || getStoredUserCached();
  if (!user) return;
  if (realtimeChannel && currentSubscribedUserId === user.id) return;

  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch(e) {}
    realtimeChannel = null;
  }

  currentSubscribedUserId = user.id;
  const channelName = `user_sync_${user.id}`;
  
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalGetItem = localStorage.getItem;
  
  const handleIncomingData = (key: string, value: string | undefined, cloudTs: number, action: string) => {
    if (!key) return;
    if (action === 'DELETE' || isKeyDeleted(key) || value === '__DELETED__') {
      originalRemoveItem.call(localStorage, key);
      const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
      const ts = tsStr ? JSON.parse(tsStr) : {};
      delete ts[key];
      originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(ts));
      window.dispatchEvent(new Event('storage'));
      return;
    }

    const pendingKeys = new Set(getPendingKeys());
    // Don't overwrite if local device has pending offline edits or deletes on this key
    if (pendingKeys.has(key) || pendingKeys.has(`__DELETE__:${key}`)) return;

    // Check tombstone
    if (isKeyDeleted(key)) return;

    isRestoring = true;
    try {
      if (value !== undefined) {
        if (originalGetItem.call(localStorage, key) !== value) {
          originalSetItem.call(localStorage, key, value);
          const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
          const ts = tsStr ? JSON.parse(tsStr) : {};
          ts[key] = cloudTs;
          originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(ts));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch(e) {}
    isRestoring = false;
  };

  realtimeChannel = supabase
    .channel(channelName)
    .on('broadcast', { event: 'storage_sync' }, ({ payload }: any) => {
      if (payload) {
        handleIncomingData(payload.key, payload.value, payload.ts || Date.now(), payload.action || 'SET');
      }
    })
    .on('broadcast', { event: 'device_kickout' }, async ({ payload }: any) => {
      if (payload && payload.device_id) {
        const myDeviceId = localStorage.getItem('device_id');
        if (myDeviceId === payload.device_id) {
          localStorage.removeItem('cached_is_authenticated');
          localStorage.removeItem('cached_user_session');
          localStorage.removeItem('device_permission');
          try { await supabase.auth.signOut(); } catch(e) {}
          window.location.reload();
        }
      }
    })
    .on('broadcast', { event: 'device_permission_change' }, ({ payload }: any) => {
      if (payload && payload.device_id) {
        const myDeviceId = localStorage.getItem('device_id');
        if (myDeviceId === payload.device_id && payload.permission) {
          localStorage.setItem('device_permission', payload.permission);
          window.dispatchEvent(new Event('settingsChange'));
        }
      }
    })
    .on('broadcast', { event: 'global_force_logout' }, async ({ payload }: any) => {
      const myDeviceId = localStorage.getItem('device_id');
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (payload?.except_device_id && myDeviceId === payload.except_device_id) {
        return;
      }
      if (isLocalhost && payload?.except_localhost) {
        return;
      }
      localStorage.removeItem('cached_is_authenticated');
      localStorage.removeItem('cached_user_session');
      localStorage.removeItem('device_permission');
      try { await supabase.auth.signOut(); } catch(e) {}
      window.location.reload();
    })
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_backups', 
        filter: `user_id=eq.${user.id}` 
      }, 
      (payload: any) => {
        if (payload.eventType === 'DELETE') {
          handleIncomingData(payload.old?.key, undefined, Date.now(), 'DELETE');
        } else if (payload.new) {
          const cloudTs = payload.new.updated_at ? new Date(payload.new.updated_at).getTime() : Date.now();
          handleIncomingData(payload.new.key, payload.new.value, cloudTs, 'SET');
        }
    })
    .subscribe();
};

export const broadcastDeviceKickout = (deviceId: string) => {
  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'device_kickout',
        payload: { device_id: deviceId }
      });
    } catch (e) {}
  }
};

export const broadcastDevicePermission = (deviceId: string, permission: string) => {
  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'device_permission_change',
        payload: { device_id: deviceId, permission }
      });
    } catch (e) {}
  }
};

export const forceLogoutEverywhere = async (exceptCurrentDevice: boolean = true) => {
  const activeUser = currentUser || getStoredUserCached();
  const currentDeviceId = localStorage.getItem('device_id');
  const now = Date.now();

  localStorage.setItem('force_logout_timestamp', now.toString());
  if (exceptCurrentDevice) {
    localStorage.setItem('device_login_timestamp', (now + 5000).toString());
  }

  if (activeUser && navigator.onLine) {
    // 1. Write force_logout_timestamp to cloud user_backups so any device syncs it
    try {
      await supabase.from('user_backups').upsert({
        user_id: activeUser.id,
        key: 'force_logout_timestamp',
        value: now.toString(),
        updated_at: new Date(now).toISOString()
      });
    } catch (e) {}

    // 2. Mark all active_sessions in database as revoked
    try {
      if (exceptCurrentDevice && currentDeviceId) {
        await supabase.from('active_sessions')
          .update({ status: 'revoked' })
          .neq('device_id', currentDeviceId);
      } else {
        await supabase.from('active_sessions')
          .update({ status: 'revoked' });
      }
    } catch (e) {}

    // 3. Send real-time broadcast to instantly terminate all running sessions
    try {
      if (realtimeChannel) {
        realtimeChannel.send({
          type: 'broadcast',
          event: 'global_force_logout',
          payload: {
            timestamp: now,
            except_device_id: exceptCurrentDevice ? currentDeviceId : null,
            except_localhost: exceptCurrentDevice
          }
        });
      }
    } catch (e) {}
  }

  if (!exceptCurrentDevice) {
    localStorage.removeItem('cached_is_authenticated');
    localStorage.removeItem('cached_user_session');
    localStorage.removeItem('device_permission');
    try { await supabase.auth.signOut(); } catch(e) {}
    window.location.reload();
  }
};

export const pushUnsyncedLocalData = async (forceAll: boolean = false) => {
  try {
    if (!navigator.onLine) return;
    const user = currentUser || getStoredUserCached();
    if (!user) return;

    // Verify active valid Supabase auth session to avoid 401 Unauthorized / RLS violation
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user || session.user.id !== user.id) {
      return;
    }

    const originalGetItem = localStorage.getItem;
    const originalSetItem = localStorage.setItem;
    const tsStr = originalGetItem.call(localStorage, 'local_timestamps');
    const ts = tsStr ? JSON.parse(tsStr) : {};
    
    const pendingKeys = getPendingKeys();
    const pendingSet = new Set(pendingKeys);
    const tombstones = getDeletedTombstones();

    // Process pending deletes first
    for (const pKey of pendingKeys) {
      if (pKey.startsWith('__DELETE__:')) {
        const actualKey = pKey.replace('__DELETE__:', '');
        const { error } = await supabase.from('user_backups').delete().match({
          user_id: user.id,
          key: actualKey
        });
        if (!error) {
          removePendingKey(pKey);
          pendingSet.delete(pKey);
        }
      }
    }

    const keysToSync = Object.keys(localStorage).filter(k => 
      !k.startsWith('sb-') && 
      k !== 'local_timestamps' && 
      k !== 'pending_offline_sync_keys' && 
      k !== 'deleted_keys_tombstones' &&
      k !== 'deleted_memo_ids' &&
      k !== 'cached_user_session' && 
      k !== 'cached_is_authenticated' && 
      k !== 'device_id' && 
      k !== 'device_permission' && 
      !k.startsWith('localhost_')
    );
    
    const rowsToUpsert: any[] = [];
    const nowISO = new Date().toISOString();
    const nowMs = Date.now();
    const syncedKeys: string[] = [];

    for (const key of keysToSync) {
      // NEVER upload a key that is marked for deletion or tombstoned
      if (pendingSet.has(`__DELETE__:${key}`) || tombstones[key] || isKeyDeleted(key)) {
        continue;
      }

      const value = originalGetItem.call(localStorage, key);
      if (value !== null) {
        if (forceAll || pendingSet.has(key) || !ts[key]) {
          rowsToUpsert.push({
            user_id: user.id,
            key: key,
            value: value,
            updated_at: nowISO
          });
          ts[key] = nowMs;
          syncedKeys.push(key);
        }
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error } = await supabase.from('user_backups').upsert(rowsToUpsert);
      if (!error) {
        syncedKeys.forEach(k => removePendingKey(k));
      } else {
        console.error('[SyncEngine] Batch sync error:', error);
      }
    }

    originalSetItem.call(localStorage, 'local_timestamps', JSON.stringify(ts));
  } catch (e) {
    console.error('[SyncEngine] pushUnsyncedLocalData error:', e);
  }
};

export const manualSyncNow = async () => {
  if (!navigator.onLine) {
    throw new Error('Offline: No internet connection');
  }
  await pushUnsyncedLocalData(true);
  const restored = await restoreFromCloud();
  window.dispatchEvent(new Event('storage'));
  return { success: true, restored };
};

