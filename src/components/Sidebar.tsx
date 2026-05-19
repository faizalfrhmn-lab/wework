import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  FolderIcon, 
  MessageSquare, 
  BarChart3, 
  LogOut,
  ChevronDown,
  Settings,
  PlusCircle,
  X,
  Menu,
  ChevronRight,
  LayoutGrid,
  Users
} from 'lucide-react';
import { Organization, UserProfile, AppUser } from '../types';
import { createOrganization } from '../services/orgService';
import Modal from './Modal';

interface SidebarProps {
  user: AppUser;
  profile: UserProfile | null;
  orgs: Organization[];
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string) => void;
  activeView: 'folders' | 'chat' | 'team-chat' | 'dashboard' | 'settings';
  setActiveView: (view: any) => void;
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
  onLogout: () => void;
}

export default function Sidebar({ 
  user,
  profile,
  orgs, 
  selectedOrgId, 
  setSelectedOrgId, 
  activeView, 
  setActiveView, 
  isCollapsed,
  setIsCollapsed,
  onLogout 
}: SidebarProps) {
  const [isOrgsCollapsed, setIsOrgsCollapsed] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleCreateOrg = async (e: any) => {
    e.preventDefault();
    if (newOrgName.trim()) {
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

  return (
    <>
    <nav className={`flex flex-col h-full bg-[#111111] text-white/70 shrink-0 transition-all duration-500 ease-in-out border-r border-white/5 ${isCollapsed ? 'w-20' : 'w-72'}`}>
      {/* Header section with Logo and Hamburger */}
      <div className={`p-6 border-b border-white/5 flex items-center justify-between ${isCollapsed ? 'flex-col gap-6' : ''}`}>
        {!isCollapsed ? (
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 group cursor-pointer">
                <LayoutGrid className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
             </div>
             <span className="font-bold text-xl tracking-tight text-white">WeWork</span>
          </div>
        ) : (
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
             <LayoutGrid className="w-5 h-5 text-white" />
          </div>
        )}
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-2.5 hover:bg-white/5 rounded-xl text-white/30 hover:text-white transition-all group ${isCollapsed ? 'mt-auto' : ''}`}
          title={isCollapsed ? "Expand Menu" : "Collapse Menu"}
        >
          <Menu className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* User Info Hook */}
      <div className={`px-6 py-8 border-b border-white/5 flex items-center gap-4 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="w-12 h-12 rounded-full border-2 border-orange-500/20 p-0.5 shrink-0 transition-transform hover:scale-105 cursor-pointer">
          <img 
            src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            alt="" 
            className="w-full h-full rounded-full object-cover shadow-2xl"
            referrerPolicy="no-referrer" 
          />
        </div>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate tracking-tight leading-tight">{profile?.displayName || user.displayName}</p>
            <p className="text-orange-500/80 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">{profile?.role || 'Staff Member'}</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar py-6 space-y-10">
        {/* Organizations Section */}
        <div>
          <div className={`px-6 mb-4 flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between'}`}>
            {!isCollapsed && (
              <button 
                onClick={() => setIsOrgsCollapsed(!isOrgsCollapsed)}
                className="flex items-center gap-2 group/title"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 group-hover:text-white/60 transition-colors">Spaces</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/10 transition-transform duration-300 ${isOrgsCollapsed ? '-rotate-90' : ''}`} />
              </button>
            )}
            {!isCollapsed && (
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="p-1.5 bg-white/5 hover:bg-orange-500 rounded-lg transition-all text-white/50 hover:text-white group/add"
                title="Add Organization"
              >
                <PlusCircle className="w-4 h-4 group-hover/add:scale-110 transition-transform" />
              </button>
            )}
          </div>
          
          <AnimatePresence initial={false}>
            {(!isOrgsCollapsed || isCollapsed) && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-1 overflow-hidden px-3"
              >
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-300 group relative ${
                      selectedOrgId === org.id 
                        ? 'bg-orange-500 text-white shadow-[0_8px_20px_rgba(249,115,22,0.3)]' 
                        : 'text-white/40 hover:bg-white/5 hover:text-white'
                    } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    title={isCollapsed ? org.name : undefined}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                      selectedOrgId === org.id ? 'bg-white/20 rotate-12 scale-110' : 'bg-white/5 group-hover:bg-white/10 group-hover:rotate-6'
                    }`}>
                      <Building2 className="w-4 h-4" />
                    </div>
                    {!isCollapsed && (
                      <>
                        <span className="text-[11px] font-bold tracking-tight truncate flex-1 text-left">{org.name}</span>
                        {selectedOrgId === org.id && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Section */}
        {selectedOrgId && (
          <div>
            {!isCollapsed && (
              <button 
                onClick={() => setIsNavCollapsed(!isNavCollapsed)}
                className="px-6 mb-4 flex items-center gap-2 group/nav-title w-full"
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 group-hover/nav-title:text-white/60 transition-colors">Main Hub</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/10 transition-transform duration-300 ${isNavCollapsed ? '-rotate-90' : ''}`} />
              </button>
            )}
            
            <AnimatePresence initial={false}>
              {(!isNavCollapsed || isCollapsed) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1 overflow-hidden px-3"
                >
                  {[
                    { id: 'folders', icon: FolderIcon, label: 'Divisions' },
                    { id: 'team-chat', icon: MessageSquare, label: 'Chat' },
                    ...(profile?.role === 'superadmin' ? [{ id: 'users', icon: Users, label: 'Users List' }] : []),
                    { id: 'dashboard', icon: BarChart3, label: 'KPI' },
                    { id: 'settings', icon: Settings, label: 'Settings' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveView(item.id as any)}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 ${
                        activeView === item.id 
                          ? 'bg-white text-black shadow-2xl scale-[1.02]' 
                          : 'text-white/30 hover:bg-white/5 hover:text-white'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <item.icon className={`w-5 h-5 shrink-0 transition-transform ${activeView === item.id ? 'scale-110' : ''}`} />
                      {!isCollapsed && <span className="text-[13px] font-bold tracking-tight">{item.label}</span>}
                      {!isCollapsed && activeView === item.id && <ChevronRight className="ml-auto w-4 h-4 text-orange-500" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className={`p-6 border-t border-white/5 ${isCollapsed ? 'px-0' : ''}`}>
        <button 
          onClick={onLogout}
          className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-white/5 text-white/30 hover:bg-black hover:text-red-500 transition-all group font-bold text-[10px] uppercase tracking-[0.2em] border border-transparent hover:border-red-500/30 ${isCollapsed ? 'justify-center gap-0' : ''}`}
          title={isCollapsed ? 'Log Out' : undefined}
        >
          <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform shrink-0" />
          {!isCollapsed && <span>Logout session</span>}
        </button>
      </div>
    </nav>

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
