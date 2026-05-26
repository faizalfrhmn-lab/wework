import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { ensureSuperadminMemberships } from './orgService';

export const signUp = async (email: string, password: string, fullName: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (!error && data?.user) {
      localStorage.removeItem('local_auth_user');
      return data;
    }
    if (error) throw error;
    return data;
  } catch (error: any) {
    console.log('Auth check failed, looking for password override in database...', error.message);
    try {
      const { data: userProfile, error: profileErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (!profileErr && userProfile && userProfile.tempPassword) {
        if (userProfile.tempPassword === password) {
          const mockUser = {
            uid: userProfile.id,
            id: userProfile.id,
            email: userProfile.email,
            displayName: userProfile.displayName,
            photoURL: userProfile.photoURL,
            isLocalSession: true
          };
          localStorage.setItem('local_auth_user', JSON.stringify(mockUser));
          // Success, trigger reload to apply session
          window.location.reload();
          return { user: mockUser };
        }
      }
    } catch (e) {
      console.error('Password override fallback check failed:', e);
    }
    throw error;
  }
};

export const signInWithGoogle = async () => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Auth error:', error);
  }
};

export const logout = async () => {
  localStorage.removeItem('local_auth_user');
  await supabase.auth.signOut();
  window.location.reload();
};

export const updatePassword = async (newPassword: string) => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  } catch (error) {
    console.error('Update password error:', error);
    throw error;
  }
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  // Check local override first
  const localUserStr = localStorage.getItem('local_auth_user');
  if (localUserStr) {
    try {
      const localUser = JSON.parse(localUserStr);
      callback(localUser);
      return () => {};
    } catch {
      localStorage.removeItem('local_auth_user');
    }
  }

  // Get initial session
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.warn('Initial session lookup error:', error.message);
      if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token_not_found') || error.message?.includes('invalid_grant')) {
        supabase.auth.signOut().catch(() => {});
      }
      callback(null);
      return;
    }
    if (session?.user) {
      callback({ ...session.user, uid: session.user.id });
    } else {
      callback(null);
    }
  }).catch((err) => {
    console.error('Session getSession exception:', err);
    supabase.auth.signOut().catch(() => {});
    callback(null);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      callback(null);
    } else if (session?.user) {
      callback({ ...session.user, uid: session.user.id });
    } else {
      callback(null);
    }
  });

  return () => subscription.unsubscribe();
};

export const subscribeToUserProfile = (userId: string, callback: (profile: UserProfile | null) => void) => {
  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      const profile = data as UserProfile;
      // Auto-upgrade if email matches superadmin but role is different
      if (profile.email === 'dininurulkhairina@gmail.com' && profile.role !== 'superadmin') {
        const updatedProfile = { ...profile, role: 'superadmin' as const };
        await supabase.from('users').update({ role: 'superadmin' }).eq('id', userId);
        ensureSuperadminMemberships(userId);
        callback(updatedProfile);
      } else {
        if (profile.role === 'superadmin') {
          ensureSuperadminMemberships(userId);
        }
        callback(profile);
      }
    } else {
      // Create profile if not exist (auto-creation on first fetch)
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user && userData.user.id === userId) {
          const isSuper = userData.user.email === 'dininurulkhairina@gmail.com';
          const newProfile = {
            id: userId,
            email: userData.user.email,
            displayName: userData.user.user_metadata.full_name || userData.user.email,
            photoURL: userData.user.user_metadata.avatar_url,
            role: isSuper ? 'superadmin' : 'staff',
            createdAt: new Date().toISOString()
          };
          const { error: insertError } = await supabase.from('users').insert(newProfile);
          if (!insertError) {
            if (isSuper) {
              ensureSuperadminMemberships(userId);
            }
            callback(newProfile as UserProfile);
          }
        } else {
          callback(null);
        }
      } catch (authErr) {
        console.error('getUser failed inside profile subscription:', authErr);
        callback(null);
      }
    }
  };

  fetchProfile();

  // Listen for changes
  const channelId = `user_profile_${userId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'users', 
      filter: `id=eq.${userId}` 
    }, (payload) => {
      const updatedProfile = payload.new as UserProfile;
      if (updatedProfile && updatedProfile.role === 'superadmin') {
        ensureSuperadminMemberships(userId);
      }
      callback(updatedProfile);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
  try {
    const { error } = await supabase
      .from('users')
      .update(data)
      .eq('id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Update profile error:', error);
  }
};

export const deleteUserProfile = async (userId: string) => {
  try {
    // 1. Clean up notifications first
    try {
      await supabase.from('notifications').delete().eq('userId', userId);
    } catch (e) {
      console.warn('Could not delete notifications for user:', e);
    }

    // 2. Clear assigneeId in tasks
    try {
      await supabase.from('tasks').update({ assigneeId: null }).eq('assigneeId', userId);
    } catch (e) {
      console.warn('Could not clear assigneeId from tasks:', e);
    }

    // 3. Clear managerId in organizations
    try {
      await supabase.from('organizations').update({ managerId: null as any }).eq('managerId', userId);
    } catch (e) {
      console.warn('Could not clear managerId from organizations:', e);
    }

    // 4. Delete messages from this user
    try {
      await supabase.from('messages').delete().eq('senderId', userId);
    } catch (e) {
      console.warn('Could not clean up messages for user:', e);
    }

    // 4.1 Delete membership row references in case tables exist with foreign keys
    const membershipTables = ['org_members', 'organization_members', 'folder_members'];
    for (const table of membershipTables) {
      try {
        await supabase.from(table).delete().eq('userId', userId);
      } catch (e) {}
      try {
        await supabase.from(table).delete().eq('user_id', userId);
      } catch (e) {}
    }

    // 5. Delete the public user profile record
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (error) throw error;
  } catch (error) {
    console.error('Delete profile error:', error);
    throw error;
  }
};

export const getAllUsers = (callback: (users: UserProfile[]) => void) => {
  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('createdAt', { ascending: false });
    if (data) callback(data as UserProfile[]);
  };
  
  fetchUsers();

  const channelId = `all_users_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
      fetchUsers();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToUsersByIds = (userIds: string[], callback: (users: UserProfile[]) => void) => {
  if (userIds.length === 0) {
    callback([]);
    return () => {};
  }

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds);
    if (data) callback(data as UserProfile[]);
  };

  fetchUsers();

  const channelId = `users_by_ids_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
      fetchUsers();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
