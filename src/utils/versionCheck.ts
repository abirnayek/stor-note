import { supabase } from './supabaseClient';

export interface VersionInfo {
  version: string;
  buildTime: number;
  forceLogoutBefore?: number;
}

export const APP_VERSION = '1.0.1';

// Function to clear all caches, unregister all SW, and reload
export const forcePurgeCacheAndReload = async () => {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {
    console.error('[VersionCheck] Purge error:', e);
  }
  // Hard reload without using cache
  window.location.reload();
};

let isChecking = false;

export const checkAppVersionAndSync = async (isManual = false) => {
  if (isChecking) return;
  isChecking = true;

  try {
    // 1. Fetch latest version.json with cache busting timestamp
    const res = await fetch(`./version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) {
      if (isManual) alert('সার্ভার থেকে আপডেটের তথ্য পাওয়া যায়নি। ইন্টারনেট সংযোগ চেক করুন।');
      return;
    }

    const data: VersionInfo = await res.json();
    const localBuildTime = Number(localStorage.getItem('app_build_time') || '0');
    const myLoginTs = Number(localStorage.getItem('device_login_timestamp') || '0');

    const hasCachedAuth = localStorage.getItem('cached_is_authenticated') === 'true';

    let needsLogout = false;
    let needsUpdate = false;

    // Check force logout requirement ONLY IF user is currently authenticated
    if (hasCachedAuth && data.forceLogoutBefore && data.forceLogoutBefore > 0) {
      if (myLoginTs < data.forceLogoutBefore) {
        console.warn('[VersionCheck] Force logout triggered by version policy.');
        needsLogout = true;
      }
    }

    // Check if new build is published
    if (localBuildTime > 0 && data.buildTime && data.buildTime > localBuildTime) {
      console.log(`[VersionCheck] New version detected: ${data.version} (remote: ${data.buildTime}, local: ${localBuildTime})`);
      needsUpdate = true;
    }

    // Save latest build time in localStorage
    if (data.buildTime) {
      localStorage.setItem('app_build_time', data.buildTime.toString());
    }
    if (data.version) {
      localStorage.setItem('app_version', data.version);
    }

    if (needsLogout) {
      localStorage.removeItem('cached_is_authenticated');
      localStorage.removeItem('cached_user_session');
      localStorage.removeItem('device_permission');
      try { await supabase.auth.signOut(); } catch (e) {}
      await forcePurgeCacheAndReload();
      return;
    }

    if (needsUpdate) {
      await forcePurgeCacheAndReload();
      return;
    }

    if (isManual) {
      alert(`আপনার অ্যাপটি সম্পূর্ণ আপ-টু-ডেট আছে (v${data.version})!`);
    }
  } catch (err) {
    console.warn('[VersionCheck] Check skipped or failed:', err);
    if (isManual) {
      // If manual check fails, purge caches and reload anyway
      await forcePurgeCacheAndReload();
    }
  } finally {
    isChecking = false;
  }
};

export const initVersionAutoChecker = () => {
  if (typeof window === 'undefined') return;

  // Run on initial load
  setTimeout(() => {
    checkAppVersionAndSync(false);
  }, 1500);

  // Run whenever user switches back to this app/tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAppVersionAndSync(false);
    }
  });

  // Background check every 2 minutes when online
  setInterval(() => {
    if (navigator.onLine) {
      checkAppVersionAndSync(false);
    }
  }, 120000);
};
