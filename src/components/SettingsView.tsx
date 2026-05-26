import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Shield, 
  DollarSign, 
  Save, 
  Camera,
  CheckCircle2,
  AlertCircle,
  Zap,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { Organization, UserProfile, AppUser } from '../types';
import { subscribeToUsersByIds, updateUserProfile, updatePassword } from '../services/authService';
import { updateOrganization, subscribeToFolders } from '../services/orgService';
import { createNotification } from '../services/notificationService';

interface SettingsViewProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
}

export default function SettingsView({ user, profile, org }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'finance' | 'developer'>('profile');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Password Update State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Profile Form
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsUpdatingPassword(true);
    setMessage(null);
    try {
      await updatePassword(newPassword);
      setMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update password' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Role Management
  const isSuperAdmin = profile?.role === 'superadmin';
  const isManager = profile?.role === 'manager' || isSuperAdmin || org.managerId === user.uid;

  useEffect(() => {
    if (isSuperAdmin) {
      const unsubUsers = subscribeToUsersByIds(org.members, setAllUsers);
      const unsubFolders = subscribeToFolders(org.id, user.uid, setDivisions, true);
      return () => {
        unsubUsers();
        unsubFolders();
      };
    } else if (isManager) {
      const unsubFolders = subscribeToFolders(org.id, user.uid, setDivisions, false);
      return () => unsubFolders();
    }
  }, [isSuperAdmin, isManager, org.id, org.members, user.uid]);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, { displayName, photoURL });
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async (targetUserId: string, newRole: any) => {
    try {
      await updateUserProfile(targetUserId, { role: newRole });
      setMessage({ type: 'success', text: 'User role updated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update user role' });
    }
  };

  const handleToggleRevenueDiv = async (divId: string) => {
    const currentEnabled = org.settings?.revenueEnabledDivisions || [];
    const newEnabled = currentEnabled.includes(divId)
      ? currentEnabled.filter(id => id !== divId)
      : [...currentEnabled, divId];
    
    try {
      await updateOrganization(org.id, {
        settings: {
          ...org.settings,
          revenueEnabledDivisions: newEnabled,
          revenueEnabledCategories: org.settings?.revenueEnabledCategories || []
        }
      });
      setMessage({ type: 'success', text: 'Settings updated' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
    }
  };

  const handleSimulateNotification = async () => {
    await createNotification(
      user.uid,
      org.id,
      'task_assignment',
      'Simulated Assignment',
      'This is a test notification to verify the system performance.',
      { view: 'folders', divisionId: divisions[0]?.id, taskId: 'test' }
    );
    setMessage({ type: 'success', text: 'Notification simulated!' });
  };

  const orgMembers = allUsers.filter(u => org.members.includes(u.id));

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="p-8 border-b border-black/5 bg-gray-50/50">
        <h2 className="text-3xl font-black tracking-tight text-black mb-1">Settings</h2>
        <p className="text-gray-500 text-sm font-medium">Manage your profile, team roles, and organization preferences.</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-64 border-r border-black/5 p-6 space-y-2 bg-gray-50/30">
          {[
            { id: 'profile', icon: UserIcon, label: 'My Profile' },
            { id: 'roles', icon: Shield, label: 'Role Management', superAdminOnly: true },
            { id: 'finance', icon: DollarSign, label: 'Finance Settings', managerOnly: true },
            { id: 'developer', icon: Zap, label: 'Developer', superAdminOnly: true },
          ].map((tab) => {
            if (tab.managerOnly && !isManager) return null;
            if (tab.superAdminOnly && !isSuperAdmin) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === tab.id 
                    ? 'bg-black text-white shadow-xl shadow-black/10 translate-x-2' 
                    : 'text-gray-500 hover:bg-black/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-10 overflow-y-auto bg-white relative">
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-bold text-sm z-50 ${
                  message.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="max-w-xl space-y-10"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[2.5rem] bg-orange-500 overflow-hidden shadow-2xl shadow-orange-500/20">
                      <img src={photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-[2.5rem]">
                      <Camera className="text-white w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-black">{profile?.displayName}</h3>
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{profile?.role}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Display Name</label>
                    <input 
                      required
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none border border-black/5"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Photo URL</label>
                    <input 
                      type="url"
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none border border-black/5"
                      placeholder="https://..."
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-black text-white px-8 py-4 rounded-2xl font-black hover:bg-orange-500 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>

                <div className="pt-10 border-t border-black/5">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-orange-50 rounded-2xl text-orange-600">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-black">Ganti Password</h3>
                      <p className="text-sm text-gray-400 font-medium">Pastikan password kamu kuat dan unik.</p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdatePassword} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-1">Password Baru</label>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-gray-50 border-none rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-black/5 transition-all"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 bottom-4 p-1 text-gray-300 hover:text-black transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-1">Konfirmasi Password</label>
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-gray-50 border-none rounded-2xl p-5 font-bold outline-none focus:ring-4 focus:ring-black/5 transition-all"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="px-10 py-5 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'roles' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orgMembers.map((m) => (
                  <div key={m.id} className="p-6 bg-gray-50 rounded-[2rem] border border-black/5 flex items-center justify-between group hover:bg-white hover:shadow-xl transition-all">
                    <div className="flex items-center gap-4">
                      <img 
                        src={m.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${m.id}`} 
                        className="w-12 h-12 rounded-2xl" 
                        alt="" 
                      />
                      <div>
                        <p className="font-black text-black">{m.displayName}</p>
                        <p className="text-gray-400 text-xs font-bold">{m.email}</p>
                      </div>
                    </div>
                    <select
                      value={m.role}
                      onChange={(e) => handleUpdateRole(m.id, e.target.value as any)}
                      className="bg-white border border-black/5 rounded-xl px-4 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'finance' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-10"
            >
              <div className="space-y-4">
                <h4 className="text-lg font-black text-black">Enabled Divisions for Revenue</h4>
                <p className="text-gray-500 text-sm font-medium">Select which divisions can input revenue data (closing count and amount) on sub-tasks.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  {divisions.map((div) => (
                    <button
                      key={div.id}
                      onClick={() => handleToggleRevenueDiv(div.id)}
                      className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between font-black text-left ${
                        org.settings?.revenueEnabledDivisions?.includes(div.id)
                          ? 'bg-orange-500 text-white border-transparent shadow-xl shadow-orange-500/20'
                          : 'bg-gray-50 text-gray-600 border-black/5 hover:border-orange-500/20'
                      }`}
                    >
                      <span>{div.name}</span>
                      {org.settings?.revenueEnabledDivisions?.includes(div.id) ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-black/10" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'developer' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-10"
            >
              <div className="bg-orange-50 border border-orange-100 p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl shadow-orange-500/5 group">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center text-orange-500 shadow-sm group-hover:rotate-12 transition-transform">
                    <Zap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900">System Simulation</h3>
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-tight">Debug Tools</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleSimulateNotification}
                    className="px-6 py-3 bg-white text-orange-600 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-orange-500/10 hover:scale-105 active:scale-95 transition-all border border-orange-100"
                  >
                    Simulate Message
                  </button>
                  <button 
                    onClick={async () => {
                      await createNotification(
                        user.uid,
                        org.id,
                        'deadline',
                        'Approaching Deadline',
                        'Urgent: Task "Project Roadmap" is due in 2 hours!',
                        { view: 'folders', divisionId: divisions[0]?.id, taskId: 'test' }
                      );
                      setMessage({ type: 'success', text: 'Deadline simulated!' });
                    }}
                    className="px-6 py-3 bg-white text-red-600 font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-red-500/10 hover:scale-105 active:scale-95 transition-all border border-red-100"
                  >
                    Simulate Deadline
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
