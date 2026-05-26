import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserPlus, 
  ShieldAlert, 
  Trash2, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  X,
  Shield,
  Clock,
  UserCheck
} from 'lucide-react';
import { Organization, UserProfile, AppUser } from '../types';
import { subscribeToUsersByIds, getAllUsers } from '../services/authService';
import { updateOrganization } from '../services/orgService';
import Modal from './Modal';

interface SpaceMembersViewProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
}

export default function SpaceMembersView({ user, profile, org }: SpaceMembersViewProps) {
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isManager = profile?.role === 'superadmin' || profile?.role === 'manager' || org.managerId === user.uid;

  // Reactively subscribe to the profiles of the active space membership list
  useEffect(() => {
    setLoading(true);
    const unsubMembers = subscribeToUsersByIds(org.members || [], (profiles) => {
      setMemberProfiles(profiles);
      setLoading(false);
    });

    return unsubMembers;
  }, [org.members]);

  // Load active system users for adding new members
  useEffect(() => {
    if (isAddModalOpen) {
      const unsubAll = getAllUsers((users) => {
        setAllSystemUsers(users);
      });
      return unsubAll;
    }
  }, [isAddModalOpen]);

  // Show temporary messages
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Add a user to space
  const handleAddMember = async (targetUserId: string, targetName: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const updatedMembers = Array.from(new Set([...(org.members || []), targetUserId]));
      await updateOrganization(org.id, { members: updatedMembers });
      showFeedback('success', `Berhasil menambahkan ${targetName} ke Space`);
    } catch (err: any) {
      showFeedback('error', `Gagal menambahkan anggota: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Remove a user from space
  const handleRemoveMember = async () => {
    if (!userToRemove || isProcessing) return;
    setIsProcessing(true);
    try {
      const updatedMembers = (org.members || []).filter(id => id !== userToRemove.id);
      await updateOrganization(org.id, { members: updatedMembers });
      showFeedback('success', `Akses ${userToRemove.displayName || userToRemove.email} berhasil dicabut`);
      setUserToRemove(null);
    } catch (err: any) {
      showFeedback('error', `Gagal mencabut akses: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter current space members
  const filteredMembers = memberProfiles.filter(m => {
    const q = searchQuery.toLowerCase();
    return (m.displayName || '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  // Filter unregistered users to display in Add Modal
  const currentMemberIds = org.members || [];
  const addableUsers = allSystemUsers.filter(u => {
    // Exclude existing members
    if (currentMemberIds.includes(u.id)) return false;
    
    // Apply search filter
    const q = addSearchQuery.toLowerCase();
    return (u.displayName || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="h-full overflow-y-auto p-6 md:p-12 bg-[#FAFAFA] relative">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        
        {/* Toast Notification */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -20, x: '-50%' }}
              className={`fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm z-[200] ${
                feedback.type === 'success' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-500">
              <Building2 className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">{org.name}</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-black uppercase font-sans">Space Members</h1>
            <p className="text-gray-400 font-medium tracking-tight text-sm">
              Manage team members who can access lists, divisions, chatrooms, and libraries in this space.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {isManager && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-3.5 bg-black text-white hover:bg-orange-500 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2.5 shadow-lg active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            )}
          </div>
        </div>

        {/* Search controls */}
        <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-[2rem] border border-black/5 shadow-sm">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cari anggota space dengan nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black pr-10"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          
          <div className="hidden sm:flex items-center gap-2 bg-gray-50 px-5 py-3.5 rounded-2xl select-none">
            <Users className="w-4 h-4 text-orange-500" />
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
              Total {filteredMembers.length} Anggota
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-10 h-10 border-4 border-gray-100 border-t-orange-500 rounded-full"
            />
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] border border-black/5 overflow-hidden shadow-sm">
            {filteredMembers.length === 0 ? (
              <div className="py-20 text-center bg-white">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-gray-400">Tidak ada anggota yang cocok dengan pencarian.</p>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/[0.03] bg-gray-50/50">
                      <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Profile</th>
                      <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Email</th>
                      <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Role & Access</th>
                      <th className="px-8 py-4.5 text-[10px] font-black uppercase tracking-wider text-gray-400">Status</th>
                      {isManager && <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-gray-400 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.02]">
                    {filteredMembers.map((member) => {
                      const isOwner = member.id === org.managerId;
                      const isCurrentUser = member.id === user.uid;
                      
                      return (
                        <tr key={member.id} className="hover:bg-gray-50/40 transition-colors group">
                          {/* Profile Column */}
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl border border-black/5 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                                {member.photoURL ? (
                                  <img 
                                    src={member.photoURL} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer" 
                                  />
                                ) : (
                                  <img 
                                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${member.displayName || member.email}`} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                              <span className="font-bold text-xs text-gray-900 group-hover:text-orange-500 transition-colors flex items-center gap-2">
                                {member.displayName || 'No Name'}
                                {isCurrentUser && (
                                  <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
                                    Anda
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Email Column */}
                          <td className="px-6 py-5">
                            <span className="text-xs font-semibold text-gray-500 font-mono">
                              {member.email}
                            </span>
                          </td>

                          {/* Role Column */}
                          <td className="px-6 py-5">
                            {isOwner ? (
                              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider bg-orange-500 text-white px-3 py-1.5 rounded-xl shadow-md shadow-orange-500/10">
                                <Shield className="w-3 h-3" />
                                Space Creator
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-3 py-1.5 rounded-xl">
                                <UserCheck className="w-3 h-3 text-orange-500" />
                                {member.role || 'Staff'}
                              </span>
                            )}
                          </td>

                          {/* Status Column */}
                          <td className="px-8 py-5">
                            <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-green-600 bg-green-50 px-2.5 py-1.5 rounded-xl select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Aktif di Space
                            </span>
                          </td>

                          {/* Action Column */}
                          {isManager && (
                            <td className="px-6 py-5 text-right">
                              {!isOwner ? (
                                <button
                                  onClick={() => setUserToRemove(member)}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-red-100"
                                  title="Cabut akses"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Keluarkan
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold uppercase text-gray-300 pointer-events-none italic pr-4">
                                  Owner
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddSearchQuery('');
        }}
        title="Add Space Members"
      >
        <div className="space-y-6">
          <p className="text-sm font-medium text-gray-500 leading-relaxed">
            Pilih pengguna terdaftar dari platform untuk diberikan akses penuh ke Space <span className="font-bold text-black font-sans uppercase">"{org.name}"</span>.
          </p>

          <div className="relative">
            <input
              type="text"
              placeholder="Cari user sistem dengan nama atau email..."
              value={addSearchQuery}
              onChange={(e) => setAddSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black pr-10"
            />
            <Search className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-2xl border border-black/5 divide-y divide-black/5 no-scrollbar bg-white">
            {addableUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 font-bold text-xs">
                Tidak ada pengguna lain terdaftar, atau seluruh user sudah masuk Space ini.
              </div>
            ) : (
              addableUsers.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-black/5 overflow-hidden flex items-center justify-center shrink-0">
                      {item.photoURL ? (
                        <img src={item.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xs">
                          {item.displayName ? item.displayName[0].toUpperCase() : item.email[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-black truncate">{item.displayName || 'No Name'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddMember(item.id, item.displayName || item.email)}
                    disabled={isProcessing}
                    className="px-3.5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md transform active:scale-95 shrink-0"
                  >
                    Tambah
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(false)}
            className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all text-center"
          >
            Selesai
          </button>
        </div>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={userToRemove !== null}
        onClose={() => setUserToRemove(null)}
        title="Cabut Akses Anggota"
      >
        <div className="space-y-6 text-center pb-2">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100/40">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <h3 className="text-lg font-black text-gray-950 uppercase tracking-tighter">Cabut Akses Pengguna?</h3>
          <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-sm mx-auto">
            Apakah Anda yakin ingin mengeluarkan <span className="font-extrabold text-slate-900">"{userToRemove?.displayName || userToRemove?.email}"</span> dari Space ini? Mereka tidak akan lagi dapat melihat percakapan, divisi, atau data KPI di Space ini.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={() => setUserToRemove(null)}
              disabled={isProcessing}
              className="py-4 border border-gray-100 font-bold text-xs uppercase tracking-widest text-gray-400 hover:text-black rounded-2xl bg-gray-50/50 hover:bg-gray-50 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleRemoveMember}
              disabled={isProcessing}
              className="py-4 bg-red-500 text-white font-bold text-xs uppercase tracking-widest rounded-2xl hover:bg-red-600 transition-all cursor-pointer shadow-lg shadow-red-500/10 flex items-center justify-center gap-1 disabled:opacity-50"
            >
              Ya, Keluarkan
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
