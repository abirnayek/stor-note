import React, { useState, useEffect } from 'react';
import { type Screen } from '../App';
import { 
  ChevronLeft, Plus, Move, Search, Trash2, UserCheck, CheckCircle2, 
  AlertCircle, Calendar, FileText, Folder, FolderPlus, FolderOpen, 
  Edit3, ArrowRight, X 
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { getAllGlobalSalesMemos, getAratdarMemos, deleteSalesMemoCompletely, moveSalesMemoToFolder, type SalesMemoGlobalItem } from '../utils/dueSyncUtils';
import { moveToTrash } from '../utils/trashUtils';
import { MemoLockIcon, ProtectedMemoWrapper } from './MemoLock';

interface AratdarScreenProps {
  onNavigate: (screen: Screen) => void;
  onSelectMemo: (memoId: string, lotNumber: number | null, folderId?: string | null) => void;
  onBack?: () => void;
  initialFolderId?: string | null;
  onFolderChange?: (folderId: string | null) => void;
}

export interface MemoFolder {
  id: string;
  name: string;
  createdAt: string;
  createdAtTime?: string;
  note?: string;
}

const ARATDAR_FOLDERS_KEY = 'aratdar_folders';

const AratdarScreen: React.FC<AratdarScreenProps> = ({ onNavigate, onSelectMemo, onBack, initialFolderId, onFolderChange }) => {
  const [memos, setMemos] = useState<SalesMemoGlobalItem[]>([]);
  const [folders, setFolders] = useState<MemoFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId || null);
  const [activeTab, setActiveTab] = useState<'folders' | 'all'>('folders');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'due' | 'paid'>('all');
  
  // Folder modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPassword, setNewFolderPassword] = useState('');

  const [editingFolder, setEditingFolder] = useState<MemoFolder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const [movingMemo, setMovingMemo] = useState<SalesMemoGlobalItem | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [draggedMemoId, setDraggedMemoId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dropSuccessMsg, setDropSuccessMsg] = useState<string | null>(null);

  const { language } = useLanguage();

  const loadFolders = () => {
    try {
      const raw = localStorage.getItem(ARATDAR_FOLDERS_KEY);
      if (raw) {
        setFolders(JSON.parse(raw));
      } else {
        setFolders([]);
      }
    } catch (e) {
      setFolders([]);
    }
  };

  const loadMemos = () => {
    const list = getAratdarMemos();
    setMemos(list);
  };

  useEffect(() => {
    loadFolders();
    loadMemos();

    const handleSync = () => {
      loadFolders();
      loadMemos();
    };

    window.addEventListener('storage', handleSync);
    return () => window.removeEventListener('storage', handleSync);
  }, []);

  useEffect(() => {
    setSelectedFolderId(initialFolderId || null);
  }, [initialFolderId]);

  const saveFoldersToStorage = (updated: MemoFolder[]) => {
    setFolders(updated);
    localStorage.setItem(ARATDAR_FOLDERS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const newFolder: MemoFolder = {
      id: Date.now().toString(),
      name: trimmed,
      createdAt: today,
      createdAtTime: currentTime
    };

    if (newFolderPassword.trim()) {
      localStorage.setItem(`aratdar_folder_password_${newFolder.id}`, newFolderPassword.trim());
    }

    const updated = [...folders, newFolder];
    saveFoldersToStorage(updated);
    setNewFolderName('');
    setNewFolderPassword('');
    setShowCreateModal(false);
  };

  const handleSaveRenameFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder) return;
    const trimmed = editFolderName.trim();
    if (!trimmed) return;

    const updated = folders.map(f => f.id === editingFolder.id ? { ...f, name: trimmed } : f);
    saveFoldersToStorage(updated);

    // Also update folderName inside memos that reference this folder
    memos.forEach(m => {
      if (m.folderId === editingFolder.id) {
        const memoKey = `sales_memo_${m.id}`;
        const memoStr = localStorage.getItem(memoKey);
        if (memoStr) {
          try {
            const parsed = JSON.parse(memoStr);
            parsed.folderName = trimmed;
            localStorage.setItem(memoKey, JSON.stringify(parsed));
          } catch (err) {}
        }
      }
    });

    loadMemos();
    setEditingFolder(null);
    setEditFolderName('');
  };

  const handleDeleteFolder = (folder: MemoFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${folder.name}" ফোল্ডারটি ডিলিট করতে চান?\n(ভেতরের মেমোগুলো মুছে যাবে না, সেগুলো ফোল্ডারবিহীন হিসেবে সংরক্ষিত থাকবে)`
      : `Are you sure you want to delete folder "${folder.name}"?\n(Inner memos will not be lost, they will become unassigned)`;

    if (window.confirm(confirmMsg)) {
      moveToTrash({
        id: `aratdar_folder_${folder.id}`,
        type: 'aratdar_folder',
        title: `Aratdar Folder: ${folder.name}`,
        data: folder
      });

      // Detach folder from memos
      memos.forEach(m => {
        if (m.folderId === folder.id) {
          const memoKey = `sales_memo_${m.id}`;
          const memoStr = localStorage.getItem(memoKey);
          if (memoStr) {
            try {
              const parsed = JSON.parse(memoStr);
              parsed.folderId = '';
              parsed.folderName = '';
              localStorage.setItem(memoKey, JSON.stringify(parsed));
            } catch (err) {}
          }
        }
      });

      const updated = folders.filter(f => f.id !== folder.id);
      saveFoldersToStorage(updated);
      localStorage.removeItem(`aratdar_folder_password_${folder.id}`);

      if (selectedFolderId === folder.id) {
        setSelectedFolderId(null);
        onFolderChange?.(null);
      }
      loadMemos();
    }
  };

  const handleAddMemo = (folderIdToAssign?: string | null) => {
    let nextId = Date.now().toString();
    const allGlobal = getAllGlobalSalesMemos();
    const numericIds = allGlobal.map(m => Number(m.id)).filter(n => !isNaN(n) && n > 0 && n < 1000000000);
    if (numericIds.length > 0) {
      nextId = (Math.max(...numericIds) + 1).toString();
    } else {
      nextId = '1';
    }

    const today = new Date().toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const activeFolder = folderIdToAssign 
      ? folders.find(f => f.id === folderIdToAssign)
      : (selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null);

    const initialState = {
      customerName: '',
      address: '',
      mobile: '',
      lotNumberInput: '',
      lotNumber: '',
      paidAmount: '',
      customerType: 'permanent',
      folderId: activeFolder ? activeFolder.id : '',
      folderName: activeFolder ? activeFolder.name : '',
      status: 'draft',
      createdAt: today,
      createdAtTime: currentTime,
      sellerSignature: localStorage.getItem('default_seller_signature') || '',
      entries: [{ id: Date.now().toString(), name: '', totalKg: '', weightUnit: 'kg', profitPercent: '' }]
    };

    localStorage.setItem(`sales_memo_${nextId}`, JSON.stringify(initialState));

    try {
      const tsRaw = localStorage.getItem('local_timestamps');
      let tsMap: Record<string, number> = tsRaw ? JSON.parse(tsRaw) : {};
      tsMap[`sales_memo_${nextId}`] = Date.now();
      localStorage.setItem('local_timestamps', JSON.stringify(tsMap));
    } catch (e) {}

    window.dispatchEvent(new Event('storage'));
    onSelectMemo(nextId, null, activeFolder ? activeFolder.id : selectedFolderId);
  };

  const handleDeleteMemo = (memo: SalesMemoGlobalItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = language === 'bn'
      ? `আপনি কি "${memo.name || 'মেমো #' + memo.id}" আড়তদার মেমোটি মুছে ট্র্যাশে পাঠাতে চান?`
      : `Are you sure you want to move Aratdar Memo "${memo.name || '#' + memo.id}" to Trash?`;

    if (window.confirm(confirmMsg)) {
      deleteSalesMemoCompletely(memo.id, { name: memo.name, lotNumber: memo.lotNumber });
      setMemos(prev => prev.filter(m => m.id !== memo.id));
    }
  };

  const moveMemoToFolder = (memoId: string, folderId: string) => {
    const targetFolder = folders.find(f => String(f.id) === String(folderId));
    if (!targetFolder) return;

    const res = moveSalesMemoToFolder(memoId, folderId, targetFolder.name);
    loadMemos();

    const msg = language === 'bn'
      ? `"${res.memoTitle}" মেমোটি সফলভাবে "${targetFolder.name}" ফোল্ডারে সরানো হয়েছে!`
      : `Memo "${res.memoTitle}" moved into "${targetFolder.name}" folder!`;
    setDropSuccessMsg(msg);
    setTimeout(() => setDropSuccessMsg(null), 3500);
  };

  const handleSaveMoveMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingMemo) return;

    const matchedFolder = folders.find(f => String(f.id) === String(targetFolderId));
    moveSalesMemoToFolder(movingMemo.id, targetFolderId || '', matchedFolder ? matchedFolder.name : '');
    loadMemos();
    setMovingMemo(null);
    setTargetFolderId('');
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Currently viewed folder object
  const currentFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  // Filtered memos according to current view (Inside folder or All)
  const currentScopeMemos = selectedFolderId 
    ? memos.filter(m => m.folderId === selectedFolderId)
    : memos;

  const filteredMemos = currentScopeMemos.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.dateStr && m.dateStr.toLowerCase().includes(q));

    let matchesStatus = true;
    if (statusFilter === 'due') {
      matchesStatus = m.status === 'due' || m.dueAmount > 0;
    } else if (statusFilter === 'paid') {
      matchesStatus = m.status === 'paid' && m.dueAmount <= 0;
    }

    return matchesSearch && matchesStatus;
  });

  // Unassigned memos (memos with no folder assigned)
  const unassignedMemos = memos.filter(m => !m.folderId || !folders.some(f => f.id === m.folderId));

  // Totals for top statistics
  const totalSales = currentScopeMemos.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  const totalPaid = currentScopeMemos.reduce((sum, m) => sum + (m.paidAmount || 0), 0);
  const totalDue = currentScopeMemos.reduce((sum, m) => sum + (m.dueAmount || 0), 0);

  return (
    <div className="lots-screen" style={{ paddingBottom: '3rem' }}>
      {/* Header */}
      <div className="screen-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            key="btn-back-aratdar"
            className="btn-icon"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedFolderId) {
                if (onBack) {
                  onBack();
                } else {
                  setSelectedFolderId(null);
                  onFolderChange?.(null);
                }
              } else if (onBack) {
                onBack();
              } else {
                onNavigate('sales-lots');
              }
            }}
            title="Back"
          >
            <ChevronLeft size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: 'rgba(171, 71, 188, 0.15)', border: '1px solid rgba(171, 71, 188, 0.3)', borderRadius: '10px', padding: '6px', display: 'flex' }}>
              <UserCheck size={24} style={{ color: '#ce93d8' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                  {selectedFolderId && currentFolder 
                    ? `📁 ${currentFolder.name}` 
                    : (language === 'bn' ? 'আড়তদারের মেমো ও ফোল্ডার' : 'Aratdar Memos & Folders')}
                </h2>
                {currentFolder && (
                  <button 
                    onClick={() => { setEditingFolder(currentFolder); setEditFolderName(currentFolder.name); }}
                    style={{ background: 'none', border: 'none', color: '#ce93d8', cursor: 'pointer', padding: '2px' }}
                    title={language === 'bn' ? 'ফোল্ডারের নাম পরিবর্তন' : 'Rename Folder'}
                  >
                    <Edit3 size={15} />
                  </button>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                {selectedFolderId && currentFolder 
                  ? (language === 'bn' ? `ফোল্ডারে তৈরি: ${currentFolder.createdAt || 'N/A'}` : `Folder Created: ${currentFolder.createdAt || 'N/A'}`)
                  : (language === 'bn' ? 'আড়তদারের সকল ফোল্ডার, মেমো ও হিসাব' : 'All Aratdar Folders, Sales & Memos')}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', color: '#888' }} />
            <input
              type="text"
              placeholder={language === 'bn' ? 'নাম বা মেমো নং খুঁজুন...' : 'Search name or memo #...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '0.45rem 0.8rem 0.45rem 2.2rem',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                width: '190px'
              }}
            />
          </div>

          {/* New Folder Button (only on root view) */}
          {!selectedFolderId && (
            <button
              onClick={() => { setNewFolderName(''); setNewFolderPassword(''); setShowCreateModal(true); }}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #7b1fa2, #9c27b0)',
                color: '#ffffff',
                fontWeight: 'bold',
                border: '1px solid rgba(225, 190, 231, 0.35)',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(156, 39, 176, 0.35)'
              }}
            >
              <FolderPlus size={18} />
              <span>{language === 'bn' ? '+ নতুন ফোল্ডার' : '+ New Folder'}</span>
            </button>
          )}

          {/* Add New Memo Button */}
          <button
            onClick={() => handleAddMemo(selectedFolderId)}
            className="btn-primary"
            style={{
              background: 'linear-gradient(135deg, #8e24aa, #ab47bc)',
              color: '#ffffff',
              fontWeight: 'bold',
              border: 'none',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(171, 71, 188, 0.3)'
            }}
          >
            <Plus size={18} />
            <span>
              {selectedFolderId 
                ? (language === 'bn' ? '+ এই ফোল্ডারে মেমো' : '+ Memo In Folder')
                : (language === 'bn' ? '+ নতুন মেমো' : '+ New Memo')}
            </span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="screen-sub-container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
        {!selectedFolderId && (
          <div style={{
            background: 'rgba(18, 48, 32, 0.75)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '1rem 1.2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {language === 'bn' ? 'মোট ফোল্ডার' : 'Total Folders'}
            </span>
            <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#e1bee7' }}>
              {folders.length}
            </span>
          </div>
        )}

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {selectedFolderId 
              ? (language === 'bn' ? 'এই ফোল্ডারে মেমো' : 'Memos In Folder')
              : (language === 'bn' ? 'মোট আড়তদার মেমো' : 'Total Aratdar Memos')}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#fff' }}>
            {currentScopeMemos.length}
          </span>
        </div>

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট বিক্রয়' : 'Total Sales'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#ce93d8' }}>
            ৳ {formatNumber(totalSales)}
          </span>
        </div>

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট জমা' : 'Total Paid'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#72be44' }}>
            ৳ {formatNumber(totalPaid)}
          </span>
        </div>

        <div style={{
          background: 'rgba(18, 48, 32, 0.75)',
          border: totalDue > 0 ? '1px solid rgba(255, 152, 0, 0.4)' : '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1rem 1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {language === 'bn' ? 'মোট বাকি' : 'Total Due'}
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: totalDue > 0 ? '#ff9800' : '#888' }}>
            ৳ {formatNumber(totalDue)}
          </span>
        </div>
      </div>

      {/* Main Tabs / Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
        {selectedFolderId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                if (onBack) {
                  onBack();
                } else {
                  setSelectedFolderId(null);
                  onFolderChange?.(null);
                }
              }}
              style={{
                background: 'rgba(171, 71, 188, 0.15)',
                color: '#e1bee7',
                border: '1px solid rgba(171, 71, 188, 0.35)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <ChevronLeft size={16} />
              <span>{language === 'bn' ? '← সকল ফোল্ডারে ফিরুন' : '← Back to Folders'}</span>
            </button>
            <span style={{ color: '#aaa', fontSize: '0.85rem' }}>/</span>
            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.95rem' }}>📁 {currentFolder?.name}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => setActiveTab('folders')}
              style={{
                background: activeTab === 'folders' ? '#ab47bc' : 'rgba(255,255,255,0.06)',
                color: activeTab === 'folders' ? '#ffffff' : '#bbb',
                border: activeTab === 'folders' ? '1px solid #ab47bc' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Folder size={15} />
              <span>{language === 'bn' ? 'ফোল্ডারসমূহ' : 'Folders'} ({folders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all')}
              style={{
                background: activeTab === 'all' ? '#ab47bc' : 'rgba(255,255,255,0.06)',
                color: activeTab === 'all' ? '#ffffff' : '#bbb',
                border: activeTab === 'all' ? '1px solid #ab47bc' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '6px 16px',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={15} />
              <span>{language === 'bn' ? 'সকল মেমো' : 'All Memos'} ({memos.length})</span>
            </button>
          </div>
        )}

        {/* Status Filter for memos */}
        {(selectedFolderId || activeTab === 'all') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                background: statusFilter === 'all' ? '#ab47bc' : 'rgba(255,255,255,0.06)',
                color: statusFilter === 'all' ? '#ffffff' : '#bbb',
                border: statusFilter === 'all' ? '1px solid #ab47bc' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {language === 'bn' ? 'সব' : 'All'} ({currentScopeMemos.length})
            </button>
            <button
              onClick={() => setStatusFilter('due')}
              style={{
                background: statusFilter === 'due' ? '#ff9800' : 'rgba(255,255,255,0.06)',
                color: statusFilter === 'due' ? '#000' : '#bbb',
                border: statusFilter === 'due' ? '1px solid #ff9800' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {language === 'bn' ? 'বকেয়া' : 'Due'} ({currentScopeMemos.filter(m => m.status === 'due' || m.dueAmount > 0).length})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              style={{
                background: statusFilter === 'paid' ? '#72be44' : 'rgba(255,255,255,0.06)',
                color: statusFilter === 'paid' ? '#000' : '#bbb',
                border: statusFilter === 'paid' ? '1px solid #72be44' : '1px solid rgba(255,255,255,0.15)',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {language === 'bn' ? 'পরিশোধিত' : 'Paid'} ({currentScopeMemos.filter(m => m.status === 'paid' && m.dueAmount <= 0).length})
            </button>
          </div>
        )}
      </div>

      {/* CONTENT AREA */}
      {/* 1. Folders Grid View (Root level, tab === 'folders') */}
      {!selectedFolderId && activeTab === 'folders' && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.2rem'
          }}>
            {/* Standard Add Folder Card (Identical to .add-lot-card in Lots & Memos screens) */}
            <div 
              className="lot-card add-lot-card"
              onClick={() => { setNewFolderName(''); setNewFolderPassword(''); setShowCreateModal(true); }}
              style={{
                minHeight: '200px',
                cursor: 'pointer',
                border: '2px dashed rgba(171, 71, 188, 0.55)',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                background: 'rgba(171, 71, 188, 0.05)',
                color: '#ce93d8',
                transition: 'all 0.2s ease',
                padding: '1.25rem'
              }}
            >
              <div className="add-lot-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <FolderPlus size={48} style={{ color: '#ce93d8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                  {language === 'bn' ? 'নতুন ফোল্ডার' : 'New Folder'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                  {language === 'bn' ? 'ফোল্ডার তৈরি করতে চাপ দিন' : 'Click to create folder'}
                </span>
              </div>
            </div>
              {folders.map(folder => {
                const folderMemos = memos.filter(m => m.folderId === folder.id);
                const fTotalSales = folderMemos.reduce((s, m) => s + (m.totalAmount || 0), 0);
                const fTotalDue = folderMemos.reduce((s, m) => s + (m.dueAmount || 0), 0);
                const folderPwdKey = `aratdar_folder_password_${folder.id}`;

                return (
                  <ProtectedMemoWrapper
                    key={folder.id}
                    passwordKey={folderPwdKey}
                    name={folder.name}
                    type="folder"
                    onAccessGranted={() => {
                      setSelectedFolderId(folder.id);
                      onFolderChange?.(folder.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverFolderId !== folder.id) {
                        setDragOverFolderId(folder.id);
                      }
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverFolderId(folder.id);
                    }}
                    onDragLeave={(e) => {
                      e.stopPropagation();
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      if (dragOverFolderId === folder.id) setDragOverFolderId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const mId = e.dataTransfer.getData('application/memo-id') || e.dataTransfer.getData('text/plain') || draggedMemoId || (window as any).__draggedMemoId;
                      setDragOverFolderId(null);
                      setDraggedMemoId(null);
                      (window as any).__draggedMemoId = null;
                      if (mId) moveMemoToFolder(mId, folder.id);
                    }}
                  >
                    <div
                      className="lot-card action-card"
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        border: dragOverFolderId === folder.id 
                          ? '2px dashed #e1bee7' 
                          : '1px solid rgba(171, 71, 188, 0.4)',
                        borderRadius: '14px',
                        padding: '1.25rem',
                        background: dragOverFolderId === folder.id
                          ? 'linear-gradient(145deg, rgba(74, 20, 140, 0.95), rgba(46, 125, 50, 0.95))'
                          : 'linear-gradient(145deg, rgba(32, 18, 48, 0.85), rgba(18, 48, 32, 0.85))',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        boxShadow: dragOverFolderId === folder.id
                          ? '0 0 25px rgba(171, 71, 188, 0.65)'
                          : '0 6px 20px rgba(0, 0, 0, 0.3)',
                        transform: dragOverFolderId === folder.id ? 'scale(1.02)' : 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        height: '100%',
                        minHeight: '170px'
                      }}
                    >
                      {/* Drag Over Drop Indicator Overlay */}
                      {dragOverFolderId === folder.id && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: '14px',
                          background: 'rgba(74, 20, 140, 0.88)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          zIndex: 35,
                          pointerEvents: 'none',
                          backdropFilter: 'blur(3px)'
                        }}>
                          <FolderOpen size={42} style={{ color: '#fff' }} />
                          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>
                            {language === 'bn' ? `"${folder.name}" ফোল্ডারে ড্রপ করুন` : `Drop into "${folder.name}"`}
                          </span>
                        </div>
                      )}
                      {/* Folder Top Line */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            background: 'rgba(171, 71, 188, 0.25)',
                            border: '1px solid rgba(171, 71, 188, 0.4)',
                            borderRadius: '10px',
                            padding: '8px',
                            color: '#e1bee7',
                            display: 'flex'
                          }}>
                            <Folder size={24} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#ffffff', fontWeight: 'bold' }}>
                              {folder.name}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {folder.createdAt || 'Active Folder'}
                            </span>
                          </div>
                        </div>

                        {/* Top Actions: Lock & Rename & Delete */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <MemoLockIcon passwordKey={folderPwdKey} />
                          <button
                            className="btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                              setEditFolderName(folder.name);
                            }}
                            title={language === 'bn' ? 'ফোল্ডারের নাম পরিবর্তন' : 'Rename Folder'}
                            style={{ padding: '4px', color: '#ce93d8' }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            className="btn-icon delete-btn"
                            onClick={(e) => handleDeleteFolder(folder, e)}
                            title={language === 'bn' ? 'ফোল্ডার মুছুন' : 'Delete Folder'}
                            style={{
                              padding: '4px',
                              color: '#ff5252',
                              background: 'transparent',
                              border: 'none'
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Folder Metrics */}
                      <div style={{
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '6px',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {language === 'bn' ? 'মেমো' : 'Memos'}
                          </span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                            {folderMemos.length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '0 6px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {language === 'bn' ? 'মোট বিক্রয়' : 'Sales'}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#ce93d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            ৳ {formatNumber(fTotalSales)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {language === 'bn' ? 'বাকি' : 'Due'}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: fTotalDue > 0 ? '#ff9800' : '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            ৳ {formatNumber(fTotalDue)}
                          </span>
                        </div>
                      </div>

                      {/* Enter Folder Button Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        color: '#ce93d8',
                        fontWeight: 'bold',
                        paddingTop: '2px'
                      }}>
                        <span>{language === 'bn' ? 'ফোল্ডারে প্রবেশ করুন' : 'View Folder Memos'}</span>
                        <ArrowRight size={15} />
                      </div>
                    </div>
                  </ProtectedMemoWrapper>
                );
              })}
            </div>

          {/* Section: Unassigned / General Memos (Memos not in any folder) */}
          {unassignedMemos.length > 0 && (
            <div style={{ marginTop: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: '#ce93d8' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>
                    {language === 'bn' 
                      ? `সাধারণ / ফোল্ডারবিহীন মেমো (${unassignedMemos.length})` 
                      : `Unassigned Memos (${unassignedMemos.length})`}
                  </h3>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                  {language === 'bn' ? 'এই মেমোগুলো যেকোনো ফোল্ডারে স্থানান্তর করা যাবে' : 'Can be moved to any folder'}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '1.1rem'
              }}>
                {unassignedMemos.map(memo => {
                  const isDue = memo.status === 'due' || memo.dueAmount > 0;
                  const isPaid = memo.status === 'paid' && memo.dueAmount <= 0;

                  return (
                    <ProtectedMemoWrapper
                      key={memo.id}
                      passwordKey={`memo_password_sales_memo_${memo.id}`}
                      name={memo.name || `মেমো #${memo.id}`}
                      type="memo"
                      onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber, selectedFolderId)}
                    >
                      <div
                        className="lot-card action-card"
                        draggable={true}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', memo.id);
                          e.dataTransfer.setData('application/memo-id', memo.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedMemoId(memo.id);
                          (window as any).__draggedMemoId = memo.id;
                        }}
                        onDragEnd={() => {
                          setDraggedMemoId(null);
                          setDragOverFolderId(null);
                          (window as any).__draggedMemoId = null;
                        }}
                        style={{
                          position: 'relative',
                          cursor: 'grab',
                          opacity: draggedMemoId === memo.id ? 0.4 : 1,
                          border: isDue ? '1px solid rgba(255, 152, 0, 0.45)' : (isPaid ? '1px solid rgba(114, 190, 68, 0.45)' : '1px solid var(--border-color)'),
                          borderRadius: '14px',
                          padding: '1.15rem 1.25rem',
                          background: 'rgba(18, 48, 32, 0.85)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.9rem',
                          boxSizing: 'border-box',
                          transform: draggedMemoId === memo.id ? 'scale(0.97)' : 'none',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: '38px' }}>
                          <span style={{
                            background: 'rgba(171, 71, 188, 0.2)',
                            color: '#ce93d8',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            #{memo.id.length > 8 ? memo.id.slice(-6) : memo.id}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isPaid && (
                              <span style={{ background: 'rgba(114, 190, 68, 0.2)', color: '#72be44', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                {language === 'bn' ? 'পরিশোধিত' : 'Paid'}
                              </span>
                            )}
                            {isDue && (
                              <span style={{ background: 'rgba(255, 152, 0, 0.18)', color: '#ff9800', borderRadius: '6px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 'bold' }}>
                                {language === 'bn' ? 'বকেয়া' : 'Due'}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          className="btn-icon delete-btn"
                          title="Delete Memo"
                          onClick={(e) => handleDeleteMemo(memo, e)}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            width: '28px',
                            height: '28px',
                            background: 'rgba(255, 82, 82, 0.12)',
                            border: '1px solid rgba(255, 82, 82, 0.3)',
                            borderRadius: '6px',
                            color: '#ff5252',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>

                        <div>
                          <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={16} style={{ color: '#ce93d8' }} />
                            <span>{memo.name || (language === 'bn' ? 'বেনামী আড়তদার' : 'Unnamed Aratdar')}</span>
                          </div>
                          {memo.dateStr && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
                              {memo.dateStr}
                            </div>
                          )}
                        </div>

                        {/* Bill Bar */}
                        <div style={{
                          background: 'rgba(0, 0, 0, 0.35)',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: '4px'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{language === 'bn' ? 'বিল' : 'Bill'}</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#fff' }}>৳ {formatNumber(memo.totalAmount || 0)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{language === 'bn' ? 'জমা' : 'Paid'}</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#4ade80' }}>৳ {formatNumber(memo.paidAmount || 0)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{language === 'bn' ? 'বাকি' : 'Due'}</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: memo.dueAmount > 0 ? '#fb923c' : '#94a3b8' }}>৳ {formatNumber(memo.dueAmount || 0)}</div>
                          </div>
                        </div>

                        {/* Action: Move to Folder & Drag indicator */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }} onClick={e => e.stopPropagation()}>
                          <span style={{
                            fontSize: '0.73rem',
                            color: '#94a3b8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '3px 8px',
                            borderRadius: '5px'
                          }}>
                            <Move size={12} /> {language === 'bn' ? 'ড্রাগ করে ফোল্ডারে রাখুন' : 'Drag to folder'}
                          </span>

                          <button
                            onClick={() => { setMovingMemo(memo); setTargetFolderId(memo.folderId || ''); }}
                            style={{
                              background: 'rgba(171, 71, 188, 0.15)',
                              border: '1px solid rgba(171, 71, 188, 0.35)',
                              color: '#ce93d8',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer'
                            }}
                          >
                            <Folder size={13} />
                            <span>{language === 'bn' ? 'ফোল্ডারে স্থানান্তর' : 'Move to Folder'}</span>
                          </button>
                        </div>
                      </div>
                    </ProtectedMemoWrapper>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Memos Grid View (Inside Folder or 'All Memos' tab) */}
      {(selectedFolderId || activeTab === 'all') && (
        <div style={{ marginTop: '1.5rem' }}>
          {filteredMemos.length === 0 ? (
            <div style={{
              background: 'rgba(18, 48, 32, 0.4)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{ background: 'rgba(171, 71, 188, 0.1)', borderRadius: '50%', padding: '1.2rem', color: '#ce93d8' }}>
                <UserCheck size={48} />
              </div>
              <div style={{ maxWidth: '420px' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1.2rem' }}>
                  {language === 'bn' ? 'কোনো মেমো পাওয়া যায়নি' : 'No Memos Found'}
                </h3>
                <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {selectedFolderId 
                    ? (language === 'bn' ? 'এই ফোল্ডারে এখনো কোনো মেমো তৈরি করা হয়নি।' : 'No memos inside this folder yet.')
                    : (language === 'bn' ? 'নতুন মেমো তৈরি করতে উপরের বাটনে চাপুন।' : 'Create a new memo using the button above.')}
                </p>
              </div>
              <button
                onClick={() => handleAddMemo(selectedFolderId)}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #8e24aa, #ab47bc)',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  border: 'none',
                  padding: '0.6rem 1.4rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '0.5rem'
                }}
              >
                <Plus size={18} />
                <span>
                  {selectedFolderId 
                    ? (language === 'bn' ? '+ এই ফোল্ডারে মেমো তৈরি করুন' : '+ Create Memo In Folder')
                    : (language === 'bn' ? '+ নতুন আড়তদার মেমো তৈরি করুন' : '+ Create Aratdar Memo')}
                </span>
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem'
            }}>
              {filteredMemos.map(memo => {
                const isDue = memo.status === 'due' || memo.dueAmount > 0;
                const isPaid = memo.status === 'paid' && memo.dueAmount <= 0;
                const memoFolder = folders.find(f => f.id === memo.folderId);

                return (
                  <ProtectedMemoWrapper
                    key={memo.id}
                    passwordKey={`memo_password_sales_memo_${memo.id}`}
                    name={memo.name || `মেমো #${memo.id}`}
                    type="memo"
                    onAccessGranted={() => onSelectMemo(memo.id, memo.lotNumber, selectedFolderId)}
                  >
                    <div
                      className="lot-card action-card"
                      style={{
                        position: 'relative',
                        cursor: 'pointer',
                        border: isDue ? '1px solid rgba(255, 152, 0, 0.45)' : (isPaid ? '1px solid rgba(114, 190, 68, 0.45)' : '1px solid var(--border-color)'),
                        borderRadius: '14px',
                        padding: '1.15rem 1.25rem',
                        background: 'rgba(18, 48, 32, 0.85)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '0.9rem',
                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                    >
                      {/* Header line of card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px', paddingRight: '38px', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            title={`Memo #${memo.id}`}
                            style={{
                              background: 'rgba(171, 71, 188, 0.2)',
                              color: '#ce93d8',
                              border: '1px solid rgba(171, 71, 188, 0.4)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            #{memo.id.length > 8 ? memo.id.slice(-6) : memo.id}
                          </span>

                          {/* Folder badge if on all memos view */}
                          {memoFolder && !selectedFolderId && (
                            <span style={{
                              background: 'rgba(171, 71, 188, 0.15)',
                              color: '#e1bee7',
                              border: '1px solid rgba(171, 71, 188, 0.3)',
                              borderRadius: '6px',
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              <Folder size={11} />
                              {memoFolder.name}
                            </span>
                          )}

                          {memo.lotNumber && (
                            <span style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#cbd5e1',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '6px',
                              padding: '2px 7px',
                              fontSize: '0.72rem',
                              whiteSpace: 'nowrap'
                            }}>
                              Lot {memo.lotNumber}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {isPaid && (
                            <span style={{
                              background: 'rgba(114, 190, 68, 0.2)',
                              color: '#72be44',
                              border: '1px solid rgba(114, 190, 68, 0.4)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              <CheckCircle2 size={12} /> {language === 'bn' ? 'পরিশোধিত' : 'Paid'}
                            </span>
                          )}
                          {isDue && (
                            <span style={{
                              background: 'rgba(255, 152, 0, 0.18)',
                              color: '#ff9800',
                              border: '1px solid rgba(255, 152, 0, 0.4)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap'
                            }}>
                              <AlertCircle size={12} /> {language === 'bn' ? 'বকেয়া' : 'Due'}
                            </span>
                          )}
                          {!isPaid && !isDue && (
                            <span style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#aaa',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              whiteSpace: 'nowrap'
                            }}>
                              {language === 'bn' ? 'খসড়া' : 'Draft'}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        className="btn-icon delete-btn"
                        title={language === 'bn' ? 'মেমো মুছুন' : 'Delete Memo'}
                        onClick={(e) => handleDeleteMemo(memo, e)}
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          width: '28px',
                          height: '28px',
                          margin: 0,
                          padding: 0,
                          background: 'rgba(255, 82, 82, 0.12)',
                          border: '1px solid rgba(255, 82, 82, 0.3)',
                          borderRadius: '6px',
                          color: '#ff5252',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2
                        }}
                      >
                        <Trash2 size={14} />
                      </button>

                      {/* Customer Info */}
                      <div style={{ width: '100%' }}>
                        <div style={{
                          fontSize: '1.2rem',
                          fontWeight: 'bold',
                          color: '#ffffff',
                          wordBreak: 'break-word',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px'
                        }}>
                          <FileText size={17} style={{ color: '#ce93d8', opacity: 0.9, flexShrink: 0 }} />
                          <span>{memo.name || (language === 'bn' ? 'বেনামী আড়তদার' : 'Unnamed Aratdar')}</span>
                        </div>
                        {memo.dateStr && (
                          <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '4px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={12} style={{ opacity: 0.7 }} />
                            <span>{memo.dateStr}</span>
                            {memo.timeStr && <span>• {memo.timeStr}</span>}
                          </div>
                        )}
                      </div>

                      {/* Financial summary bar */}
                      <div style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '8px 10px',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '6px',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {language === 'bn' ? 'মোট বিল' : 'Total Bill'}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            ৳ {memo.totalAmount ? formatNumber(memo.totalAmount) : '0.00'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '0 4px' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {language === 'bn' ? 'জমা' : 'Paid'}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#4ade80', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            ৳ {memo.paidAmount ? formatNumber(memo.paidAmount) : '0.00'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {language === 'bn' ? 'বাকি' : 'Due'}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: memo.dueAmount > 0 ? '#fb923c' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                            ৳ {memo.dueAmount ? formatNumber(memo.dueAmount) : '0.00'}
                          </span>
                        </div>
                      </div>

                      {/* Footer bar with Move to folder action */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '2px' }} onClick={e => e.stopPropagation()}>
                        <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                          {memoFolder ? `📁 ${memoFolder.name}` : (language === 'bn' ? 'ফোল্ডারহীন' : 'No Folder')}
                        </span>
                        <button
                          onClick={() => { setMovingMemo(memo); setTargetFolderId(memo.folderId || ''); }}
                          style={{
                            background: 'rgba(171, 71, 188, 0.15)',
                            border: '1px solid rgba(171, 71, 188, 0.35)',
                            color: '#ce93d8',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Folder size={12} />
                          <span>{language === 'bn' ? 'ফোল্ডার পরিবর্তন' : 'Change Folder'}</span>
                        </button>
                      </div>
                    </div>
                  </ProtectedMemoWrapper>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>

      {/* MODAL 1: Create New Folder */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', color: '#fff' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderPlus size={22} style={{ color: '#ce93d8' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                  {language === 'bn' ? 'নতুন আড়তদার ফোল্ডার' : 'New Aratdar Folder'}
                </h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  {language === 'bn' ? 'ফোল্ডারের নাম *' : 'Folder Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={language === 'bn' ? 'যেমন: মেসার্স রহিম আড়ত বা ফোল্ডার ১' : 'e.g. Rahim Arat or Folder 1'}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px' }}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  {language === 'bn' ? 'পাসওয়ার্ড (ঐচ্ছিক - ফোল্ডার লক করার জন্য)' : 'Password (Optional - for locking folder)'}
                </label>
                <input
                  type="password"
                  placeholder={language === 'bn' ? 'খালি রাখলে পাসওয়ার্ড ছাড়াই খোলা যাবে' : 'Leave blank for no password'}
                  value={newFolderPassword}
                  onChange={e => setNewFolderPassword(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px' }}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1 }}
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #8e24aa, #ab47bc)' }}
                >
                  {language === 'bn' ? 'ফোল্ডার তৈরি করুন' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Rename Folder */}
      {editingFolder && (
        <div className="modal-overlay" onClick={() => setEditingFolder(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', color: '#fff' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} style={{ color: '#ce93d8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {language === 'bn' ? 'ফোল্ডারের নাম পরিবর্তন' : 'Rename Folder'}
                </h3>
              </div>
              <button 
                onClick={() => setEditingFolder(null)}
                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRenameFolder}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  {language === 'bn' ? 'নতুন নাম *' : 'New Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px' }}
                  autoFocus
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingFolder(null)}
                  style={{ flex: 1 }}
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #8e24aa, #ab47bc)' }}
                >
                  {language === 'bn' ? 'সংরক্ষণ করুন' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Move Memo to Folder */}
      {movingMemo && (
        <div className="modal-overlay" onClick={() => setMovingMemo(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', color: '#fff' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={20} style={{ color: '#ce93d8' }} />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {language === 'bn' ? 'মেমো ফোল্ডারে স্থানান্তর' : 'Move Memo to Folder'}
                </h3>
              </div>
              <button 
                onClick={() => setMovingMemo(null)}
                style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: 0 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMoveMemo}>
              <div style={{ marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{language === 'bn' ? 'নির্বাচিত মেমো:' : 'Selected Memo:'}</div>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem', marginTop: '2px' }}>
                  #{movingMemo.id.slice(-6)} - {movingMemo.name || 'Unnamed'}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#e2e8f0' }}>
                  {language === 'bn' ? 'টার্গেট ফোল্ডার নির্বাচন করুন:' : 'Select Target Folder:'}
                </label>
                <select
                  value={targetFolderId}
                  onChange={e => setTargetFolderId(e.target.value)}
                  className="supplier-input"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', color: '#fff', background: '#1e293b' }}
                >
                  <option value="">{language === 'bn' ? '-- কোনো ফোল্ডারে নয় (ফোল্ডারহীন) --' : '-- No Folder (Unassigned) --'}</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMovingMemo(null)}
                  style={{ flex: 1 }}
                >
                  {language === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #8e24aa, #ab47bc)' }}
                >
                  {language === 'bn' ? 'স্থানান্তর করুন' : 'Move'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Drag & Drop Toast */}
      {dropSuccessMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 99999,
          background: 'linear-gradient(135deg, #1b5e20, #2e7d32)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 'bold',
          fontSize: '0.92rem',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          <CheckCircle2 size={20} style={{ color: '#a5d6a7' }} />
          <span>{dropSuccessMsg}</span>
        </div>
      )}
    </div>
  );
};

export default AratdarScreen;
