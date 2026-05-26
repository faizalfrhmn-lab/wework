/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  FolderIcon, 
  MessageSquare, 
  BarChart3, 
  Plus, 
  LogOut,
  ChevronRight,
  Search,
  CheckCircle2,
  ListTodo,
  Eye,
  EyeOff
} from 'lucide-react';
import { subscribeToAuth, signIn, signUp, logout, subscribeToUserProfile } from './services/authService';
import { subscribeToOrganizations, createOrganization } from './services/orgService';
import { Organization, Folder, UserProfile, AppUser } from './types';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'folders' | 'chat' | 'team-chat' | 'dashboard' | 'settings'>('folders');
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [suggestRegister, setSuggestRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const changeAuthMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthError(null);
    setSuggestRegister(false);
    setShowPassword(false);
  };

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const unsub = subscribeToAuth((u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user) {
      const unsub = subscribeToUserProfile(user.uid, (p) => {
        setProfile(p);
        setLoading(false);
      });
      return unsub;
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const isSuperadmin = profile?.role === 'superadmin';
      const unsub = subscribeToOrganizations(user.uid, (data) => {
        setOrgs(data);
        if (data.length > 0 && !selectedOrgId) {
          setSelectedOrgId(data[0].id);
        }
      }, isSuperadmin);
      return unsub;
    }
  }, [user, selectedOrgId, profile?.role]);

  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);

  const handleDemoLogin = async () => {
    setAuthError(null);
    setIsDemoLoggingIn(true);
    const demoEmail = 'demo@example.com';
    const demoPassword = 'Password123!';
    const demoName = 'Demo User';

    try {
      await signIn(demoEmail, demoPassword);
    } catch (signInErr: any) {
      console.log('Demo sign in failed, attempting auto registration:', signInErr);
      try {
        await signUp(demoEmail, demoPassword, demoName);
        try {
          await signIn(demoEmail, demoPassword);
        } catch (secondSignInErr: any) {
          if (secondSignInErr.message?.includes('Email not confirmed')) {
            throw new Error('Konfirmasi email aktif di akun Supabase Anda. Silakan matikan opsi "Confirm email" di Dashboard Supabase > Authentication > Providers > Email agar Akun Demo dapat langsung digunakan.');
          }
          throw secondSignInErr;
        }
      } catch (signUpErr: any) {
        if (signUpErr.message?.includes('already registered') || signUpErr.message?.includes('User already registered')) {
          setAuthError('Akun demo telah terdaftar namun password tidak cocok. Silakan daftar (Sign Up) dengan email Anda sendiri.');
        } else {
          setAuthError(signUpErr.message || 'Gagal menyiapkan Akun Demo.');
        }
      }
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  const handleInstantRegister = async () => {
    setAuthError(null);
    setIsAuthenticating(true);
    setSuggestRegister(false);
    try {
      const defaultName = email.split('@')[0];
      const fallbackName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
      await signUp(email, password, fallbackName);
      await signIn(email, password);
    } catch (error: any) {
      let message = error.message || 'Auto registration failed';
      if (message.includes('Email not confirmed')) {
        message = 'Registrasi berhasil! Cek email masuk Anda untuk konfirmasi, atau matikan "Confirm email" di Dashboard Supabase.';
      } else if (message.includes('already registered')) {
        message = 'Email ini sudah terdaftar. Silakan ketik password dengan benar atau daftar ulang.';
      }
      setAuthError(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuggestRegister(false);
    setIsAuthenticating(true);

    try {
      if (authMode === 'login') {
        await signIn(email, password);
      } else {
        if (!fullName) throw new Error('Full name is required');
        await signUp(email, password, fullName);
        alert('Cek email kamu untuk konfirmasi, atau matikan "Email Confirmation" di dashboard Supabase agar bisa langsung login.');
        setAuthMode('login');
      }
    } catch (error: any) {
      let message = error.message || 'Authentication failed';
      if (message.includes('Email not confirmed')) {
        message = 'Email belum dikonfirmasi. Cek inbox (atau folder SPAM) email kamu. Untuk mematikan fitur ini, di dashboard Supabase pergi ke: Authentication > Providers > Email, lalu matikan "Confirm email".';
      } else if (message.includes('For security purposes')) {
        message = 'Tunggu sebentar sebelum mencoba lagi (limit keamanan).';
      } else if (message.includes('Invalid login credentials') || message.includes('invalid_credentials')) {
        message = 'Email atau password salah. Pastikan Anda mengetik password dengan benar, atau klik tombol di bawah untuk mendaftar akun baru dengan email ini.';
        setSuggestRegister(true);
      }
      setAuthError(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F5F5]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-4 border-black border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#E4E3E0] p-6 text-[#141414]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-12 rounded-3xl shadow-xl border border-black/5 flex flex-col space-y-8"
        >
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="mb-2">
              <img 
                src="https://uyozhvcgpoapuszczmps.supabase.co/storage/v1/object/public/img/dakrlogowe.png" 
                alt="WoWork Logo" 
                className="h-20 w-auto object-contain mx-auto" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 text-sm">Empowering your team with smart task management and collaboration tools.</p>
              {!isSupabaseConfigured && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 text-xs font-medium">
                  <strong>⚠️ Supabase Belum Terhubung:</strong><br/>
                  Tambah <code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code> di menu <strong>Settings &gt; Secrets</strong>.
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-black outline-none transition-all placeholder:text-gray-300"
                />
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setSuggestRegister(false); }}
                placeholder="email@example.com"
                className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-black outline-none transition-all placeholder:text-gray-300"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setSuggestRegister(false); }}
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-6 pr-12 focus:ring-2 focus:ring-black outline-none transition-all placeholder:text-gray-300"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex flex-col gap-3">
                <span>{authError}</span>
                {suggestRegister && (
                  <button
                    type="button"
                    onClick={handleInstantRegister}
                    className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all text-center text-xs active:scale-95 shadow-md shadow-red-600/10"
                  >
                    Daftar Baru Dengan Email & Password Ini
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating || isDemoLoggingIn}
              className="w-full bg-black text-white py-4 px-6 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isAuthenticating && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />}
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>


          </form>

          <div className="text-center pt-4 border-t border-gray-100">
            <button
              onClick={() => changeAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-sm text-gray-500 font-medium hover:text-black transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const selectedOrg = orgs.find(o => o.id === selectedOrgId);

  return (
    <div className={`flex h-screen font-sans text-slate-900 overflow-hidden transition-colors duration-500 ${isFocusMode ? 'bg-[#0079BF]' : 'bg-[#F5F5F5]'}`}>
      {!isFocusMode && (
        <Sidebar 
          user={user}
          profile={profile}
          orgs={orgs}
          selectedOrgId={selectedOrgId}
          setSelectedOrgId={setSelectedOrgId}
          activeView={activeView}
          setActiveView={setActiveView}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onLogout={logout}
        />
      )}
      
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-500 overflow-hidden ${
        isFocusMode 
          ? 'm-0 rounded-0 border-0 bg-transparent' 
          : 'bg-white md:m-3 md:rounded-[2.5rem] md:shadow-2xl md:border md:border-black/5'
      }`}>
        <MainContent 
          user={user}
          profile={profile}
          selectedOrg={selectedOrg}
          activeView={activeView}
          setActiveView={setActiveView}
          selectedDivisionId={selectedDivisionId}
          setSelectedDivisionId={setSelectedDivisionId}
          isFocusMode={isFocusMode}
          setIsFocusMode={setIsFocusMode}
        />
      </main>
    </div>
  );
}
