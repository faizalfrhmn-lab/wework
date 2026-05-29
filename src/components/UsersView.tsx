import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, User, Mail, Calendar, CheckCircle2, AlertCircle, Trash2, Key, Lock, MoreVertical, Camera } from 'lucide-react';
import { UserProfile } from '../types';
import { getAllUsers, updateUserProfile, deleteUserProfile } from '../services/authService';
import { ensureSuperadminMemberships } from '../services/orgService';
import Modal from './Modal';

interface UsersViewProps {
  currentProfile?: UserProfile | null;
}

export default function UsersView({ currentProfile }: UsersViewProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newPasswords, setNewPasswords] = useState<{[userId: string]: string}>({});
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<{[userId: string]: boolean}>({});
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for Profile detail editor Modal
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUserForEdit) {
      setEditDisplayName(selectedUserForEdit.displayName || '');
      setEditEmail(selectedUserForEdit.email || '');
      setEditPhotoURL(selectedUserForEdit.photoURL || '');
      setEditPassword(selectedUserForEdit.tempPassword || '');
      setFileError(null);
    }
  }, [selectedUserForEdit]);

  useEffect(() => {
    const unsub = getAllUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleUpdateRole = async (targetUserId: string, newRole: any) => {
    try {
      await updateUserProfile(targetUserId, { role: newRole });
      if (newRole === 'superadmin') {
        await ensureSuperadminMemberships(targetUserId);
      }
      setMessage({ type: 'success', text: `User role updated to ${newRole}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update user role' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleUpdatePassword = async (targetUserId: string, name: string) => {
    const newPass = newPasswords[targetUserId]?.trim();
    if (!newPass) return;

    setIsUpdatingPassword(prev => ({ ...prev, [targetUserId]: true }));
    try {
      await updateUserProfile(targetUserId, { tempPassword: newPass });
      setMessage({ type: 'success', text: `Password untuk ${name} berhasil diubah menjadi: ${newPass}` });
      setNewPasswords(prev => ({ ...prev, [targetUserId]: '' }));
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal mengubah password' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsUpdatingPassword(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  const handleDeleteClick = (targetUser: UserProfile) => {
    if (currentProfile && targetUser.id === currentProfile.id) {
      setMessage({ type: 'error', text: 'Anda tidak dapat menghapus akun Anda sendiri!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setUserToDelete(targetUser);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await deleteUserProfile(userToDelete.id);
      setMessage({ type: 'success', text: `User ${userToDelete.displayName || userToDelete.email} deleted successfully` });
      setUserToDelete(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Delete error:', err);
      setMessage({ type: 'error', text: 'Gagal menghapus user, periksa log atau hubungi sistem.' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 1 MB (1,048,576 bytes)
    const maxSizeBytes = 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setFileError('Ukuran file terlalu besar! Maksimal ukuran file foto adalah 1 MB.');
      return;
    }

    setFileError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setEditPhotoURL(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!selectedUserForEdit) return;
    setIsSavingProfile(true);
    try {
      const updatedData: Partial<UserProfile> = {
        displayName: editDisplayName.trim(),
        email: editEmail.trim(),
        photoURL: editPhotoURL.trim(),
        tempPassword: editPassword.trim()
      };
      await updateUserProfile(selectedUserForEdit.id, updatedData);
      setMessage({ type: 'success', text: `Profil ${editDisplayName || editEmail} berhasil diperbarui.` });
      setSelectedUserForEdit(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setMessage({ type: 'error', text: 'Gagal memperbarui profil.' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Search query filter state
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    const name = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  return (
    <div className="h-full overflow-y-auto p-6 md:p-12 bg-[#FAFAFA] relative">
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-black uppercase font-sans">User Directory</h1>
            <p className="text-gray-400 font-medium tracking-tight text-sm">Full list of registered workspace members. Only Superadmins can update attributes.</p>
          </div>
          
          {/* Search bar & statistics */}
          <div className="relative w-full md:w-80 shrink-0">
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-black/5 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black pr-10 shadow-sm"
            />
            <Users className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm z-50 ${
              message.type === 'success' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-10 h-10 border-4 border-gray-100 border-t-black rounded-full"
            />
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border border-black/5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5 bg-[#F9FAFB]/60 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    <th className="py-5 px-6 font-bold">Anggota</th>
                    <th className="py-5 px-6 font-bold">Peran (Role)</th>
                    <th className="py-5 px-6 font-bold">Bergabung</th>
                    <th className="py-5 px-6 font-bold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-gray-400 font-bold text-xs">
                        Tidak ada anggota yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                        {/* Member identity */}
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-black/5 overflow-hidden flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 max-w-[180px]">
                              <p className="font-bold text-sm text-black truncate">{user.displayName || 'No Name'}</p>
                              <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* User Role selector & indicators */}
                        <td className="py-5 px-6">
                          <div className="flex flex-col gap-1.5 max-w-[140px]">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                              className="bg-gray-50 hover:bg-gray-100 border border-black/5 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 cursor-pointer transition-all text-black"
                            >
                              <option value="staff">Staff</option>
                              <option value="manager">Manager</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          </div>
                        </td>

                        {/* Date Joined */}
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-2 text-gray-500">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs font-medium text-gray-600">
                              {new Date(user.createdAt).toLocaleDateString('id-ID', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Actions block */}
                        <td className="py-5 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedUserForEdit(user)}
                              className="p-2 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center border border-black/5"
                              title="Edit Detail Profil"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(user)}
                              className="p-2 bg-red-50 text-red-500 hover:bg-red-100 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center border border-red-100/30"
                              title="Hapus Anggota"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={userToDelete !== null}
        onClose={() => !isDeleting && setUserToDelete(null)}
        title="Hapus Anggota Tim"
      >
        <div className="space-y-6">
          <p className="text-sm font-medium text-gray-500 leading-relaxed">
            Apakah Anda yakin ingin menghapus akun <span className="font-extrabold text-black">{userToDelete?.displayName || userToDelete?.email}</span>? Tindakan ini permanen dan tidak dapat dibatalkan. Semua tugas yang didelegasikan ke mereka akan dilepaskan (assignee dihilangkan).
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => setUserToDelete(null)}
              disabled={isDeleting}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-bold text-xs rounded-2xl transition-all active:scale-95"
            >
              Batal
            </button>
            <button
              onClick={confirmDeleteUser}
              disabled={isDeleting}
              className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs transition-all active:scale-95 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
            >
              {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={selectedUserForEdit !== null}
        onClose={() => !isSavingProfile && setSelectedUserForEdit(null)}
        title="Detail & Edit Profil"
      >
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <div className="relative w-24 h-24 rounded-3xl bg-gray-50 border border-black/5 overflow-hidden flex items-center justify-center group shadow-md">
              {editPhotoURL ? (
                <img src={editPhotoURL} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUserForEdit?.id || 'edit-fallback'}`} alt="Fallback" className="w-full h-full object-cover" />
              )}
              <label 
                htmlFor="edit-avatar-upload" 
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 text-white cursor-pointer transition-opacity text-center p-1"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[9px] font-black uppercase tracking-wider">Ubah Foto</span>
              </label>
            </div>
            <input 
              type="file" 
              id="edit-avatar-upload" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
            <div className="text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Maksimal Ukuran Foto: 1 MB</span>
              {fileError && <p className="text-[10px] text-red-500 font-bold leading-tight">{fileError}</p>}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Nama Lengkap</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ketik nama lengkap..."
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-gray-50 border border-black/5 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black"
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Alamat Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-black/5 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black"
                />
              </div>
            </div>

            {/* Password Override */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-widest text-[#FF7A00]">Override Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ganti password di sini..."
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-black/5 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold font-mono outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-black/5 font-sans">
            <button
              type="button"
              onClick={() => setSelectedUserForEdit(null)}
              disabled={isSavingProfile}
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-bold text-xs rounded-2xl transition-all active:scale-95"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={isSavingProfile || !editEmail.trim() || !!fileError}
              className="flex-1 py-3 px-4 bg-black hover:bg-gray-800 disabled:opacity-50 text-white rounded-2xl font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isSavingProfile ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
