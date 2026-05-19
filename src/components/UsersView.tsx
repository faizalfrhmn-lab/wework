import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Shield, User, Mail, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { getAllUsers, updateUserProfile } from '../services/authService';

export default function UsersView() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
      setMessage({ type: 'success', text: `User role updated to ${newRole}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update user role' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="p-12 max-w-6xl mx-auto space-y-12 relative">
      <div className="space-y-2">
        <h1 className="text-5xl font-black tracking-tighter text-black uppercase">Users List</h1>
        <p className="text-gray-400 font-medium tracking-tight">Full directory of registered team members. Only Superadmins can change roles.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm space-y-6 hover:shadow-xl hover:shadow-black/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gray-50 border border-black/5 overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || user.email}`} alt="" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate text-black">{user.displayName || 'Anonymous'}</h3>
                  <div className="flex items-center gap-1.5">
                    {user.role === 'superadmin' ? (
                      <Shield className="w-3.5 h-3.5 text-orange-500" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${user.role === 'superadmin' ? 'text-orange-500' : 'text-gray-400'}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5 px-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Change Role</label>
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                    className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 cursor-pointer transition-all"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div className="space-y-3 pt-6 border-t border-black/5">
                <div className="flex items-center gap-3 text-gray-500">
                  <Mail className="w-4 h-4 text-gray-300" />
                  <span className="text-sm font-medium truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500">
                  <Calendar className="w-4 h-4 text-gray-300" />
                  <span className="text-sm font-medium">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
