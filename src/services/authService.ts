import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { ensureSuperadminMemberships } from './orgService';

export const signUp = async (email: string, password: string, fullName: string) => {
  try {
    // Attempt standard Supabase Auth Sign Up
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authErr) {
      // Check if error is related to user already exists in Supabase Auth
      const isMsgExists = authErr.message?.toLowerCase().includes('already') || 
                          authErr.message?.toLowerCase().includes('exist') || 
                          authErr.status === 422;
      
      if (isMsgExists) {
        // Since they exist in Supabase Auth, check if their profile exists in public.users table
        const { data: existingProfile } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (existingProfile) {
          // Profile exists! They are already fully registered in the system
          throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau masuk.');
        } else {
          // Profile does NOT exist (meaning they were deleted by Superadmin!).
          // Let's sign them in with the password they provided!
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (signInErr) {
            throw new Error('Email Anda sudah terdaftar di sistem otentikasi. Silakan masuk menggunakan kata sandi Anda sebelumnya, ATAU klik opsi "Lupa Password" di layar masuk untuk menyetel ulang kata sandi baru Anda.');
          }

          if (signInData?.user) {
            // Success! Recreate user profile from scratch since they were deleted
            const isSuper = email === 'dininurulkhairina@gmail.com';
            const newProfile = {
              id: signInData.user.id,
              email,
              displayName: fullName || email,
              role: isSuper ? 'superadmin' : 'staff',
              createdAt: new Date().toISOString()
            };
            const { error: insertError } = await supabase.from('users').insert(newProfile);
            if (insertError) throw insertError;
            if (isSuper) {
              await ensureSuperadminMemberships(signInData.user.id);
            }
            return signInData;
          }
        }
      }
      throw authErr;
    }

    // Auth Sign Up succeeded! Let's check if there is an existing profile pre-created by the Admin (with a random UUID)
    if (authData?.user) {
      const { data: preCreatedProfile } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (preCreatedProfile) {
        // An Admin pre-created this profile. We update the ID to the correct authenticated ID, preserving their name/role/data!
        const { error: updateError } = await supabase
          .from('users')
          .update({
            id: authData.user.id,
            displayName: fullName || preCreatedProfile.displayName || email,
            createdAt: new Date().toISOString()
          })
          .eq('id', preCreatedProfile.id); // Update by previous temp id
        
        if (updateError) {
          console.error('Error updating pre-created user profile:', updateError);
        }
      } else {
        // Create a completely new user profile
        const isSuper = email === 'dininurulkhairina@gmail.com';
        const newProfile = {
          id: authData.user.id,
          email,
          displayName: fullName || email,
          role: isSuper ? 'superadmin' : 'staff',
          createdAt: new Date().toISOString()
        };
        const { error: insertError } = await supabase.from('users').insert(newProfile);
        if (insertError) {
          console.error('Error inserting initial profile:', insertError);
        }
        if (isSuper) {
          await ensureSuperadminMemberships(authData.user.id);
        }
      }
    }
    return authData;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    // Attempt normal Supabase Auth login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw error;
    }

    if (data?.user) {
      localStorage.removeItem('local_auth_user');

      // Check if their profile exists in public users table
      const { data: userProfile, error: profileErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      // If they don't have a profile in the public table (deleted by Superadmin), 
      // but they signed in successfully (authenticated!), we automatically recreate their profile!
      // This is a beautiful automatic recovery: they start from scratch (role: staff)
      if (!userProfile) {
        const isSuper = email === 'dininurulkhairina@gmail.com';
        const newProfile = {
          id: data.user.id,
          email,
          displayName: data.user.user_metadata?.full_name || email,
          role: isSuper ? 'superadmin' : 'staff',
          createdAt: new Date().toISOString()
        };
        const { error: insertError } = await supabase.from('users').insert(newProfile);
        if (insertError) {
          console.error('Error auto-recreating deleted profile:', insertError);
        }
        if (isSuper) {
          await ensureSuperadminMemberships(data.user.id);
        }
      }
      return data;
    }
    return data;
  } catch (error: any) {
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

export const logout = async () => {
  localStorage.removeItem('local_auth_user');
  await supabase.auth.signOut();
  window.location.reload();
};

export const sendPasswordReset = async (email: string) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  } catch (error) {
    console.error('Reset password error:', error);
    throw error;
  }
};

export const updatePassword = async (newPassword: string) => {
  try {
    const localUserStr = localStorage.getItem('local_auth_user');
    
    if (localUserStr) {
      const localUser = JSON.parse(localUserStr);
      localUser.tempPassword = newPassword;
      localStorage.setItem('local_auth_user', JSON.stringify(localUser));
    } else {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
    }
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
        // Force cleanup of Supabase auth tokens
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
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
  // Check local override first
  const localUserStr = localStorage.getItem('local_auth_user');
  if (localUserStr) {
    try {
      const localUser = JSON.parse(localUserStr);
      if (localUser.id === userId || localUser.uid === userId) {
        callback(localUser as UserProfile);
        return () => {};
      }
    } catch {
      // Ignored
    }
  }

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
      // Create profile and recover gracefully for any authenticated user whose profile was deleted from the database
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user && userData.user.id === userId) {
          const isSuper = userData.user.email === 'dininurulkhairina@gmail.com';
          const newProfile = {
            id: userId,
            email: userData.user.email,
            displayName: userData.user.user_metadata?.full_name || userData.user.email || 'Workspace Member',
            photoURL: userData.user.user_metadata?.avatar_url || '',
            role: isSuper ? 'superadmin' : 'staff',
            createdAt: new Date().toISOString()
          };
          const { error: insertError } = await supabase.from('users').insert(newProfile);
          if (!insertError) {
            if (isSuper) {
              ensureSuperadminMemberships(userId);
            }
            callback(newProfile as UserProfile);
            return;
          } else {
            console.error('Failed to auto-recreate missing profile:', insertError);
          }
        }
        
        // Non-authenticated or failed recovery
        console.warn('User profile has been deleted by Superadmin. Forcing logout.');
        supabase.auth.signOut().catch(() => {});
        localStorage.removeItem('local_auth_user');
        callback(null);
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
    const { tempPassword, ...cleanData } = data as any;
    if (Object.keys(cleanData).length > 0) {
      const { error } = await supabase
        .from('users')
        .update(cleanData)
        .eq('id', userId);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Update profile error:', error);
  }
};

export const adminCreateUser = async (profile: Partial<UserProfile> & { email: string }) => {
  try {
    const id = crypto.randomUUID();
    const { tempPassword, ...cleanProfile } = profile as any;
    
    const { error } = await supabase
      .from('users')
      .insert({
        id,
        ...cleanProfile,
        createdAt: new Date().toISOString(),
        role: profile.role || 'staff'
      });
    if (error) throw error;
    return id;
  } catch (error) {
    console.error('Create profile error:', error);
    throw error;
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
