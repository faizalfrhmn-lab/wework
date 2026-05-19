import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

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
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Sign in error:', error);
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

export const logout = () => supabase.auth.signOut();

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
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      callback({ ...session.user, uid: session.user.id });
    } else {
      callback(null);
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
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
        callback(updatedProfile);
      } else {
        callback(profile);
      }
    } else {
      // Create profile if not exist (auto-creation on first fetch)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user && userData.user.id === userId) {
        const newProfile = {
          id: userId,
          email: userData.user.email,
          displayName: userData.user.user_metadata.full_name || userData.user.email,
          photoURL: userData.user.user_metadata.avatar_url,
          role: userData.user.email === 'dininurulkhairina@gmail.com' ? 'superadmin' : 'staff',
          createdAt: new Date().toISOString()
        };
        const { error: insertError } = await supabase.from('users').insert(newProfile);
        if (!insertError) callback(newProfile as UserProfile);
      } else {
        callback(null);
      }
    }
  };

  fetchProfile();

  // Listen for changes
  const channel = supabase
    .channel(`user_profile_${userId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'users', 
      filter: `id=eq.${userId}` 
    }, (payload) => {
      callback(payload.new as UserProfile);
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

  const channel = supabase
    .channel('users_by_ids')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
      fetchUsers();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
