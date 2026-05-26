import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Organization, Folder, UserProfile, Task, LibraryItem, AppUser } from '../types';
import { createOrganization } from '../services/orgService';
import { subscribeToOrgTasks, subscribeToOrgLinks } from '../services/taskService';
import { Building2, Plus, Search, X, Tag, ChevronRight, FileText, ExternalLink, ChevronUp, ChevronDown, Menu, Folder as FolderIcon, MessageSquare, BarChart3, Users } from 'lucide-react';
import FoldersView from './FoldersView';
import ChatView from './ChatView';
import DashboardView from './DashboardView';
import SettingsView from './SettingsView';
import UsersView from './UsersView';
import SpaceMembersView from './SpaceMembersView';
import Modal from './Modal';
import NotificationBell from './NotificationBell';

interface MainContentProps {
  user: AppUser;
  profile: UserProfile | null;
  selectedOrg: Organization | undefined;
  setSelectedOrgId?: (id: string | null) => void;
  activeView: 'folders' | 'chat' | 'team-chat' | 'dashboard' | 'settings' | 'users' | 'space-members';
  setActiveView: (view: any) => void;
  selectedDivisionId: string | null;
  setSelectedDivisionId: (id: string | null) => void;
  isFocusMode: boolean;
  setIsFocusMode: (v: boolean) => void;
}

export default function MainContent({ 
  user, 
  profile,
  selectedOrg, 
  setSelectedOrgId,
  activeView, 
  setActiveView,
  selectedDivisionId, 
  setSelectedDivisionId,
  isFocusMode,
  setIsFocusMode
 }: MainContentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [allLinks, setAllLinks] = useState<LibraryItem[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault();
    if (newOrgName.trim() && user) {
      setIsSubmitting(true);
      try {
        await createOrganization(newOrgName.trim(), user.uid);
        setNewOrgName('');
        setIsModalOpen(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };
  
  useEffect(() => {
    if (selectedOrg && user) {
      const isSuperadmin = profile?.role === 'superadmin';
      const unsubTasks = subscribeToOrgTasks(selectedOrg.id, user.uid, setAllTasks, isSuperadmin);
      const unsubLinks = subscribeToOrgLinks(selectedOrg.id, user.uid, setAllLinks, isSuperadmin);
      return () => {
        unsubTasks();
        unsubLinks();
      };
    }
  }, [selectedOrg, user, profile?.role]);

  const filteredTasks = searchQuery.trim().length > 1 
    ? allTasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredLinks = searchQuery.trim().length > 1
    ? allLinks.filter(l => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const handleNavigateToTask = (divisionId: string, taskId: string, orgId?: string) => {
    if (orgId && setSelectedOrgId && selectedOrg?.id !== orgId) {
      setSelectedOrgId(orgId);
    }
    setSelectedDivisionId(divisionId);
    setSelectedTaskId(taskId);
    setActiveView('folders');
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleNavigateToChat = (divisionId?: string, orgId?: string) => {
    if (orgId && setSelectedOrgId && selectedOrg?.id !== orgId) {
      setSelectedOrgId(orgId);
    }
    setSelectedDivisionId(divisionId || null);
    setActiveView('chat');
    setSearchQuery('');
  };

  if (!selectedOrg) {
    return (
      <>
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#F5F5F3]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-2xl border border-black/5 flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[2rem] flex items-center justify-center mb-8 rotate-3 shadow-lg shadow-orange-500/10">
            <Building2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Ready to start?</h2>
          <p className="text-gray-500 mb-10 leading-relaxed text-sm">
            Create your first organization to start managing folders, tasks, and collaborating with your team in real-time.
          </p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full flex items-center justify-center gap-3 bg-black text-white py-4 px-8 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl hover:shadow-orange-500/20 active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            Create Organization
          </button>
        </motion.div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create Organization"
      >
        <form onSubmit={handleCreateOrg} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Organization Name</label>
            <input 
              autoFocus
              required
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
              placeholder="e.g. Acme Corporation"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSubmitting || !newOrgName.trim()}
            className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95"
          >
            {isSubmitting ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      </Modal>
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <header className={`px-8 transition-all duration-300 border-b border-black/5 shrink-0 bg-white/50 backdrop-blur-xl z-[50] ${isHeaderVisible && !isFocusMode ? 'py-5 opacity-100' : 'h-0 py-0 opacity-0 overflow-hidden'}`}>
        <div className="flex items-center justify-between gap-8">
          <div className="min-w-0 flex items-center gap-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500 mb-1 block">Active Workspace</span>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 truncate">{selectedOrg.name}</h1>
            </div>
          </div>

          <div className="flex-1 max-w-2xl relative hidden lg:block">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 group-focus-within:text-orange-500 transition-colors" />
              <input 
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onFocus={() => setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl pl-12 pr-4 py-2.5 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none border border-black/5"
              />
              
              <AnimatePresence>
                {showSearchResults && searchQuery.trim().length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl shadow-2xl border border-black/5 overflow-hidden z-[100]"
                  >
                    <div className="p-4 border-b border-gray-100">
                       <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Search Results</p>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                      {filteredTasks.length === 0 && filteredLinks.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm font-bold text-gray-400">No results found for "{searchQuery}"</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {filteredTasks.map(task => (
                            <button
                              key={task.id}
                              onClick={() => handleNavigateToTask(task.folderId, task.id)}
                              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all text-left group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                                  <Tag className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-gray-900 group-hover:text-orange-600 transition-colors">{task.title}</p>
                                  <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Task in {task.category}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                            </button>
                          ))}
                          
                          {filteredLinks.map(link => (
                            <a
                              key={link.id}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-all text-left group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">{link.label}</p>
                                  <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">Document / Link</p>
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-all" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 shrink-0">
             <NotificationBell 
               userId={user.uid} 
               onNavigateToTask={handleNavigateToTask}
               onNavigateToChat={handleNavigateToChat}
             />
             <button 
              onClick={() => setIsHeaderVisible(false)}
              className="p-3 hover:bg-gray-100 rounded-xl text-gray-300 hover:text-orange-500 transition-all group"
              title="Hide Header"
            >
              <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* Space-Specific Sub Navigation */}
      {activeView !== 'settings' && (
        <div className="px-8 py-3.5 bg-gray-50/50 backdrop-blur-md border-b border-black/[0.03] flex items-center justify-between gap-4 overflow-x-auto no-scrollbar shrink-0 select-none">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'folders', icon: FolderIcon, label: 'Divisions' },
              { id: 'team-chat', icon: MessageSquare, label: 'Space Chat' },
              { id: 'dashboard', icon: BarChart3, label: 'KPI Dashboard' },
              { id: 'space-members', icon: Users, label: 'Space Members' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 relative cursor-pointer outline-none border border-transparent ${
                    isActive 
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/10 scale-[1.02]' 
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100/60'
                  }`}
                  style={{ touchAction: 'manipulation' }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeSpaceTabLine" 
                      className="absolute -bottom-3.5 left-4 right-4 h-0.5 bg-orange-500 rounded-full hidden md:block"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest bg-white shadow-sm border border-black/5 px-4 py-2.5 rounded-xl">
            <Building2 className="w-3.5 h-3.5 text-orange-500" />
            <span>{selectedOrg.name} Hub</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {!isHeaderVisible && (
          <button 
            onClick={() => setIsHeaderVisible(true)}
            className="absolute top-4 right-10 px-5 py-3 bg-white/90 backdrop-blur-md text-gray-500 hover:text-orange-500 text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-xl z-[100] transition-all flex items-center gap-3 border border-black/5 hover:scale-105"
          >
            <ChevronDown className="w-4 h-4" />
            View workspace
          </button>
        )}
        <AnimatePresence mode="wait">
          {activeView === 'folders' && (
            <motion.div
              key="folders"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <FoldersView 
                user={user}
                profile={profile}
                org={selectedOrg} 
                selectedDivisionId={selectedDivisionId}
                setSelectedDivisionId={setSelectedDivisionId}
                selectedTaskId={selectedTaskId}
                onNavigateToTask={handleNavigateToTask}
                isFocusMode={isFocusMode}
                setIsFocusMode={setIsFocusMode}
              />
            </motion.div>
          )}
          {activeView === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <ChatView 
                user={user} 
                profile={profile} 
                org={selectedOrg} 
                divisionId={selectedDivisionId || undefined}
                onNavigateToTask={handleNavigateToTask} 
              />
            </motion.div>
          )}
          {activeView === 'team-chat' && (
            <motion.div
              key="team-chat"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <ChatView 
                user={user} 
                profile={profile} 
                org={selectedOrg} 
                divisionId={undefined}
                onNavigateToTask={handleNavigateToTask} 
              />
            </motion.div>
          )}
          {activeView === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <DashboardView user={user} profile={profile} org={selectedOrg} />
            </motion.div>
          )}
          {activeView === 'users' && profile?.role === 'superadmin' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <UsersView currentProfile={profile} />
            </motion.div>
          )}
          {activeView === 'space-members' && selectedOrg && (
            <motion.div
              key="space-members"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <SpaceMembersView user={user} profile={profile} org={selectedOrg} />
            </motion.div>
          )}
          {activeView === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <SettingsView user={user} profile={profile} org={selectedOrg} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
