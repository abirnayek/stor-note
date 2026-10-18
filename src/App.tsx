import { useState, useEffect, useRef } from 'react';
import { Search, User, Settings, X, Moon, Sun, Globe, ShoppingCart, Clock, ShoppingBag, Home, Trash2, Send, XCircle, TrendingUp, RefreshCw, Wifi, WifiOff, Package, Users } from 'lucide-react';
import './index.css';
import Dashboard from './components/Dashboard';
import PasswordScreen from './components/PasswordScreen';
import LotsScreen from './components/LotsScreen';
import MemoScreen from './components/MemoScreen';
import DueTypesScreen from './components/DueTypesScreen';
import DueCategoryScreen from './components/DueCategoryScreen';
import DueListScreen from './components/DueListScreen';
import SalesLotsScreen from './components/SalesLotsScreen';
import SalesMemoScreen from './components/SalesMemoScreen';
import SalesMemoListScreen from './components/SalesMemoListScreen';
import MonthlySalesScreen from './components/MonthlySalesScreen';
import DueMemoScreen from './components/DueMemoScreen';
import DueSalesMemoScreen from './components/DueSalesMemoScreen';
import PaidDueListScreen from './components/PaidDueListScreen';
import TrashScreen from './components/TrashScreen';
import InvestorListScreen from './components/InvestorListScreen';
import InvestorMemosListScreen from './components/InvestorMemosListScreen';
import InvestorMemoScreen from './components/InvestorMemoScreen';
import StockScreen from './components/StockScreen';
import ResellerScreen from './components/ResellerScreen';
import AratdarScreen from './components/AratdarScreen';
import { useLanguage } from './i18n/LanguageContext';
import { supabase } from './utils/supabaseClient';
import LoginScreen from './components/LoginScreen';
import DeviceManager from './components/DeviceManager';
import { LotPasswordManager } from './components/LotPasswordManager';

import { restoreFromCloud, setupRealtimeSync, pushUnsyncedLocalData, manualSyncNow } from './utils/syncEngine';
import { runLotRecovery } from './utils/lotRecovery';
import { getAllGlobalSalesMemos } from './utils/dueSyncUtils';

export type Screen = 'dashboard' | 'password' | 'lots' | 'memo' | 'due-category' | 'due-types' | 'due-list' | 'due-purchase-list' | 'paid-due-list' | 'sales-lots' | 'sales-memo-list' | 'sales-memo' | 'due-memo' | 'due-sales-memo' | 'trash' | 'investor-password' | 'investor-list' | 'investor-memos-list' | 'investor-memo' | 'stock' | 'sales-month-memos' | 'reseller-password' | 'reseller' | 'aratdar';

export interface NavSnapshot {
  screen: Screen;
  folderId?: string | null;
  lot?: number | null;
  salesLot?: number | null;
  salesMemoId?: string | null;
  salesMemoReturnScreen?: Screen;
  resellerReturnScreen?: Screen;
  selectedMonth?: number | null;
  selectedYear?: number | null;
  dueType?: 'regular' | 'permanent' | 'purchase' | 'reseller';
  dueId?: string | null;
  isPaidDue?: boolean;
  investorId?: string | null;
  investorMemoId?: string | null;
  targetMemoId?: string | null;
  isModal?: string | null;
}

const getParentSnapshot = (current: NavSnapshot): NavSnapshot => {
  switch (current.screen) {
    case 'reseller':
      if (current.folderId) {
        return { screen: 'reseller', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', resellerReturnScreen: current.resellerReturnScreen, dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      return { screen: current.resellerReturnScreen === 'dashboard' ? 'dashboard' : 'sales-lots', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', resellerReturnScreen: current.resellerReturnScreen, dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'aratdar':
      if (current.folderId) {
        return { screen: 'aratdar', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      return { screen: 'sales-lots', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'memo':
      return { screen: 'lots', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'lots':
    case 'password':
      return { screen: 'dashboard', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'sales-memo':
      if (current.salesMemoReturnScreen === 'reseller') {
        return { screen: 'reseller', folderId: current.folderId || null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'reseller', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      if (current.salesMemoReturnScreen === 'aratdar') {
        return { screen: 'aratdar', folderId: current.folderId || null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'aratdar', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      if (current.salesMemoReturnScreen === 'stock') {
        return { screen: 'stock', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      if (current.salesMemoReturnScreen === 'sales-memo-list') {
        return { screen: 'sales-memo-list', folderId: null, lot: null, salesLot: current.salesLot || 1, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      if (current.salesMemoReturnScreen === 'sales-month-memos' && current.selectedMonth !== null && current.selectedMonth !== undefined) {
        return { screen: 'sales-month-memos', folderId: null, selectedMonth: current.selectedMonth, selectedYear: current.selectedYear, lot: null, salesLot: current.salesLot, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      return { screen: 'sales-lots', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'sales-month-memos':
    case 'sales-memo-list':
      return { screen: 'sales-lots', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'sales-lots':
      return { screen: 'dashboard', folderId: null, lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'due-sales-memo':
    case 'due-memo':
      if (current.isPaidDue) {
        return { screen: 'paid-due-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: current.dueType || 'regular', dueId: null, isPaidDue: true, investorId: null, investorMemoId: null };
      }
      if (current.dueType === 'purchase') {
        return { screen: 'due-purchase-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'purchase', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      return { screen: 'due-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: current.dueType || 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'paid-due-list':
      if (current.dueType === 'purchase') {
        return { screen: 'due-purchase-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'purchase', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      return { screen: 'due-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: current.dueType || 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'due-list':
      if (current.dueType === 'purchase') {
        return { screen: 'due-category', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'purchase', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
      }
      return { screen: 'due-types', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: current.dueType || 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'due-purchase-list':
    case 'due-types':
      return { screen: 'due-category', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'due-category':
      return { screen: 'dashboard', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'investor-memo':
      return { screen: 'investor-memos-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: current.investorId || null, investorMemoId: null };
    case 'investor-memos-list':
      return { screen: 'investor-list', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
    case 'investor-list':
    case 'investor-password':
    case 'reseller-password':
    case 'trash':
    case 'stock':
    default:
      return { screen: 'dashboard', lot: null, salesLot: null, salesMemoId: null, salesMemoReturnScreen: 'sales-lots', dueType: 'regular', dueId: null, isPaidDue: false, investorId: null, investorMemoId: null };
  }
};

interface PendingReminder {
  dueId: string;
  name: string;
  mobile: string;
  totalDue: number;
  config: {
    scheduledFor: number;
    type: 'whatsapp' | 'sms';
    status: 'pending' | 'sent' | 'failed';
  };
}

function App() {
  const { t, language, toggleLanguage } = useLanguage();
  const [theme, setTheme] = useState('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLotPasswordManagerOpen, setIsLotPasswordManagerOpen] = useState(false);
  const [userEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [showLoginScreen, setShowLoginScreen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    runLotRecovery();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setSyncToast(language === 'bn' ? 'অনলাইন হয়েছে! স্বয়ংক্রিয়ভাবে সিঙ্ক হচ্ছে...' : 'Back online! Syncing changes...');
      try {
        await pushUnsyncedLocalData(false);
        await restoreFromCloud();
        runLotRecovery();
        setupRealtimeSync();
        setSyncToast(language === 'bn' ? 'সব মেমো সফলভাবে ক্লাউডে সিঙ্ক হয়েছে ✓' : 'All memos synced with cloud ✓');
        setTimeout(() => setSyncToast(null), 3500);
      } catch (e) {
        setTimeout(() => setSyncToast(null), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncToast(language === 'bn' ? 'অফলাইন মোড: কোনো সমস্যা নেই, আপনার সব মেমো ফোনে সেভ থাকবে।' : 'Offline mode: You can work freely, will sync when online.');
      setTimeout(() => setSyncToast(null), 4000);
    };

    const handleNetworkSyncEvent = (e: any) => {
      if (e.detail?.online && e.detail?.synced) {
        setSyncToast(language === 'bn' ? 'সব মেমো সফলভাবে ক্লাউডে সিঙ্ক হয়েছে ✓' : 'All memos synced with cloud ✓');
        setTimeout(() => setSyncToast(null), 3000);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('network_sync_status', handleNetworkSyncEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('network_sync_status', handleNetworkSyncEvent);
    };
  }, [language]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let activeUser: any = null;
      if (session) {
        setSession(session);
        activeUser = session.user;
        localStorage.setItem('cached_is_authenticated', 'true');
        localStorage.setItem('cached_user_session', JSON.stringify({ user: session.user, id: session.user.id, email: session.user.email }));
      } else {
        // Safe offline recovery if user was previously authenticated
        const hasCachedAuth = localStorage.getItem('cached_is_authenticated') === 'true';
        const cachedUserStr = localStorage.getItem('cached_user_session');
        if (hasCachedAuth && cachedUserStr) {
          try {
            const cachedUser = JSON.parse(cachedUserStr);
            activeUser = cachedUser.user || cachedUser;
            setSession({ user: activeUser });
          } catch(e) {}
        }
      }
      setLoadingAuth(false);

      if (activeUser && navigator.onLine) {
        (async () => {
          try {
            await restoreFromCloud();
            runLotRecovery();
            await pushUnsyncedLocalData(false);
            setupRealtimeSync();
            window.dispatchEvent(new Event('storage'));
            
            // --- Device Validity Check & Auto-logout Heartbeat ---
            let deviceId = localStorage.getItem('device_id');
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

            const checkDeviceStatus = async () => {
              if (!navigator.onLine) return;
              if (isLocalhost) return; // Localhost development is always admin, never kicked out

              try {
                // 1. Direct cloud check for force_logout_timestamp
                const { data: forceLogoutData } = await supabase
                  .from('user_backups')
                  .select('value')
                  .eq('key', 'force_logout_timestamp')
                  .maybeSingle();

                const cloudForceLogoutTs = forceLogoutData?.value ? Number(forceLogoutData.value) : 0;
                const localForceLogoutTs = Number(localStorage.getItem('force_logout_timestamp') || '0');
                const effectiveForceLogoutTs = Math.max(cloudForceLogoutTs, localForceLogoutTs);
                const myLoginTs = Number(localStorage.getItem('device_login_timestamp') || '0');

                if (effectiveForceLogoutTs > 0 && myLoginTs < effectiveForceLogoutTs) {
                  console.warn('[Security] Device logged in before force_logout_timestamp. Logging out...');
                  localStorage.removeItem('cached_is_authenticated');
                  localStorage.removeItem('cached_user_session');
                  localStorage.removeItem('device_permission');
                  try { await supabase.auth.signOut(); } catch(e) {}
                  localStorage.clear();
                  window.location.reload();
                  return;
                }

                const currentId = localStorage.getItem('device_id');
                if (!currentId) {
                  // If logged in on phone but no deviceId recorded, clear and re-login with valid tracking
                  localStorage.removeItem('cached_is_authenticated');
                  localStorage.removeItem('cached_user_session');
                  localStorage.removeItem('device_permission');
                  try { await supabase.auth.signOut(); } catch(e) {}
                  localStorage.clear();
                  window.location.reload();
                  return;
                }

                const { data, error } = await supabase
                  .from('active_sessions')
                  .select('status, permission')
                  .eq('device_id', currentId)
                  .maybeSingle();

                // If cloud explicitly says revoked OR if device was removed/deleted from active_sessions by admin:
                if (!error && (!data || data.status === 'revoked')) {
                  console.warn('[DeviceCheck] Device session is revoked or removed. Logging out immediately...');
                  localStorage.removeItem('cached_is_authenticated');
                  localStorage.removeItem('cached_user_session');
                  localStorage.removeItem('device_permission');
                  try { await supabase.auth.signOut(); } catch(e) {}
                  localStorage.clear();
                  window.location.reload();
                  return;
                }

                if (data && data.permission) {
                  localStorage.setItem('device_permission', data.permission);
                  window.dispatchEvent(new Event('settingsChange'));
                }
              } catch (e) {}
            };

            await checkDeviceStatus();

            if (deviceId) {
              // Setup realtime listener for this specific device to auto-logout if kicked
              const channelName = `device_${deviceId}`;
              const existingChannels = supabase.getChannels();
              const alreadySubscribed = existingChannels.some((ch: any) => ch.topic === `realtime:${channelName}` || ch.topic === channelName);
              if (!alreadySubscribed) {
                supabase.channel(channelName)
                  .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions', filter: `device_id=eq.${deviceId}` }, async (payload) => {
                    if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && payload.new.status === 'revoked')) {
                      localStorage.removeItem('cached_is_authenticated');
                      localStorage.removeItem('cached_user_session');
                      localStorage.removeItem('device_permission');
                      try { await supabase.auth.signOut(); } catch(e) {}
                      localStorage.clear();
                      window.location.reload();
                    } else if (payload.eventType === 'UPDATE' && payload.new.permission) {
                      localStorage.setItem('device_permission', payload.new.permission);
                      window.dispatchEvent(new Event('settingsChange'));
                    }
                  }).subscribe();
              }
            }

            // Periodic heartbeat every 10 seconds & on tab focus
            setInterval(checkDeviceStatus, 10000);
            const handleVisibility = () => {
              if (document.visibilityState === 'visible') {
                checkDeviceStatus();
              }
            };
            document.addEventListener('visibilitychange', handleVisibility);
            // --- End Device Check ---
          } catch (e) {
            console.error('Background sync/auth init error:', e);
          }
        })();
      }
    }).catch(err => {
      console.error('Auth session error:', err);
      const hasCachedAuth = localStorage.getItem('cached_is_authenticated') === 'true';
      const cachedUserStr = localStorage.getItem('cached_user_session');
      if (hasCachedAuth && cachedUserStr) {
        try {
          const cachedUser = JSON.parse(cachedUserStr);
          setSession({ user: cachedUser.user || cachedUser });
        } catch(e) {}
      }
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setSession(session);
        localStorage.setItem('cached_is_authenticated', 'true');
        localStorage.setItem('cached_user_session', JSON.stringify({ user: session.user, id: session.user.id, email: session.user.email }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Prevent typing/editing if view-only (only when logged in)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!session) return; // Don't block anything on login screen
      if (localStorage.getItem('device_permission') === 'view') {
        const target = e.target as HTMLElement;
        if (
          (target.tagName === 'INPUT' && !target.classList.contains('search-input') && !target.classList.contains('login-input') && !target.classList.contains('modal-input')) || 
          target.tagName === 'TEXTAREA'
        ) {
          e.preventDefault();
        }
      }
    };
    
    const updateBodyClass = () => {
      if (!session) {
        document.body.classList.remove('view-only-mode');
        return;
      }
      if (localStorage.getItem('device_permission') === 'view') {
        document.body.classList.add('view-only-mode');
      } else {
        document.body.classList.remove('view-only-mode');
      }
    };
    
    updateBodyClass();
    window.addEventListener('settingsChange', updateBodyClass);
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('settingsChange', updateBodyClass);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [session]);
  
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentLot, setCurrentLot] = useState<number | null>(null);
  const [currentSalesLot, setCurrentSalesLot] = useState<number | null>(null);
  const [currentSalesMemoId, setCurrentSalesMemoId] = useState<string | null>(null);
  const [salesMemoReturnScreen, setSalesMemoReturnScreen] = useState<Screen>('sales-lots');
  const [resellerReturnScreen, setResellerReturnScreen] = useState<Screen>('sales-lots');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [currentDueType, setCurrentDueType] = useState<'regular' | 'permanent' | 'purchase' | 'reseller'>('regular');
  const [currentDueId, setCurrentDueId] = useState<string | null>(null);
  const [isPaidDue, setIsPaidDue] = useState<boolean>(false);
  const [currentInvestorId, setCurrentInvestorId] = useState<string | null>(null);
  const [currentInvestorMemoId, setCurrentInvestorMemoId] = useState<string | null>(null);
  const [targetMemoId, setTargetMemoId] = useState<string | null>(null);
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Scan for pending auto messages
  useEffect(() => {
    const checkReminders = () => {
      const allPending: PendingReminder[] = [];
      const types = ['regular', 'permanent'];
      const now = Date.now();

      types.forEach(type => {
        const duesStr = localStorage.getItem(`dues_${type}`);
        if (duesStr) {
          const dues = JSON.parse(duesStr);
          dues.forEach((dueId: string) => {
            const memoStr = localStorage.getItem(`due_memo_${dueId}`);
            if (memoStr) {
              try {
                const memo = JSON.parse(memoStr);
                if (memo.autoMessage && memo.autoMessage.status === 'pending' && memo.autoMessage.scheduledFor <= now) {
                  // Calculate total due
                  let totalPrice = 0;
                  if (memo.entries) {
                    totalPrice = memo.entries.reduce((sum: number, entry: any) => {
                      let currentProfitPercent = entry.profitPercent !== undefined && entry.profitPercent !== '' ? Number(entry.profitPercent) : 20;
                      if (typeof entry.totalKg === 'number' && typeof entry.buyRate === 'number' && entry.totalKg > 0) {
                        let salePriceAuto = entry.buyRate + (entry.buyRate * currentProfitPercent / 100);
                        return sum + (salePriceAuto * entry.totalKg);
                      }
                      return sum;
                    }, 0);
                  }
                  const totalDeposit = typeof memo.deposit === 'number' ? memo.deposit : 0;
                  const totalDueAmount = totalPrice - totalDeposit;

                  allPending.push({
                    dueId,
                    name: memo.name || 'Unknown',
                    mobile: memo.mobile || '',
                    totalDue: totalDueAmount,
                    config: memo.autoMessage
                  });
                }
              } catch (e) {}
            }
          });
        }
      });
      setPendingReminders(allPending);
    };

    checkReminders();
    // Check every minute just in case
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, []);

  const navStackRef = useRef<NavSnapshot[]>([{
    screen: 'dashboard',
    folderId: null,
    lot: null,
    salesLot: null,
    salesMemoId: null,
    salesMemoReturnScreen: 'sales-lots',
    resellerReturnScreen: 'dashboard',
    dueType: 'regular',
    dueId: null,
    isPaidDue: false,
    investorId: null,
    investorMemoId: null,
    targetMemoId: null
  }]);

  const applySnapshot = (snapshot: NavSnapshot) => {
    setCurrentScreen(snapshot.screen);
    setCurrentFolderId(snapshot.folderId ?? null);
    setCurrentLot(snapshot.lot ?? null);
    setCurrentSalesLot(snapshot.salesLot ?? null);
    setCurrentSalesMemoId(snapshot.salesMemoId ?? null);
    setSalesMemoReturnScreen(snapshot.salesMemoReturnScreen ?? 'sales-lots');
    setResellerReturnScreen(snapshot.resellerReturnScreen ?? (snapshot.screen === 'sales-lots' ? 'sales-lots' : (snapshot.screen === 'dashboard' ? 'dashboard' : resellerReturnScreen)));
    setSelectedMonth(snapshot.selectedMonth ?? null);
    setSelectedYear(snapshot.selectedYear ?? new Date().getFullYear());
    setCurrentDueType(snapshot.dueType ?? 'regular');
    setCurrentDueId(snapshot.dueId ?? null);
    setIsPaidDue(snapshot.isPaidDue ?? false);
    setCurrentInvestorId(snapshot.investorId ?? null);
    setCurrentInvestorMemoId(snapshot.investorMemoId ?? null);
    setTargetMemoId(snapshot.targetMemoId ?? null);
  };

  const isSettingsOpenRef = useRef(false);
  const isDeviceManagerOpenRef = useRef(false);
  const isLotPasswordManagerOpenRef = useRef(false);
  const isUserMenuOpenRef = useRef(false);
  const showLoginScreenRef = useRef(false);
  const lastNavTimeRef = useRef<number>(0);

  useEffect(() => { isSettingsOpenRef.current = isSettingsOpen; }, [isSettingsOpen]);
  useEffect(() => { isDeviceManagerOpenRef.current = isDeviceManagerOpen; }, [isDeviceManagerOpen]);
  useEffect(() => { isLotPasswordManagerOpenRef.current = isLotPasswordManagerOpen; }, [isLotPasswordManagerOpen]);
  useEffect(() => { isUserMenuOpenRef.current = isUserMenuOpen; }, [isUserMenuOpen]);
  useEffect(() => { showLoginScreenRef.current = showLoginScreen; }, [showLoginScreen]);

  const openSettings = () => {
    setIsSettingsOpen(true);
    window.history.pushState({ isModal: 'settings' }, '');
  };
  const closeSettings = () => {
    setIsSettingsOpen(false);
    if (window.history.state?.isModal === 'settings') {
      window.history.back();
    }
  };

  const openDeviceManager = () => {
    setIsDeviceManagerOpen(true);
    window.history.pushState({ isModal: 'deviceManager' }, '');
  };
  const closeDeviceManager = () => {
    setIsDeviceManagerOpen(false);
    if (window.history.state?.isModal === 'deviceManager') {
      window.history.back();
    }
  };

  const openLotPasswordManager = () => {
    setIsLotPasswordManagerOpen(true);
    window.history.pushState({ isModal: 'lotPasswordManager' }, '');
  };
  const closeLotPasswordManager = () => {
    setIsLotPasswordManagerOpen(false);
    if (window.history.state?.isModal === 'lotPasswordManager') {
      window.history.back();
    }
  };

  const openUserMenu = () => {
    setIsUserMenuOpen(true);
    window.history.pushState({ isModal: 'userMenu' }, '');
  };
  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
    if (window.history.state?.isModal === 'userMenu') {
      window.history.back();
    }
  };

  const handleLogin = () => {
    setShowLoginScreen(true);
    window.history.pushState({ isModal: 'login' }, '');
  };
  const closeLogin = () => {
    setShowLoginScreen(false);
    if (window.history.state?.isModal === 'login') {
      window.history.back();
    }
  };

  const isNavigatingBackRef = useRef(false);

  const navigateBack = (
    fallbackScreen?: Screen,
    fallbackParams?: Partial<NavSnapshot>
  ) => {
    // 1. If any modal is open, close modal first
    if (isSettingsOpenRef.current) { closeSettings(); return; }
    if (isDeviceManagerOpenRef.current) { closeDeviceManager(); return; }
    if (isLotPasswordManagerOpenRef.current) { closeLotPasswordManager(); return; }
    if (isUserMenuOpenRef.current) { closeUserMenu(); return; }
    if (showLoginScreenRef.current) { closeLogin(); return; }

    const now = Date.now();
    if (now - lastNavTimeRef.current < 200) {
      return;
    }
    lastNavTimeRef.current = now;

    // 2. If stack has history, pop exactly 1 step
    if (navStackRef.current.length > 1) {
      navStackRef.current.pop();
      // Skip duplicate entries of exact same screen and folder state if any
      while (
        navStackRef.current.length > 1 && 
        navStackRef.current[navStackRef.current.length - 1].screen === currentScreen &&
        (navStackRef.current[navStackRef.current.length - 1].folderId ?? null) === (currentFolderId ?? null) &&
        (navStackRef.current[navStackRef.current.length - 1].salesLot ?? null) === (currentSalesLot ?? null) &&
        (navStackRef.current[navStackRef.current.length - 1].salesMemoId ?? null) === (currentSalesMemoId ?? null) &&
        (navStackRef.current[navStackRef.current.length - 1].selectedMonth ?? null) === (selectedMonth ?? null)
      ) {
        navStackRef.current.pop();
      }
      const targetSnapshot = navStackRef.current[navStackRef.current.length - 1];

      applySnapshot(targetSnapshot);
      isNavigatingBackRef.current = true;
      try {
        window.history.back();
      } catch (e) {
        window.history.replaceState(targetSnapshot, '');
      }
      return;
    }

    // 3. Fallback if at root of navStack (e.g. refreshed page or deep-link)
    const currentTop = navStackRef.current[0] || {
      screen: currentScreen,
      folderId: currentFolderId,
      lot: currentLot,
      salesLot: currentSalesLot,
      salesMemoId: currentSalesMemoId,
      salesMemoReturnScreen,
      resellerReturnScreen,
      selectedMonth,
      selectedYear,
      dueType: currentDueType,
      dueId: currentDueId,
      isPaidDue,
      investorId: currentInvestorId,
      investorMemoId: currentInvestorMemoId
    };

    let targetSnapshot: NavSnapshot;
    if (fallbackScreen) {
      targetSnapshot = {
        screen: fallbackScreen,
        folderId: fallbackParams?.folderId !== undefined 
          ? fallbackParams.folderId 
          : (fallbackScreen === currentScreen 
              ? currentFolderId 
              : ((fallbackScreen === 'aratdar' || fallbackScreen === 'reseller') ? (currentTop.folderId ?? null) : null)),
        lot: fallbackParams?.lot !== undefined ? fallbackParams.lot : (fallbackScreen === 'memo' ? currentLot : null),
        salesLot: fallbackParams?.salesLot !== undefined ? fallbackParams.salesLot : (fallbackScreen.startsWith('sales-') ? currentSalesLot : null),
        salesMemoId: fallbackParams?.salesMemoId !== undefined ? fallbackParams.salesMemoId : null,
        salesMemoReturnScreen: fallbackParams?.salesMemoReturnScreen || salesMemoReturnScreen,
        resellerReturnScreen: fallbackParams?.resellerReturnScreen || resellerReturnScreen,
        selectedMonth: fallbackParams?.selectedMonth !== undefined ? fallbackParams.selectedMonth : selectedMonth,
        selectedYear: fallbackParams?.selectedYear !== undefined ? fallbackParams.selectedYear : selectedYear,
        dueType: fallbackParams?.dueType !== undefined ? fallbackParams.dueType : currentDueType,
        dueId: fallbackParams?.dueId !== undefined ? fallbackParams.dueId : null,
        isPaidDue: fallbackParams?.isPaidDue !== undefined ? fallbackParams.isPaidDue : isPaidDue,
        investorId: fallbackParams?.investorId !== undefined ? fallbackParams.investorId : null,
        investorMemoId: fallbackParams?.investorMemoId !== undefined ? fallbackParams.investorMemoId : null,
      };
    } else {
      targetSnapshot = getParentSnapshot(currentTop);
    }

    navStackRef.current = [targetSnapshot];
    window.history.replaceState(targetSnapshot, '');
    applySnapshot(targetSnapshot);
  };

  const navigateTo = (
    nextScreen: Screen,
    params?: Partial<NavSnapshot>,
    replace: boolean = false
  ) => {
    const currentTop = navStackRef.current[navStackRef.current.length - 1];
    if (
      nextScreen === currentTop?.screen &&
      !replace &&
      (!params || (
        (params.folderId ?? null) === (currentTop.folderId ?? null) &&
        (params.salesLot ?? null) === (currentTop.salesLot ?? null) &&
        (params.salesMemoId ?? null) === (currentTop.salesMemoId ?? null) &&
        (params.selectedMonth ?? null) === (currentTop.selectedMonth ?? null)
      ))
    ) return;

    // Prevent viewer from accessing restricted sections
    const currentPerm = localStorage.getItem('device_permission') || 'admin';
    if (currentPerm === 'view') {
      const viewerBlocked: Screen[] = [
        'investor-password', 'investor-list', 'investor-memos-list', 'investor-memo',
        'password', 'lots', 'memo'
      ];
      if (viewerBlocked.includes(nextScreen)) {
        alert(language === 'bn' ? 'ভিউয়ার (Viewer) পারমিশনে এই হিসাবটি দেখার অনুমতি নেই।' : 'Viewer permission does not have access to view this section.');
        return;
      }
    }

    // If navigating back to parent or previous screen without explicit new forward params, execute single back
    if (!replace && !params && currentTop) {
      const parent = getParentSnapshot(currentTop);
      const isParent = parent.screen === nextScreen;
      const isPrev = navStackRef.current.length > 1 && navStackRef.current[navStackRef.current.length - 2].screen === nextScreen;
      if (isParent || isPrev) {
        navigateBack(nextScreen);
        return;
      }
    }

    // Prevent rapid duplicate navigation triggers within 200ms
    const now = Date.now();
    if (now - lastNavTimeRef.current < 200 && !replace) {
      return;
    }
    lastNavTimeRef.current = now;

    const nextSnapshot: NavSnapshot = {
      screen: nextScreen,
      folderId: params?.folderId !== undefined 
        ? params.folderId 
        : (nextScreen === currentScreen || nextScreen === 'sales-memo' ? currentFolderId : null),
      lot: params?.lot !== undefined ? params.lot : (nextScreen === 'memo' ? currentLot : null),
      salesLot: params?.salesLot !== undefined ? params.salesLot : (nextScreen.startsWith('sales-') ? currentSalesLot : null),
      salesMemoId: params?.salesMemoId !== undefined ? params.salesMemoId : (nextScreen === 'sales-memo' ? currentSalesMemoId : null),
      salesMemoReturnScreen: params?.salesMemoReturnScreen !== undefined ? params.salesMemoReturnScreen : salesMemoReturnScreen,
      resellerReturnScreen: params?.resellerReturnScreen !== undefined 
        ? params.resellerReturnScreen 
        : (nextScreen === 'reseller' 
            ? (currentTop?.screen === 'sales-lots' || currentTop?.screen === 'dashboard' ? currentTop.screen : resellerReturnScreen)
            : resellerReturnScreen),
      selectedMonth: params?.selectedMonth !== undefined ? params.selectedMonth : selectedMonth,
      selectedYear: params?.selectedYear !== undefined ? params.selectedYear : selectedYear,
      dueType: params?.dueType !== undefined ? params.dueType : currentDueType,
      dueId: params?.dueId !== undefined ? params.dueId : (nextScreen === 'due-memo' || nextScreen === 'due-sales-memo' ? currentDueId : null),
      isPaidDue: params?.isPaidDue !== undefined ? params.isPaidDue : isPaidDue,
      investorId: params?.investorId !== undefined ? params.investorId : (nextScreen.startsWith('investor-') ? currentInvestorId : null),
      investorMemoId: params?.investorMemoId !== undefined ? params.investorMemoId : (nextScreen === 'investor-memo' ? currentInvestorMemoId : null),
      targetMemoId: params?.targetMemoId !== undefined ? params.targetMemoId : null,
    };

    if (replace) {
      if (navStackRef.current.length > 0) {
        navStackRef.current[navStackRef.current.length - 1] = nextSnapshot;
      } else {
        navStackRef.current = [nextSnapshot];
      }
      window.history.replaceState(nextSnapshot, '');
    } else if (nextScreen === 'dashboard') {
      navStackRef.current = [nextSnapshot];
      window.history.pushState(nextSnapshot, '');
    } else {
      navStackRef.current.push(nextSnapshot);
      window.history.pushState(nextSnapshot, '');
    }

    applySnapshot(nextSnapshot);
  };

  useEffect(() => {
    const rootSnapshot: NavSnapshot = {
      screen: 'dashboard',
      folderId: null,
      lot: null,
      salesLot: null,
      salesMemoId: null,
      salesMemoReturnScreen: 'sales-lots',
      resellerReturnScreen: 'dashboard',
      dueType: 'regular',
      dueId: null,
      isPaidDue: false,
      investorId: null,
      investorMemoId: null
    };

    if (!window.history.state || !window.history.state.screen) {
      window.history.replaceState(rootSnapshot, '');
      navStackRef.current = [rootSnapshot];
    } else {
      navStackRef.current = [window.history.state];
      applySnapshot(window.history.state);
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. If any modal is open, close it
      if (isSettingsOpenRef.current) {
        setIsSettingsOpen(false);
        return;
      }
      if (isDeviceManagerOpenRef.current) {
        setIsDeviceManagerOpen(false);
        return;
      }
      if (isLotPasswordManagerOpenRef.current) {
        setIsLotPasswordManagerOpen(false);
        return;
      }
      if (isUserMenuOpenRef.current) {
        setIsUserMenuOpen(false);
        return;
      }
      if (showLoginScreenRef.current) {
        setShowLoginScreen(false);
        return;
      }

      // If this popstate was triggered by our own navigateBack(), ignore it
      if (isNavigatingBackRef.current) {
        isNavigatingBackRef.current = false;
        return;
      }

      // 2. Hardware/Browser back: pop 1 step from navStackRef
      if (navStackRef.current.length > 1) {
        navStackRef.current.pop();
        const targetSnapshot = navStackRef.current[navStackRef.current.length - 1];
        applySnapshot(targetSnapshot);
      } else if (event.state && event.state.screen) {
        navStackRef.current = [event.state];
        applySnapshot(event.state);
      } else {
        const currentTop = navStackRef.current[0] || rootSnapshot;
        if (currentTop.screen !== 'dashboard') {
          const parent = getParentSnapshot(currentTop);
          navStackRef.current = [parent];
          applySnapshot(parent);
        } else {
          applySnapshot(rootSnapshot);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem('cached_is_authenticated');
    localStorage.removeItem('cached_user_session');
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await manualSyncNow();
      alert('সব মেমো ও হিসাব সফলভাবে অনলাইন সিঙ্ক করা হয়েছে!');
    } catch (e) {
      alert('সিঙ্ক করার সময় সমস্যা হয়েছে, ইন্টারনেট সংযোগ চেক করুন।');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleNavigate = (screen: Screen) => {
    navigateTo(screen);
  };

  const handlePasswordSuccess = () => {
    navigateTo('lots', undefined, true);
  };

  const handleSelectLot = (lotNumber: number) => {
    navigateTo('memo', { lot: lotNumber });
  };

  const handleUpdateReminderStatus = (dueId: string, status: 'sent' | 'failed') => {
    const memoStr = localStorage.getItem(`due_memo_${dueId}`);
    if (memoStr) {
      try {
        const memo = JSON.parse(memoStr);
        if (memo.autoMessage) {
          memo.autoMessage.status = status;
          localStorage.setItem(`due_memo_${dueId}`, JSON.stringify(memo));
        }
      } catch (e) {}
    }
    setPendingReminders(prev => prev.filter(r => r.dueId !== dueId));
  };

  const handleSendMessage = (reminder: PendingReminder) => {
    const message = `Dear ${reminder.name}, you have a due amount of BDT ${reminder.totalDue.toFixed(2)}. Please make the payment at your earliest convenience. Thank you.`;
    const encodedMessage = encodeURIComponent(message);
    
    if (reminder.config.type === 'whatsapp') {
      const cleanPhone = reminder.mobile.replace(/[^0-9]/g, '');
      const finalPhone = cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone;
      window.open(`https://wa.me/${finalPhone}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`sms:${reminder.mobile}?body=${encodedMessage}`, '_blank');
    }
    
    handleUpdateReminderStatus(reminder.dueId, 'sent');
  };

  // Auto-login for localhost
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  useEffect(() => {
    if (isLocalhost && !session && !loadingAuth) {
      // Auto sign-in on localhost
      const autoLogin = async () => {
        // Check if we have a stored email for auto-login
        let storedEmail = localStorage.getItem('localhost_admin_email');
        if (!storedEmail) {
          storedEmail = 'localhost-admin@stor-note.local';
        }
        // Try to sign in with a magic link (silently create session)
        const { error } = await supabase.auth.signInWithPassword({
          email: storedEmail,
          password: 'localhost-auto-admin-2024'
        }).catch(() => ({ error: { message: 'no password auth' } } as any));
        
        // If password auth fails, just set permission directly and skip login
        if (error) {
          localStorage.setItem('device_permission', 'admin');
          window.dispatchEvent(new Event('settingsChange'));
        }
      };
      autoLogin();
    }
  }, [isLocalhost, session, loadingAuth]);

  if (loadingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-color)' }}>Loading...</div>;
  }

  // Localhost always bypasses login screen (unless user explicitly clicks Log In)
  if (!session && (!isLocalhost || showLoginScreen)) {
    return <LoginScreen onLoginSuccess={() => {
      closeLogin();
      // Force reload to apply synced localstorage data correctly
      window.location.reload();
    }} />;
  }
  
  // If localhost without session, still show the app as admin
  if (!session && isLocalhost) {
    localStorage.setItem('device_permission', 'admin');
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-left" onClick={() => handleNavigate('dashboard')} style={{ cursor: 'pointer' }}>
          <img src="./see fish logo.png" alt="Logo" className="logo" />
          <h1 className="title">{t('appTitle')}</h1>
          <img src="./notebook_pen_favicon.jpg" alt="Notebook Icon" className="notebook-icon-header" />
        </div>
        <div className="header-right">
          <div className="search-container">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="search-input" 
              placeholder={t('searchPlaceholder')} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (() => {
              const q = searchQuery.toLowerCase().trim();
              const results: { 
                label: string; 
                subtext?: string;
                screen: Screen; 
                id?: string; 
                lotNumber?: number | null; 
                memoId?: string;
                isSalesMemo?: boolean;
              }[] = [];

              const seenSalesIds = new Set<string>();

              // 1. Search Global Sales Memos (unassigned, lot memos, aratdar, reseller)
              try {
                const globalSalesMemos = getAllGlobalSalesMemos();
                globalSalesMemos.forEach(memo => {
                  const name = (memo.name || '').toLowerCase();
                  if (name.includes(q)) {
                    seenSalesIds.add(memo.id);
                    let categoryLabel = '';
                    if (memo.customerType === 'permanent') categoryLabel = 'আড়তদার';
                    else if (memo.customerType === 'reseller') categoryLabel = 'রিসেলার';
                    else if (memo.lotNumber !== null) categoryLabel = `লট ${memo.lotNumber}`;
                    else categoryLabel = 'সাধারণ ক্রেতা';

                    const isDue = memo.status === 'due' || (memo.dueAmount && memo.dueAmount > 0);
                    const prefix = isDue ? 'বকেয়া হিসাব' : 'বিক্রয় হিসাব';
                    const amountText = isDue 
                      ? `৳${Math.round(memo.dueAmount || memo.totalAmount).toLocaleString()} বাকি` 
                      : `৳${Math.round(memo.totalAmount).toLocaleString()}`;

                    results.push({
                      label: `${prefix} (${categoryLabel}): ${memo.name}`,
                      subtext: `${memo.lotNumber !== null ? `Lot: ${memo.lotNumber}` : 'Lot: N/A'} • ${amountText}`,
                      screen: 'sales-lots',
                      lotNumber: memo.lotNumber,
                      memoId: memo.id,
                      id: memo.id,
                      isSalesMemo: true
                    });
                  }
                });
              } catch (e) {}

              // 2. Search Due Memos (regular, permanent, reseller)
              ['regular', 'permanent', 'reseller'].forEach(type => {
                const duesStr = localStorage.getItem(`dues_${type}`);
                if (duesStr) {
                  try {
                    JSON.parse(duesStr).forEach((dueId: string) => {
                      if (seenSalesIds.has(dueId)) return;
                      const memoStr = localStorage.getItem(`due_memo_${dueId}`);
                      if (memoStr) {
                        try {
                          const memo = JSON.parse(memoStr);
                          const name = (memo.name || '').toLowerCase();
                          if (name.includes(q)) {
                            seenSalesIds.add(dueId);
                            const typeLabel = type === 'reseller' ? (t('reseller') || 'রিসেলার') : (type === 'regular' ? t('regularSeller') : t('aratdarSeller'));
                            results.push({ 
                              label: `${t('dueAccount')} (${typeLabel}): ${memo.name}`, 
                              subtext: `বকেয়া তালিকা • ID: ${dueId}`,
                              screen: 'sales-lots', 
                              id: dueId,
                              memoId: dueId,
                              isSalesMemo: true
                            });
                          }
                        } catch (e) {}
                      }
                    });
                  } catch (e) {}
                }
              });

              // 3. Search Purchase Dues (dues_purchase)
              const purchaseDuesStr = localStorage.getItem('dues_purchase');
              if (purchaseDuesStr) {
                try {
                  JSON.parse(purchaseDuesStr).forEach((dueId: string) => {
                    const memoStr = localStorage.getItem(`due_memo_${dueId}`);
                    if (memoStr) {
                      try {
                        const memo = JSON.parse(memoStr);
                        const name = (memo.name || '').toLowerCase();
                        if (name.includes(q)) {
                          results.push({
                            label: `${t('dueAccount')} (ক্রয় মহাজন): ${memo.name}`,
                            subtext: `ক্রয় বকেয়া`,
                            screen: 'due-memo',
                            id: dueId
                          });
                        }
                      } catch (e) {}
                    }
                  });
                } catch (e) {}
              }

              // 4. Search Purchase Memos (lots by supplier name)
              const purchaseLots = localStorage.getItem('purchase_lots_list');
              if (purchaseLots) {
                try {
                  JSON.parse(purchaseLots).forEach((lot: number) => {
                    const memoStr = localStorage.getItem(`memo_lot_${lot}`);
                    if (memoStr) {
                      try {
                        const memo = JSON.parse(memoStr);
                        const supplier = (memo.supplierName || '').toLowerCase();
                        if (supplier.includes(q)) {
                          results.push({ 
                            label: `${t('purchaseAccount')}: ${memo.supplierName} (Lot ${lot})`, 
                            subtext: `ক্রয় হিসাব লট ${lot}`,
                            screen: 'memo', 
                            lotNumber: lot 
                          });
                        }
                      } catch (e) {}
                    }
                  });
                } catch (e) {}
              }

              return (
                <div className="search-results">
                  {results.length === 0 ? (
                    <p style={{ padding: '0.5rem', opacity: 0.7 }}>{t('noResults')} "{searchQuery}"</p>
                  ) : (
                    results.map((r, i) => {
                      const handleSelect = (e: React.MouseEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSearchQuery('');
                        if (r.isSalesMemo || r.screen === 'sales-lots') {
                          const targetId = r.memoId || r.id;
                          if (currentScreen === 'sales-lots') {
                            window.dispatchEvent(new CustomEvent('highlight_sales_memo', { 
                              detail: { memoId: targetId, lotNumber: r.lotNumber } 
                            }));
                          } else {
                            navigateTo('sales-lots', { targetMemoId: targetId });
                          }
                        } else if (r.screen === 'due-memo' && r.id) {
                          navigateTo('due-memo', { dueId: r.id, isPaidDue: false, dueType: 'purchase' });
                        } else if (r.screen === 'memo' && r.lotNumber) {
                          navigateTo('memo', { lot: r.lotNumber });
                        }
                      };

                      return (
                        <div
                          key={i}
                          style={{ 
                            padding: '0.6rem 1rem', 
                            cursor: 'pointer', 
                            borderBottom: '1px solid rgba(255,255,255,0.08)', 
                            fontSize: '0.9rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            textAlign: 'left'
                          }}
                          onMouseDown={handleSelect}
                          onClick={handleSelect}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ fontWeight: 600 }}>{r.label}</div>
                          {r.subtext && (
                            <div style={{ fontSize: '0.75rem', opacity: 0.65 }}>{r.subtext}</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })()}
          </div>
          <div className="user-info">
            {/* Online / Offline status indicator */}
            <div style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
              {isOnline ? (
                <div 
                  title={language === 'bn' ? 'অনলাইন: ক্লাউড সিঙ্ক সক্রিয়' : 'Online: Cloud sync active'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(114, 190, 68, 0.15)',
                    border: '1px solid rgba(114, 190, 68, 0.35)',
                    color: '#72be44',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Wifi size={13} />
                  <span>{language === 'bn' ? 'অনলাইন' : 'Online'}</span>
                </div>
              ) : (
                <div 
                  title={language === 'bn' ? 'অফলাইন মোড: কোনো ইন্টারনেট নেই। মেমো তৈরি ও এডিট করা যাবে, নেট আসলে অটো-সিঙ্ক হবে।' : 'Offline Mode: No Internet. Memos saved locally, auto-syncs when reconnected.'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(255, 152, 0, 0.18)',
                    border: '1px solid rgba(255, 152, 0, 0.45)',
                    color: '#ffb74d',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <WifiOff size={13} />
                  <span>{language === 'bn' ? 'অফলাইন মোড' : 'Offline'}</span>
                </div>
              )}
            </div>

            <button className="btn-icon-wrapper" title="Language" onClick={toggleLanguage} style={{ marginRight: '10px' }}>
              <Globe size={24} className="user-icon" />
              <span style={{ fontSize: '12px', marginLeft: '4px', opacity: 0.8 }}>{language.toUpperCase()}</span>
            </button>
            {session?.user?.email ? (
              <>
                <span className="user-email-text" style={{ marginRight: '10px' }}>{session.user.email}</span>
                <button className="btn-icon-wrapper" title={session.user.email} onClick={() => setIsUserMenuOpen(true)}>
                  <User size={24} className="user-icon" />
                </button>
              </>
            ) : (
              <button className="btn" onClick={handleLogin}>{t('logIn')}</button>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          {currentScreen !== 'dashboard' && currentScreen !== 'password' && currentScreen !== 'investor-password' && currentScreen !== 'reseller-password' ? (
            <div className="sidebar-top-nav">
              <button 
                className="sidebar-nav-item"
                onClick={() => handleNavigate('dashboard')}
                title="Home"
              >
                <Home size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${currentScreen.startsWith('sales-') ? 'active' : ''}`}
                onClick={() => handleNavigate('sales-lots')}
                title={t('salesAccount')}
              >
                <ShoppingCart size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${(currentScreen.startsWith('due-') || currentScreen.startsWith('paid-due-')) ? 'active' : ''}`}
                onClick={() => handleNavigate('due-category')}
                title={t('dueAccount')}
              >
                <Clock size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${currentScreen === 'reseller' ? 'active' : ''}`}
                onClick={() => handleNavigate('reseller-password')}
                title={t('reseller') || 'রিসেলার'}
              >
                <Users size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${currentScreen === 'stock' ? 'active' : ''}`}
                onClick={() => handleNavigate('stock')}
                title={t('stockAccount') || 'স্টক'}
              >
                <Package size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${currentScreen.startsWith('investor-') ? 'active' : ''}`}
                onClick={() => handleNavigate('investor-password')}
                title={t('investorAccount')}
              >
                <TrendingUp size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${currentScreen === 'lots' || currentScreen === 'memo' ? 'active' : ''}`}
                onClick={() => handleNavigate('password')}
                title={t('purchaseAccount')}
              >
                <ShoppingBag size={24} />
              </button>
              <button 
                className={`sidebar-nav-item ${currentScreen === 'trash' ? 'active' : ''}`}
                onClick={() => handleNavigate('trash')}
                title="Trash"
              >
                <Trash2 size={24} />
              </button>
            </div>
          ) : (
            <div></div>
          )}
          
          <div className="sidebar-bottom-nav">
            <button className="btn-icon-wrapper" onClick={openSettings}>
              <Settings size={36} className="sidebar-icon" />
            </button>
            <button className="btn-icon-wrapper" title={(session?.user?.email || userEmail) || "Login"} onClick={() => (session?.user?.email || userEmail) ? openUserMenu() : handleLogin()}>
              <User size={36} className="sidebar-icon" />
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="content">
          {currentScreen === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
          {currentScreen === 'password' && (
            <PasswordScreen 
              onSuccess={handlePasswordSuccess} 
              onBack={() => navigateBack('dashboard')} 
              pinKey="kenaHisabPin"
              title={t('purchaseAccount') || 'ক্রয় হিসাব'}
            />
          )}
          {currentScreen === 'lots' && (
            <LotsScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('dashboard')}
              onSelectLot={handleSelectLot} 
            />
          )}
          {currentScreen === 'memo' && (
            <MemoScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('lots')}
              lotNumber={currentLot ?? 1} 
            />
          )}
          {currentScreen === 'due-category' && (
            <DueCategoryScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('dashboard')}
            />
          )}
          {currentScreen === 'due-types' && (
            <DueTypesScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('due-category')}
              onSelectType={(type) => {
                navigateTo('due-list', { dueType: type });
              }} 
            />
          )}
          {currentScreen === 'due-list' && (
            <DueListScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack(currentDueType === 'purchase' ? 'due-category' : 'due-types')}
              dueType={currentDueType} 
              onSelectType={(type) => {
                navigateTo('due-list', { dueType: type }, true);
              }}
              onSelectDue={(id) => {
                navigateTo('due-sales-memo', { dueId: id, isPaidDue: false, dueType: currentDueType });
              }}
            />
          )}
          {currentScreen === 'due-purchase-list' && (
            <DueListScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('due-category')}
              dueType="purchase"
              onSelectDue={(id) => {
                navigateTo('due-memo', { dueId: id, isPaidDue: false, dueType: 'purchase' });
              }}
            />
          )}
          {currentScreen === 'paid-due-list' && (
            <PaidDueListScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack(currentDueType === 'purchase' ? 'due-purchase-list' : 'due-list')}
              dueType={currentDueType} 
              onSelectType={(type) => {
                navigateTo('paid-due-list', { dueType: type }, true);
              }}
              onSelectDue={(id) => {
                navigateTo(currentDueType === 'purchase' ? 'due-memo' : 'due-sales-memo', { 
                  dueId: id, 
                  isPaidDue: true, 
                  dueType: currentDueType 
                });
              }}
            />
          )}
          {currentScreen === 'due-memo' && (
            currentDueId !== null ? (
              <DueMemoScreen 
                onNavigate={handleNavigate} 
                onBack={() => navigateBack(isPaidDue ? 'paid-due-list' : 'due-purchase-list')}
                dueId={currentDueId}
                isPaid={isPaidDue}
                dueType="purchase"
              />
            ) : (
              <DueListScreen 
                onNavigate={handleNavigate} 
                onBack={() => navigateBack('due-category')}
                dueType="purchase"
                onSelectDue={(id) => {
                  navigateTo('due-memo', { dueId: id, isPaidDue: false, dueType: 'purchase' });
                }}
              />
            )
          )}
          {currentScreen === 'due-sales-memo' && (
            currentDueId !== null ? (
              <DueSalesMemoScreen 
                onNavigate={handleNavigate} 
                onBack={() => navigateBack(isPaidDue ? 'paid-due-list' : (currentDueType === 'purchase' ? 'due-purchase-list' : 'due-list'))}
                dueId={currentDueId}
                isPaid={isPaidDue}
                dueType={currentDueType === 'purchase' ? 'regular' : currentDueType}
              />
            ) : (
              <DueListScreen 
                onNavigate={handleNavigate} 
                onBack={() => navigateBack(currentDueType === 'purchase' ? 'due-category' : 'due-types')}
                dueType={currentDueType} 
                onSelectDue={(id) => {
                  if (currentDueType === 'purchase' || id.startsWith('purchase_')) {
                    navigateTo('due-memo', { dueId: id, isPaidDue: false, dueType: 'purchase' });
                  } else {
                    navigateTo('due-sales-memo', { dueId: id, isPaidDue: false, dueType: currentDueType });
                  }
                }}
              />
            )
          )}
          {currentScreen === 'sales-lots' && (
            <SalesLotsScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('dashboard')}
              targetMemoId={targetMemoId}
              onSelectLot={(lot) => {
                navigateTo('sales-memo-list', { salesLot: lot });
              }}
              onSelectMemo={(memoId, lotNumber) => {
                navigateTo('sales-memo', { salesLot: lotNumber, salesMemoId: memoId, salesMemoReturnScreen: 'sales-lots' });
              }}
              onSelectMonth={(mIdx, yr) => {
                setSelectedMonth(mIdx);
                setSelectedYear(yr);
                navigateTo('sales-month-memos', { selectedMonth: mIdx, selectedYear: yr });
              }}
            />
          )}
          {currentScreen === 'sales-month-memos' && selectedMonth !== null && (
            <MonthlySalesScreen
              onNavigate={handleNavigate}
              monthIndex={selectedMonth}
              year={selectedYear}
              onBack={() => navigateBack('sales-lots')}
              onSelectMemo={(memoId, lotNumber) => {
                navigateTo('sales-memo', {
                  salesLot: lotNumber,
                  salesMemoId: memoId,
                  salesMemoReturnScreen: 'sales-month-memos',
                  selectedMonth,
                  selectedYear
                });
              }}
            />
          )}
          {currentScreen === 'sales-memo-list' && (
            <SalesMemoListScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('sales-lots')}
              lotNumber={currentSalesLot ?? 1}
              onSelectMemo={(memoId) => {
                navigateTo('sales-memo', { salesLot: currentSalesLot ?? 1, salesMemoId: memoId, salesMemoReturnScreen: 'sales-memo-list' });
              }}
            />
          )}
          {currentScreen === 'sales-memo' && currentSalesMemoId !== null && (
            <SalesMemoScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack(salesMemoReturnScreen, { 
                salesLot: currentSalesLot ?? undefined,
                folderId: currentFolderId ?? undefined
              })}
              lotNumber={currentSalesLot} 
              memoId={currentSalesMemoId}
              onLotChange={(lot) => {
                if (lot !== null) {
                  setCurrentSalesLot(lot);
                }
              }}
            />
          )}
          {currentScreen === 'reseller-password' && (
            <PasswordScreen
              onSuccess={() => navigateTo('reseller', undefined, true)}
              onBack={() => navigateBack('dashboard')}
              pinKey="resellerPin"
              title={t('resellerAccount') || 'রিসেলার হিসাব'}
            />
          )}
          {currentScreen === 'reseller' && (
            <ResellerScreen
              onNavigate={handleNavigate}
              onBack={() => {
                if (currentFolderId) {
                  navigateBack('reseller', { folderId: null });
                } else {
                  navigateBack(resellerReturnScreen === 'dashboard' ? 'dashboard' : 'sales-lots');
                }
              }}
              initialFolderId={currentFolderId}
              onFolderChange={(folderId) => {
                if (folderId) {
                  navigateTo('reseller', { folderId });
                } else {
                  navigateBack('reseller', { folderId: null });
                }
              }}
              onSelectMemo={(memoId, lotNumber, folderId) => {
                navigateTo('sales-memo', {
                  salesLot: lotNumber,
                  salesMemoId: memoId,
                  salesMemoReturnScreen: 'reseller',
                  resellerReturnScreen: resellerReturnScreen,
                  folderId: folderId || currentFolderId
                });
              }}
            />
          )}
          {currentScreen === 'aratdar' && (
            <AratdarScreen
              onNavigate={handleNavigate}
              onBack={() => {
                if (currentFolderId) {
                  navigateBack('aratdar', { folderId: null });
                } else {
                  navigateBack('sales-lots');
                }
              }}
              initialFolderId={currentFolderId}
              onFolderChange={(folderId) => {
                if (folderId) {
                  navigateTo('aratdar', { folderId });
                } else {
                  navigateBack('aratdar', { folderId: null });
                }
              }}
              onSelectMemo={(memoId, lotNumber, folderId) => {
                navigateTo('sales-memo', {
                  salesLot: lotNumber,
                  salesMemoId: memoId,
                  salesMemoReturnScreen: 'aratdar',
                  folderId: folderId || currentFolderId
                });
              }}
            />
          )}
          {currentScreen === 'trash' && (
            <TrashScreen 
              onNavigate={handleNavigate} 
              onBack={() => navigateBack('dashboard')}
            />
          )}
          {currentScreen === 'investor-password' && (
            <PasswordScreen
              onSuccess={() => navigateTo('investor-list', undefined, true)}
              onBack={() => navigateBack('dashboard')}
              pinKey="investorPin"
              title={t('investorAccount')}
            />
          )}
          {currentScreen === 'investor-list' && (
            <InvestorListScreen
              onNavigate={handleNavigate}
              onBack={() => navigateBack('dashboard')}
              onSelectInvestor={(id) => {
                navigateTo('investor-memos-list', { investorId: id });
              }}
            />
          )}
          {currentScreen === 'investor-memos-list' && currentInvestorId !== null && (
            <InvestorMemosListScreen
              onNavigate={handleNavigate}
              onBack={() => navigateBack('investor-list')}
              investorId={currentInvestorId}
              onSelectMemo={(memoId) => {
                navigateTo('investor-memo', { investorMemoId: memoId });
              }}
            />
          )}
          {currentScreen === 'investor-memo' && currentInvestorId !== null && currentInvestorMemoId !== null && (
            <InvestorMemoScreen
              onNavigate={handleNavigate}
              onBack={() => navigateBack('investor-memos-list', { investorId: currentInvestorId })}
              investorId={currentInvestorId}
              memoId={currentInvestorMemoId}
            />
          )}
          {currentScreen === 'stock' && (
            <StockScreen 
              onNavigate={handleNavigate}
              onBack={() => navigateBack('dashboard')}
              onSelectPurchaseLot={handleSelectLot}
              onSelectSalesMemo={(memoId, lotNumber) => {
                navigateTo('sales-memo', {
                  salesLot: lotNumber,
                  salesMemoId: memoId,
                  salesMemoReturnScreen: 'stock'
                });
              }}
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={closeSettings}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('settings')}</h2>
              <button className="close-button" onClick={closeSettings}>
                <X size={24} />
              </button>
            </div>
            
            <div className="setting-item">
              <span>{t('theme')}</span>
              <button className="btn btn-secondary" onClick={toggleTheme} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                {theme === 'dark' ? t('darkMode') : t('lightMode')}
              </button>
            </div>

            <div className="setting-item">
              <span>Cloud Sync (অনলাইন সিঙ্ক)</span>
              <button className="btn btn-primary" onClick={handleManualSync} disabled={isSyncing} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
                <RefreshCw size={16} className={isSyncing ? 'spin-icon' : ''} />
                {isSyncing ? 'সিঙ্ক হচ্ছে...' : 'সব মেমো সিঙ্ক করুন'}
              </button>
            </div>

            {(localStorage.getItem('device_permission') === 'admin' || true) && (
              <div className="setting-item">
                <span>Devices & Permissions</span>
                <button className="btn btn-primary" onClick={() => { setIsSettingsOpen(false); openDeviceManager(); }} style={{ fontSize: '0.9rem' }}>
                  Manage Devices
                </button>
              </div>
            )}

            <div className="setting-item">
              <span>Lot Passwords</span>
              <button className="btn btn-secondary" onClick={() => { setIsSettingsOpen(false); openLotPasswordManager(); }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                Manage Lot Passwords
              </button>
            </div>
            <div className="setting-item">
              <span>{t('appVersion')}</span>
              <span style={{ opacity: 0.7 }}>1.0.0 (PWA enabled)</span>
            </div>
            
          </div>
        </div>
      )}
      {/* Lot Password Manager Modal */}
      {isLotPasswordManagerOpen && (
        <div className="modal-overlay" onClick={closeLotPasswordManager} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '450px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <LotPasswordManager onClose={closeLotPasswordManager} />
          </div>
        </div>
      )}
      
      {/* Device Manager Modal */}
      {isDeviceManagerOpen && (
        <div className="modal-overlay" onClick={closeDeviceManager} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <DeviceManager onClose={closeDeviceManager} />
          </div>
        </div>
      )}

      {/* User Menu Modal */}
      {isUserMenuOpen && (
        <div className="modal-overlay" onClick={closeUserMenu}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('account')}</h2>
              <button className="close-button" onClick={closeUserMenu}>
                <X size={24} />
              </button>
            </div>

            <div className="setting-item">
              <span>{t('email')}</span>
              <span style={{ fontWeight: 600 }}>{session?.user?.email || userEmail}</span>
            </div>

            <div className="setting-item">
              <span>অনলাইন সিঙ্ক</span>
              <button className="btn btn-primary" onClick={handleManualSync} disabled={isSyncing} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <RefreshCw size={16} className={isSyncing ? 'spin-icon' : ''} />
                {isSyncing ? 'সিঙ্ক হচ্ছে...' : 'সব মেমো সিঙ্ক করুন'}
              </button>
            </div>

            <div className="setting-item">
              <span>{t('action')}</span>
              <button className="btn btn-secondary" onClick={() => { handleLogout(); setIsUserMenuOpen(false); }}>
                {t('logOut')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pending Reminders Modal */}
      {pendingReminders.length > 0 && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', color: '#fff', minWidth: '400px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#ff9800', margin: 0 }}>Pending Auto Messages ({pendingReminders.length})</h2>
              <button className="btn-icon" onClick={() => setPendingReminders([])}>
                <X size={24} />
              </button>
            </div>
            
            <p style={{ color: '#aaa', marginBottom: '1rem' }}>
              The following scheduled messages are due to be sent. Click "Send" to open WhatsApp/SMS.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingReminders.map(reminder => (
                <div key={reminder.dueId} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: `4px solid ${reminder.config.type === 'whatsapp' ? '#25D366' : '#72be44'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{reminder.name}</span>
                    <span style={{ color: '#ff9800', fontWeight: 'bold' }}>BDT {reminder.totalDue.toFixed(2)}</span>
                  </div>
                  <div style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Mobile: {reminder.mobile || 'No Number'} | Type: {reminder.config.type.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn-primary" 
                      style={{ background: reminder.config.type === 'whatsapp' ? '#25D366' : '#72be44', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                      onClick={() => handleSendMessage(reminder)}
                    >
                      <Send size={16} /> Send Message
                    </button>
                    <button 
                      className="btn-icon" 
                      style={{ background: 'rgba(255,0,0,0.1)', color: '#ff5252', padding: '0.5rem' }}
                      onClick={() => handleUpdateReminderStatus(reminder.dueId, 'failed')}
                      title="Mark as Failed"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {syncToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          background: isOnline ? 'rgba(11, 46, 26, 0.95)' : 'rgba(51, 35, 12, 0.95)',
          border: isOnline ? '1px solid #72be44' : '1px solid #ff9800',
          color: isOnline ? '#72be44' : '#ffb74d',
          padding: '8px 20px',
          borderRadius: '24px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none'
        }}>
          {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{syncToast}</span>
        </div>
      )}
    </div>
  );
}

export default App;

