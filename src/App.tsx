import { useState, useEffect } from 'react';
import { Search, User, Settings, X, Moon, Sun, Globe, ShoppingCart, Clock, ShoppingBag, Plus, Home, Trash2, Send, XCircle, TrendingUp } from 'lucide-react';
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
import DueMemoScreen from './components/DueMemoScreen';
import DueSalesMemoScreen from './components/DueSalesMemoScreen';
import PaidDueListScreen from './components/PaidDueListScreen';
import TrashScreen from './components/TrashScreen';
import InvestorListScreen from './components/InvestorListScreen';
import InvestorMemosListScreen from './components/InvestorMemosListScreen';
import InvestorMemoScreen from './components/InvestorMemoScreen';
import { useLanguage } from './i18n/LanguageContext';
import { supabase } from './utils/supabaseClient';
import LoginScreen from './components/LoginScreen';
import DeviceManager from './components/DeviceManager';
import { LotPasswordManager } from './components/LotPasswordManager';

import { restoreFromCloud, setupRealtimeSync, pushUnsyncedLocalData } from './utils/syncEngine';

export type Screen = 'dashboard' | 'password' | 'lots' | 'memo' | 'due-category' | 'due-types' | 'due-list' | 'due-purchase-list' | 'paid-due-list' | 'sales-lots' | 'sales-memo-list' | 'sales-memo' | 'due-memo' | 'due-sales-memo' | 'trash' | 'investor-password' | 'investor-list' | 'investor-memos-list' | 'investor-memo';

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
  const [theme, setTheme] = useState('dark');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeviceManagerOpen, setIsDeviceManagerOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLotPasswordManagerOpen, setIsLotPasswordManagerOpen] = useState(false);
  const [userEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await pushUnsyncedLocalData();
          await restoreFromCloud();
        setupRealtimeSync();
        
        // --- Device Validity Check ---
        const deviceId = localStorage.getItem('device_id');
        if (deviceId) {
          const { data, error } = await supabase.from('active_sessions').select('status, permission').eq('device_id', deviceId).single();
          if (error || !data || data.status === 'revoked') {
            await supabase.auth.signOut();
            localStorage.clear();
            window.location.reload();
            return;
          }
          if (data.permission) {
             localStorage.setItem('device_permission', data.permission);
          }
          
          // Setup realtime listener for this specific device to auto-logout if kicked
          supabase.channel(`device_${deviceId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions', filter: `device_id=eq.${deviceId}` }, async (payload) => {
              if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && payload.new.status === 'revoked')) {
                await supabase.auth.signOut();
                localStorage.clear();
                window.location.reload();
              } else if (payload.eventType === 'UPDATE' && payload.new.permission) {
                localStorage.setItem('device_permission', payload.new.permission);
                window.dispatchEvent(new Event('settingsChange'));
              }
            }).subscribe();
        }
        // --- End Device Check ---
      }
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [currentLot, setCurrentLot] = useState<number | null>(null);
  const [currentSalesLot, setCurrentSalesLot] = useState<number | null>(null);
  const [currentSalesMemoId, setCurrentSalesMemoId] = useState<string | null>(null);
  const [salesMemoReturnScreen, setSalesMemoReturnScreen] = useState<Screen>('sales-lots');
  const [currentDueType, setCurrentDueType] = useState<'regular' | 'permanent' | 'purchase'>('regular');
  const [currentDueId, setCurrentDueId] = useState<string | null>(null);
  const [isPaidDue, setIsPaidDue] = useState<boolean>(false);
  const [currentInvestorId, setCurrentInvestorId] = useState<string | null>(null);
  const [currentInvestorMemoId, setCurrentInvestorMemoId] = useState<string | null>(null);
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);

  const { t, language, toggleLanguage } = useLanguage();

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

  const handleLogin = () => {
    // Actually, we use LoginScreen now, this is just for safety.
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.reload();
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handlePasswordSuccess = () => {
    setCurrentScreen('lots');
  };

  const handleSelectLot = (lotNumber: number) => {
    setCurrentLot(lotNumber);
    setCurrentScreen('memo');
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

  if (loadingAuth) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', color: 'var(--text-color)' }}>Loading...</div>;
  }

  if (!session) {
    return <LoginScreen onLoginSuccess={() => {
      // Force reload to apply synced localstorage data correctly
      window.location.reload();
    }} />;
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
              const results: { label: string; screen: Screen; id?: string; lotNumber?: number | null; memoId?: string }[] = [];

              // Search Sales Memos
              const salesLots = localStorage.getItem('sales_lots_list');
              if (salesLots) {
                try {
                  JSON.parse(salesLots).forEach((lot: number) => {
                    const memoListStr = localStorage.getItem(`sales_memo_list_lot_${lot}`);
                    if (memoListStr) {
                      JSON.parse(memoListStr).forEach((memoId: string) => {
                        const memoStr = localStorage.getItem(`sales_memo_lot_${lot}_memo_${memoId}`);
                        if (memoStr) {
                          try {
                            const memo = JSON.parse(memoStr);
                            const name = (memo.customerName || '').toLowerCase();
                            if (name.includes(q)) {
                              results.push({ label: `${t('salesAccount')}: ${memo.customerName} (Lot ${lot})`, screen: 'sales-memo', lotNumber: lot, memoId });
                            }
                          } catch (e) {}
                        }
                      });
                    }
                  });
                } catch (e) {}
              }

              // Search Due Memos
              ['regular', 'permanent'].forEach(type => {
                const duesStr = localStorage.getItem(`dues_${type}`);
                if (duesStr) {
                  try {
                    JSON.parse(duesStr).forEach((dueId: string) => {
                      const memoStr = localStorage.getItem(`due_memo_${dueId}`);
                      if (memoStr) {
                        try {
                          const memo = JSON.parse(memoStr);
                          const name = (memo.name || '').toLowerCase();
                          if (name.includes(q)) {
                            results.push({ label: `${t('dueAccount')} (${type === 'regular' ? t('regularSeller') : t('aratdarSeller')}): ${memo.name}`, screen: 'due-memo', id: dueId });
                          }
                        } catch (e) {}
                      }
                    });
                  } catch (e) {}
                }
              });

              // Search Purchase Memos (lots by supplier name)
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
                          results.push({ label: `${t('purchaseAccount')}: ${memo.supplierName} (Lot ${lot})`, screen: 'memo', lotNumber: lot });
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
                    results.map((r, i) => (
                      <div
                        key={i}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem' }}
                        onClick={() => {
                          setSearchQuery('');
                          if (r.screen === 'sales-memo' && r.lotNumber && r.memoId) {
                            setCurrentSalesLot(r.lotNumber);
                            setCurrentSalesMemoId(r.memoId);
                            handleNavigate('sales-memo');
                          } else if (r.screen === 'due-memo' && r.id) {
                            setCurrentDueId(r.id);
                            setIsPaidDue(false);
                            handleNavigate('due-memo');
                          } else if (r.screen === 'memo' && r.lotNumber) {
                            setCurrentLot(r.lotNumber);
                            handleNavigate('memo');
                          }
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {r.label}
                      </div>
                    ))
                  )}
                </div>
              );
            })()}
          </div>
          <div className="user-info">
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
          {currentScreen !== 'dashboard' && currentScreen !== 'password' ? (
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
                className="sidebar-nav-item disabled"
                onClick={() => {}}
                title={t('blank')}
              >
                <Plus size={24} />
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
                onClick={() => handleNavigate('lots')}
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
            <button className="btn-icon-wrapper" onClick={() => setIsSettingsOpen(true)}>
              <Settings size={36} className="sidebar-icon" />
            </button>
            <button className="btn-icon-wrapper" title={(session?.user?.email || userEmail) || "Login"} onClick={() => (session?.user?.email || userEmail) ? setIsUserMenuOpen(true) : handleLogin()}>
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
              onBack={() => handleNavigate('dashboard')} 
            />
          )}
          {currentScreen === 'lots' && (
            <LotsScreen 
              onNavigate={handleNavigate} 
              onSelectLot={handleSelectLot} 
            />
          )}
          {currentScreen === 'memo' && currentLot !== null && (
            <MemoScreen 
              onNavigate={handleNavigate} 
              lotNumber={currentLot} 
            />
          )}
          {currentScreen === 'due-category' && (
            <DueCategoryScreen 
              onNavigate={handleNavigate} 
            />
          )}
          {currentScreen === 'due-types' && (
            <DueTypesScreen 
              onNavigate={handleNavigate} 
              onSelectType={(type) => {
                setCurrentDueType(type);
                handleNavigate('due-list');
              }} 
            />
          )}
          {currentScreen === 'due-list' && (
            <DueListScreen 
              onNavigate={handleNavigate} 
              dueType={currentDueType} 
              onSelectDue={(id) => {
                setCurrentDueId(id);
                setIsPaidDue(false);
                handleNavigate('due-sales-memo');
              }}
            />
          )}
          {currentScreen === 'due-purchase-list' && (
            <DueListScreen 
              onNavigate={handleNavigate} 
              dueType="purchase"
              onSelectDue={(id) => {
                setCurrentDueId(id);
                setIsPaidDue(false);
                handleNavigate('due-memo');
              }}
            />
          )}
          {currentScreen === 'paid-due-list' && (
            <PaidDueListScreen 
              onNavigate={handleNavigate} 
              dueType={currentDueType} 
              onSelectDue={(id) => {
                setCurrentDueId(id);
                setIsPaidDue(true);
                handleNavigate('due-memo');
              }}
            />
          )}
          {currentScreen === 'due-memo' && currentDueId !== null && (
            <DueMemoScreen 
              onNavigate={handleNavigate} 
              dueId={currentDueId}
              isPaid={isPaidDue}
              dueType="purchase"
            />
          )}
          {currentScreen === 'due-sales-memo' && currentDueId !== null && (
            <DueSalesMemoScreen 
              onNavigate={handleNavigate} 
              dueId={currentDueId}
              isPaid={isPaidDue}
              dueType={currentDueType === 'purchase' ? 'regular' : currentDueType}
            />
          )}
          {currentScreen === 'sales-lots' && (
            <SalesLotsScreen 
              onNavigate={handleNavigate} 
              onSelectLot={(lot) => {
                setCurrentSalesLot(lot);
                handleNavigate('sales-memo-list');
              }}
              onSelectMemo={(memoId, lotNumber) => {
                if (lotNumber !== null) setCurrentSalesLot(lotNumber);
                setCurrentSalesMemoId(memoId);
                setSalesMemoReturnScreen('sales-lots');
                handleNavigate('sales-memo');
              }}
            />
          )}
          {currentScreen === 'sales-memo-list' && currentSalesLot !== null && (
            <SalesMemoListScreen 
              onNavigate={handleNavigate} 
              lotNumber={currentSalesLot}
              onSelectMemo={(memoId) => {
                setCurrentSalesMemoId(memoId);
                setSalesMemoReturnScreen('sales-memo-list');
                handleNavigate('sales-memo');
              }}
            />
          )}
          {currentScreen === 'sales-memo' && currentSalesMemoId !== null && (
            <SalesMemoScreen 
              onNavigate={handleNavigate} 
              onBack={() => handleNavigate(salesMemoReturnScreen)}
              lotNumber={currentSalesLot} 
              memoId={currentSalesMemoId}
              onLotChange={(lot) => setCurrentSalesLot(lot)}
            />
          )}
          {currentScreen === 'trash' && (
            <TrashScreen 
              onNavigate={handleNavigate} 
            />
          )}
          {currentScreen === 'investor-password' && (
            <PasswordScreen
              onSuccess={() => handleNavigate('investor-list')}
              onBack={() => handleNavigate('dashboard')}
              pinKey="investorPin"
              title={t('investorAccount')}
            />
          )}
          {currentScreen === 'investor-list' && (
            <InvestorListScreen
              onNavigate={handleNavigate}
              onSelectInvestor={(id) => {
                setCurrentInvestorId(id);
                handleNavigate('investor-memos-list');
              }}
            />
          )}
          {currentScreen === 'investor-memos-list' && currentInvestorId !== null && (
            <InvestorMemosListScreen
              onNavigate={handleNavigate}
              investorId={currentInvestorId}
              onSelectMemo={(memoId) => {
                setCurrentInvestorMemoId(memoId);
                handleNavigate('investor-memo');
              }}
            />
          )}
          {currentScreen === 'investor-memo' && currentInvestorId !== null && currentInvestorMemoId !== null && (
            <InvestorMemoScreen
              onNavigate={handleNavigate}
              investorId={currentInvestorId}
              memoId={currentInvestorMemoId}
            />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('settings')}</h2>
              <button className="close-button" onClick={() => setIsSettingsOpen(false)}>
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

            {(localStorage.getItem('device_permission') === 'admin' || true) && (
              <div className="setting-item">
                <span>Devices & Permissions</span>
                <button className="btn btn-primary" onClick={() => { setIsSettingsOpen(false); setIsDeviceManagerOpen(true); }} style={{ fontSize: '0.9rem' }}>
                  Manage Devices
                </button>
              </div>
            )}

            <div className="setting-item">
              <span>Lot Passwords</span>
              <button className="btn btn-secondary" onClick={() => { setIsSettingsOpen(false); setIsLotPasswordManagerOpen(true); }} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
        <div className="modal-overlay" onClick={() => setIsLotPasswordManagerOpen(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', maxWidth: '450px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <LotPasswordManager onClose={() => setIsLotPasswordManagerOpen(false)} />
          </div>
        </div>
      )}
      
      {/* Device Manager Modal */}
      {isDeviceManagerOpen && (
        <div className="modal-overlay" onClick={() => setIsDeviceManagerOpen(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '400px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <DeviceManager onClose={() => setIsDeviceManagerOpen(false)} />
          </div>
        </div>
      )}

      {/* User Menu Modal */}
      {isUserMenuOpen && (
        <div className="modal-overlay" onClick={() => setIsUserMenuOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('account')}</h2>
              <button className="close-button" onClick={() => setIsUserMenuOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="setting-item">
              <span>{t('email')}</span>
              <span style={{ fontWeight: 600 }}>{session?.user?.email || userEmail}</span>
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
    </div>
  );
}

export default App;

