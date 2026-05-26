import { useState, useEffect, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderIcon, 
  Plus, 
  ChevronRight, 
  Search, 
  Link as LinkIcon,
  PlusCircle,
  FileText,
  Copy,
  ChevronDown,
  MoreVertical,
  ExternalLink,
  FolderPlus,
  ArrowLeft,
  Edit2
} from 'lucide-react';
import { Organization, LibraryFolder, LibraryItem, Division, AppUser, UserProfile } from '../types';
import { createLibraryFolder, subscribeToLibraryFolders, deleteLibraryFolder, updateLibraryFolder, updateTaskLink } from '../services/orgService';
import { subscribeToLibraryItems, addTaskLink, deleteTaskLink } from '../services/taskService';
import Modal from './Modal';
import { Trash2 } from 'lucide-react';

interface LibraryExplorerProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
  division: Division;
}

export default function LibraryExplorer({ user, profile, org, division }: LibraryExplorerProps) {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const isSuperadmin = profile?.role === 'superadmin';
    const unsubFolders = subscribeToLibraryFolders(division.id, user.uid, setFolders, isSuperadmin);
    const unsubItems = subscribeToLibraryItems(division.id, user.uid, setItems, isSuperadmin);
    return () => {
      unsubFolders();
      unsubItems();
    };
  }, [division.id, user.uid, profile?.role]);

  const handleCreateFolder = async (e: any) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      setIsSubmitting(true);
      try {
        // Ensure current user is in members to satisfy security rules
        const members = Array.from(new Set([...division.members, user.uid]));
        await createLibraryFolder(org.id, division.id, newFolderName.trim(), members, currentFolderId);
        setNewFolderName('');
        setIsFolderModalOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleAddManualLink = async (e: any) => {
    e.preventDefault();
    if (newLinkName.trim() && newLinkUrl.trim()) {
      setIsSubmitting(true);
      try {
        const members = Array.from(new Set([...division.members, user.uid]));
        await addTaskLink(
          org.id,
          null, // taskId is null for manual entries
          division.id,
          newLinkName.trim(),
          newLinkUrl.trim(),
          members,
          currentFolderId,
          'manual'
        );
        setNewLinkName('');
        setNewLinkUrl('');
        setIsLinkModalOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editType, setEditType] = useState<'folder' | 'link' | null>(null);

  const handleEdit = async (e: any) => {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;

    setIsSubmitting(true);
    try {
      if (editType === 'folder') {
        await updateLibraryFolder(editingId, editName.trim());
      } else if (editType === 'link') {
        await updateTaskLink(editingId, editName.trim(), editUrl.trim());
      }
      setEditingId(null);
      setEditType(null);
    } catch (err: any) {
      alert(`Gagal menyimpan perubahan: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFolder = async (e: MouseEvent, folderId: string) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      await deleteLibraryFolder(folderId);
      setDeletingId(null);
    } catch (err) {
      alert('Gagal menghapus folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLink = async (e: MouseEvent, linkId: string) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      await deleteTaskLink(linkId);
      setDeletingId(null);
    } catch (err) {
      alert('Gagal menghapus link');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentFolder = folders.find(f => f.id === currentFolderId);
  const childFolders = folders.filter(f => f.parentId === currentFolderId);
  const folderItems = items.filter(item => item.libraryFolderId === currentFolderId);

  const filteredFolders = childFolders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredItems = folderItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Breadcrumbs
  const getBreadcrumbs = () => {
    const crumbs = [];
    let tempId = currentFolderId;
    while (tempId) {
      const folder = folders.find(f => f.id === tempId);
      if (folder) {
        crumbs.unshift(folder);
        tempId = folder.parentId;
      } else {
        break;
      }
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const isManager = profile?.role === 'manager' || profile?.role === 'superadmin' || org.managerId === user.uid;

  return (
    <div className="flex flex-col h-full">
      {/* Search and Global Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search folders or links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/10 w-64"
          />
        </div>
        <div className="flex items-center gap-2">
           {isManager && (
             <button 
               onClick={() => setIsFolderModalOpen(true)}
               className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
             >
               <FolderPlus className="w-4 h-4" />
               New Folder
             </button>
           )}
           <button 
             onClick={() => setIsLinkModalOpen(true)}
             className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all"
           >
             <Plus className="w-4 h-4" />
             Add Link
           </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 py-2 px-3 bg-gray-50 rounded-lg w-fit">
        <button 
          onClick={() => setCurrentFolderId(null)}
          className={`hover:text-gray-900 transition-colors ${!currentFolderId ? 'text-orange-500' : ''}`}
        >
          Library Root
        </button>
        {breadcrumbs.map((crumb) => (
          <div key={crumb.id} className="flex items-center gap-2">
            <ChevronRight className="w-3 h-3" />
            <button 
              onClick={() => setCurrentFolderId(crumb.id)}
              className={`hover:text-gray-900 transition-colors ${currentFolderId === crumb.id ? 'text-orange-500' : ''}`}
            >
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* Folders and Files Grid */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
          <AnimatePresence mode="popLayout">
            {/* Folder Grid */}
            {filteredFolders.map((folder) => (
              <motion.div
                layout
                key={folder.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setCurrentFolderId(folder.id)}
                className="group flex flex-col items-start p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-xl hover:border-orange-500/20 transition-all text-left relative overflow-hidden cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setCurrentFolderId(folder.id);
                  }
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-4 group-hover:scale-110 transition-transform">
                  <FolderIcon className="w-6 h-6 fill-orange-500/20" />
                </div>
                <h4 className="font-bold text-gray-900 truncate w-full">{folder.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Nested Folder</p>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {isManager && (
                    <div className="relative group/menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                        }}
                        className="p-1 px-2 bg-white/90 backdrop-blur-sm border border-gray-100 text-gray-400 rounded-lg hover:text-black hover:bg-white transition-all shadow-sm"
                      >
                        <MoreVertical className="w-3 h-3" />
                      </button>

                      <AnimatePresence>
                        {activeMenuId === folder.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-2 w-32 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setEditingId(folder.id);
                                setEditName(folder.name);
                                setEditType('folder');
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-gray-400 hover:text-black hover:bg-gray-50 transition-all text-left"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setDeletingId(folder.id);
                                setActiveMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-red-500/60 hover:text-red-500 hover:bg-red-50 transition-all text-left border-t border-gray-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <div className="p-1 px-2 bg-orange-500 text-white rounded-lg text-[10px] font-black uppercase">Open</div>
                </div>
              </motion.div>
            ))}

            {/* Item Grid */}
            {filteredItems.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group flex flex-col items-start p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-xl transition-all relative"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  item.source === 'task' ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'
                }`}>
                  <LinkIcon className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900 truncate w-full mb-1">{item.label}</h4>
                <a 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-orange-500 truncate w-full hover:underline flex items-center gap-1"
                >
                  {item.url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>

                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${item.source === 'task' ? 'bg-blue-400' : 'bg-green-400'}`} />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {item.source === 'task' ? 'From Task' : 'Manual Entry'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isManager && (
                      <div className="relative group/menu">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === item.id ? null : item.id);
                          }}
                          className="p-1.5 text-gray-300 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        <AnimatePresence>
                          {activeMenuId === item.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 bottom-full mb-2 w-32 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setEditingId(item.id);
                                  setEditName(item.label);
                                  setEditUrl(item.url);
                                  setEditType('link');
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-gray-400 hover:text-black hover:bg-gray-50 transition-all text-left"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingId(item.id);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-bold text-red-500/60 hover:text-red-500 hover:bg-red-50 transition-all text-left border-t border-gray-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                    <button 
                      onClick={() => navigator.clipboard.writeText(item.url)}
                      className="p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {filteredFolders.length === 0 && filteredItems.length === 0 && (
              <motion.div 
                layout
                className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100"
              >
                <FileText className="w-12 h-12 text-gray-100 mb-4" />
                <h4 className="text-lg font-bold text-gray-400 uppercase tracking-tighter">Empty Folder</h4>
                <p className="text-gray-400 text-sm max-w-xs mx-auto">No folders or links here. Add some manually or attach them to tasks!</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={isFolderModalOpen} onClose={() => setIsFolderModalOpen(false)} title="Create New Folder">
        <form onSubmit={handleCreateFolder} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Folder Name</label>
            <input 
              autoFocus
              required
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 outline-none"
              placeholder="e.g. Documentation"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !newFolderName.trim()}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl disabled:opacity-30 active:scale-95"
          >
            {isSubmitting ? 'Creating...' : 'Create Folder'}
          </button>
        </form>
      </Modal>

      <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} title="Add Manual Link">
        <form onSubmit={handleAddManualLink} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Resource Label</label>
              <input 
                autoFocus
                required
                type="text"
                value={newLinkName}
                onChange={(e) => setNewLinkName(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 outline-none"
                placeholder="e.g. Project Roadmap"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">URL / Link</label>
              <input 
                required
                type="url"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 outline-none"
                placeholder="https://example.com"
              />
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !newLinkName.trim() || !newLinkUrl.trim()}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl disabled:opacity-30 active:scale-95"
          >
            {isSubmitting ? 'Adding...' : 'Add Resource'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Overlays */}
      <AnimatePresence>
        {deletingId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6"
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
              <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Konfirmasi Hapus</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8">
                 Data ini akan dihapus secara permanen. Apakah Anda yakin?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={isSubmitting}
                  onClick={() => setDeletingId(null)}
                  className="py-4 rounded-2xl font-bold text-sm text-gray-400 hover:text-black hover:bg-gray-50 transition-all border border-gray-100"
                >
                  Batal
                </button>
                <button
                  onClick={(e) => {
                    const item = items.find(i => i.id === deletingId);
                    if (item) handleDeleteLink(e, item.id);
                    else handleDeleteFolder(e, deletingId!);
                  }}
                  disabled={isSubmitting}
                  className="py-4 bg-red-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={editingId !== null}
        onClose={() => {
          setEditingId(null);
          setEditType(null);
        }}
        title={`Edit ${editType === 'folder' ? 'Folder' : 'Resource'}`}
      >
        <form onSubmit={handleEdit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Name</label>
              <input 
                autoFocus
                required
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 outline-none"
              />
            </div>
            {editType === 'link' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">URL</label>
                <input 
                  required
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 outline-none"
                />
              </div>
            )}
          </div>
          <button 
            type="submit"
            className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl active:scale-95"
          >
            Save Changes
          </button>
        </form>
      </Modal>
    </div>
  );
}
