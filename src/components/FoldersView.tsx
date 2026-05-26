import { useState, useEffect, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ChevronRight, 
  Building2,
  Folder as FolderIcon,
  Menu,
  ArrowLeft,
  Trash2,
  MoreVertical,
  Edit2
} from 'lucide-react';
import { Organization, Division, UserProfile, AppUser } from '../types';
import { subscribeToFolders, createFolder, deleteFolder, updateFolder } from '../services/orgService';
import TaskBoard from './TaskBoard';
import LibraryExplorer from './LibraryExplorer';
import ChatView from './ChatView';
import Modal from './Modal';

interface FoldersViewProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
  selectedDivisionId: string | null;
  setSelectedDivisionId: (id: string | null) => void;
  selectedTaskId?: string | null;
  onNavigateToTask: (divisionId: string, taskId: string) => void;
  isFocusMode: boolean;
  setIsFocusMode: (v: boolean) => void;
}

export default function FoldersView({ 
  user, 
  profile, 
  org, 
  selectedDivisionId: selectedFolderId, 
  setSelectedDivisionId: setSelectedFolderId, 
  selectedTaskId,
  onNavigateToTask,
  isFocusMode,
  setIsFocusMode
}: FoldersViewProps) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [activeSubView, setActiveSubView] = useState<'tasks' | 'library' | 'chat'>('tasks');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const isManager = profile?.role === 'manager' || profile?.role === 'superadmin' || org.managerId === user.uid;

  useEffect(() => {
    if (selectedTaskId) {
      setActiveSubView('tasks');
    }
  }, [selectedTaskId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isModalOpen) {
      setFormError(null);
    }
  }, [isModalOpen]);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleEditDivision = async (e: any) => {
    e.preventDefault();
    if (!editingFolderId || !editName.trim()) return;

    setIsSubmitting(true);
    try {
      await updateFolder(editingFolderId, editName.trim());
      setEditingFolderId(null);
      setActiveMenuId(null);
    } catch (err: any) {
      alert(`Gagal mengubah nama Divisi: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const isSuperadmin = profile?.role === 'superadmin';
    const unsub = subscribeToFolders(org.id, user.uid, setDivisions, isSuperadmin);
    return unsub;
  }, [org.id, user.uid, profile?.role]);

  const handleCreateDivision = async (e: any) => {
    e.preventDefault();
    if (newDivisionName.trim()) {
      setFormError(null);
      setIsSubmitting(true);
      try {
        const newFolderId = await createFolder(org.id, newDivisionName.trim(), '', org.members);
        if (newFolderId) {
          setSelectedFolderId(newFolderId);
        }
        setNewDivisionName('');
        setIsModalOpen(false);
      } catch (err: any) {
        console.error('Create division error:', err);
        setFormError(err.message || 'Gagal membuat divisi. Silakan coba lagi.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDeleteDivision = async (e: MouseEvent, divisionId: string) => {
    e.stopPropagation();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteFolder(divisionId);
      if (selectedFolderId === divisionId) {
        setSelectedFolderId(null);
      }
      setDeletingFolderId(null);
    } catch (err: any) {
      alert(`Gagal menghapus divisi: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedDivision = divisions.find(d => d.id === selectedFolderId);

  return (
    <>
    <div className="h-full flex overflow-hidden">
      {/* Division selection sidebar */}
      <div className={`${(isSidebarCollapsed || isFocusMode) ? 'w-0 opacity-0 invisible -translate-x-full' : 'w-72 opacity-100 visible translate-x-0'} border-r border-black/5 flex flex-col shrink-0 bg-white transition-all duration-500 ease-in-out relative z-40 shadow-sm`}>
        <div className="p-8 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-1">Division Index</span>
              <h2 className="text-xl font-bold tracking-tight text-black">Divisions</h2>
            </div>
          <button 
            onClick={() => setIsSidebarCollapsed(true)}
            className="p-2 hover:bg-gray-50 rounded-xl text-gray-300 hover:text-black transition-all group"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 mb-6">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-orange-500 hover:shadow-xl hover:shadow-orange-500/20 transition-all active:scale-95 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            Add District
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-1 no-scrollbar lg:mt-2">
          {divisions.map((division) => (
            <div
              key={division.id}
              onClick={() => {
                setSelectedFolderId(division.id);
              }}
              className={`w-full group flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left cursor-pointer ${
                selectedFolderId === division.id 
                  ? 'bg-orange-500/5 text-orange-600' 
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedFolderId(division.id);
                }
              }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                selectedFolderId === division.id ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-gray-100 text-gray-400 group-hover:bg-white'
              }`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm truncate tracking-tight leading-tight ${selectedFolderId === division.id ? 'text-black' : ''}`}>{division.name}</p>
              </div>
              
              {isManager && (
                <div className="relative group/menu flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === division.id ? null : division.id);
                    }}
                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-40 relative ${
                      selectedFolderId === division.id ? 'text-orange-600 hover:bg-orange-500/10' : 'text-gray-300 hover:text-black hover:bg-gray-100'
                    }`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {activeMenuId === division.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="absolute right-0 top-full mt-2 w-32 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setEditingFolderId(division.id);
                            setEditName(division.name);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-gray-400 hover:text-black hover:bg-gray-50 transition-all text-left"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Ubah Nama
                        </button>
                        <button
                          onClick={() => {
                            setDeletingFolderId(division.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-red-500/60 hover:text-red-500 hover:bg-red-50 transition-all text-left border-t border-gray-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Delete Confirmation Overlay */}
                  <AnimatePresence>
                    {deletingFolderId === division.id && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <motion.div 
                          initial={{ scale: 0.9, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          className="bg-white rounded-3xl p-8 max-w-xs w-full shadow-2xl text-center"
                        >
                          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Trash2 className="w-8 h-8" />
                          </div>
                          <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Hapus Divisi?</h3>
                          <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                             Seluruh data tugas dan library di <span className="font-bold text-black">"{division.name}"</span> akan dihapus permanen.
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              disabled={isDeleting}
                              onClick={() => setDeletingFolderId(null)}
                              className="py-4 rounded-2xl font-bold text-sm text-gray-400 hover:text-black hover:bg-gray-50 transition-all border border-gray-100"
                            >
                              Batal
                            </button>
                            <button
                              onClick={(e) => handleDeleteDivision(e, division.id)}
                              disabled={isDeleting}
                              className="py-4 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                              {isDeleting ? 'Menghapus...' : 'Hapus'}
                            </button>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <ChevronRight className={`w-4 h-4 transition-all ${selectedFolderId === division.id ? 'translate-x-1 text-orange-500' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative">
        {!selectedFolderId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#FAFAFA] relative">
            {isSidebarCollapsed && (
              <button 
                onClick={() => setIsSidebarCollapsed(false)}
                className="absolute left-8 top-8 w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center hover:bg-orange-500 hover:shadow-2xl transition-all z-[60] group shadow-xl"
                title="Show List"
              >
                <Menu className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
              </button>
            )}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <div className="w-24 h-24 rounded-[3rem] bg-indigo-50 flex items-center justify-center text-indigo-500 mb-8 rotate-3 shadow-xl shadow-indigo-500/10">
                <Building2 className="w-12 h-12" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter mb-4">Select a Division</h3>
              <p className="text-gray-400 text-sm max-w-xs font-medium leading-relaxed">
                Manage your organization by divisions. Each division has its own tasks, library, and real-time team chat.
              </p>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Division Header */}
            <header className={`px-10 py-8 flex items-center justify-between shrink-0 transition-all duration-300 ${
              isFocusMode ? 'bg-[#0079BF]' : 'bg-white'
            }`}>
              <div className="flex items-center gap-8">
                {(isSidebarCollapsed || isFocusMode) && (
                  <button 
                    onClick={() => {
                      if (isFocusMode) {
                        setIsFocusMode(false);
                      } else {
                        setIsSidebarCollapsed(false);
                      }
                    }}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group shrink-0 ${
                      isFocusMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-50 text-gray-400 hover:bg-white hover:shadow-xl'
                    }`}
                    title={isFocusMode ? "Back to normal view" : "Show List"}
                  >
                    {isFocusMode ? <ArrowLeft className="w-5 h-5" /> : <Menu className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />}
                  </button>
                )}
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center text-white shadow-2xl shadow-orange-500/30 shrink-0">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className={`text-3xl font-bold tracking-tight truncate max-w-md ${
                      isFocusMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {selectedDivision?.name}
                    </h2>
                    <div className={`flex items-center gap-2 text-[11px] font-medium mt-1.5 ${
                      isFocusMode ? 'text-white/40' : 'text-gray-400'
                    }`}>
                       <span>{org.name} Workspace</span>
                       <span className="w-1 h-1 rounded-full bg-current opacity-30" />
                       <span>{divisions.length} Divisions</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={`flex p-1.5 rounded-2xl shrink-0 ${isFocusMode ? 'bg-white/10' : 'bg-gray-100/80'}`}>
                {[
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'library', label: 'Library' },
                  { id: 'chat', label: 'Team Chat' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubView(tab.id as any)}
                    className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                      activeSubView === tab.id 
                        ? (isFocusMode ? 'bg-white text-[#0079BF] shadow-lg' : 'bg-white text-orange-500 shadow-md')
                        : (isFocusMode ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-black')
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </header>

            {/* Tab Content */}
            <div className="flex-1 relative overflow-hidden bg-[#FAFAFA]">
              <AnimatePresence mode="wait">
                {activeSubView === 'tasks' ? (
                  <motion.div
                    key="tasks"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                    className="absolute inset-0 overflow-y-auto no-scrollbar"
                  >
                    <TaskBoard 
                      user={user} 
                      profile={profile} 
                      org={org} 
                      divisionId={selectedFolderId}
                      selectedTaskId={selectedTaskId}
                      isFocusMode={isFocusMode}
                      setIsFocusMode={setIsFocusMode}
                    />
                  </motion.div>
                ) : activeSubView === 'library' ? (
                  <motion.div
                    key="library"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute inset-0 p-8 overflow-y-auto no-scrollbar"
                  >
                    <div className="max-w-6xl mx-auto pb-20">
                      <div className="mb-10 text-center">
                        <h3 className="text-3xl font-black uppercase tracking-tighter text-gray-900 mb-2">Resource Library</h3>
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Digital Assets & Documentation</p>
                      </div>
                      {selectedDivision && <LibraryExplorer user={user} profile={profile} org={org} division={selectedDivision} />}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                  >
                    <ChatView 
                      user={user} 
                      profile={profile} 
                      org={org} 
                      divisionId={selectedFolderId} 
                      onNavigateToTask={onNavigateToTask}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
    
    <Modal 
      isOpen={isModalOpen} 
      onClose={() => setIsModalOpen(false)} 
      title="Create New Division"
    >
      <form onSubmit={handleCreateDivision} className="space-y-6">
        {formError && (
          <div className="p-4 bg-red-50 border border-red-250 rounded-2xl text-red-700 text-xs font-semibold leading-relaxed">
            {formError}
          </div>
        )}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Division Name</label>
          <input 
            autoFocus
            required
            type="text"
            value={newDivisionName}
            onChange={(e) => setNewDivisionName(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all outline-none"
            placeholder="e.g. Sales & Marketing"
          />
        </div>
        <button 
          type="submit" 
          disabled={isSubmitting || !newDivisionName.trim()}
          className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95"
        >
          {isSubmitting ? 'Creating...' : 'Create Division'}
        </button>
      </form>
    </Modal>

    <Modal
      isOpen={editingFolderId !== null}
      onClose={() => setEditingFolderId(null)}
      title="Ubah Nama Divisi"
    >
      <form onSubmit={handleEditDivision} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Nama Baru</label>
          <input 
            autoFocus
            required
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
          />
        </div>
        <button 
          type="submit"
          className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl active:scale-95"
        >
          Simpan Perubahan
        </button>
      </form>
    </Modal>
    </>
  );
}
