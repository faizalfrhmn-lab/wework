import { supabase } from '../lib/supabase';
import { Organization, Folder, LibraryFolder } from '../types';

export const createOrganization = async (name: string, userId: string) => {
  try {
    let finalMembers = [userId];
    try {
      const { data: superadmins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'superadmin');
      if (superadmins) {
        const superadminIds = superadmins.map(s => s.id);
        finalMembers = Array.from(new Set([...finalMembers, ...superadminIds]));
      }
    } catch (e) {
      console.error('Error adding superadmins to organization members:', e);
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        managerId: userId,
        members: finalMembers,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Create organization error:', error);
  }
};

export const subscribeToOrganizations = (userId: string, callback: (orgs: Organization[]) => void, isAdmin: boolean = false) => {
  const fetchOrgs = async () => {
    let query = supabase
      .from('organizations')
      .select('*');
    if (!isAdmin) {
      query = query.contains('members', [userId]);
    }
    const { data } = await query;
    if (data) callback(data as Organization[]);
  };

  fetchOrgs();

  const channelId = `organizations_changes_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => {
      fetchOrgs();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const createFolder = async (orgId: string, name: string, description: string, members: string[]) => {
  try {
    let finalMembers = members;
    try {
      const { data: superadmins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'superadmin');
      if (superadmins) {
        const superadminIds = superadmins.map(s => s.id);
        finalMembers = Array.from(new Set([...members, ...superadminIds]));
      }
    } catch (e) {
      console.error('Error adding superadmins to folder members:', e);
    }

    const { data, error } = await supabase
      .from('folders')
      .insert({
        organizationId: orgId,
        members: finalMembers,
        name,
        description,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Create folder error:', error);
    throw error;
  }
};

export const subscribeToFolders = (orgId: string, userId: string, callback: (folders: Folder[]) => void, isAdmin: boolean = false) => {
  const fetchFolders = async () => {
    let query = supabase
      .from('folders')
      .select('*')
      .eq('organizationId', orgId);
    const { data } = await query;
    if (data) callback(data as Folder[]);
  };

  fetchFolders();

  const channelId = `folders_changes_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'folders' }, () => {
      fetchFolders();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const createLibraryFolder = async (orgId: string, divisionId: string, name: string, members: string[], parentId: string | null = null) => {
  try {
    let finalMembers = members;
    try {
      const { data: superadmins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'superadmin');
      if (superadmins) {
        const superadminIds = superadmins.map(s => s.id);
        finalMembers = Array.from(new Set([...members, ...superadminIds]));
      }
    } catch (e) {
      console.error('Error adding superadmins to library folder members:', e);
    }

    const { data, error } = await supabase
      .from('library_folders')
      .insert({
        organizationId: orgId,
        divisionId,
        name,
        members: finalMembers,
        parentId,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Create library folder error:', error);
  }
};

export const subscribeToLibraryFolders = (divisionId: string, userId: string, callback: (folders: LibraryFolder[]) => void, isAdmin: boolean = false) => {
  const fetchFolders = async () => {
    let query = supabase
      .from('library_folders')
      .select('*')
      .eq('divisionId', divisionId);
    const { data } = await query;
    if (data) callback(data as LibraryFolder[]);
  };

  fetchFolders();

  const channelId = `library_folders_changes_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'library_folders' }, () => {
      fetchFolders();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateOrganization = async (orgId: string, data: any) => {
  const { error } = await supabase
    .from('organizations')
    .update(data)
    .eq('id', orgId);
  if (error) throw error;
};

export const deleteOrganization = async (orgId: string) => {
  try {
    console.log('--- STARTING ORG DELETE ---', orgId);
    
    // 1. Hapus semua data yang mungkin merujuk ke Org ini secara paralel agar lebih cepat
    const tables = [
      'messages', 
      'subtasks', 
      'task_links', 
      'tasks', 
      'library_folders', 
      'folders', 
      'notifications',
      'organization_members',
      'org_members' 
    ];

    await Promise.all(tables.map(async (table) => {
      try {
        // Coba hapus dengan kedua kolom rujukan yang mungkin
        await Promise.all([
          supabase.from(table).delete().eq('organizationId', orgId),
          supabase.from(table).delete().eq('orgId', orgId)
        ]);
      } catch (e) {
        // Abaikan jika tabel tidak ada atau error izin pada tabel tertentu
      }
    }));
    
    // 2. Baru hapus organisasi utamanya
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);
      
    if (error) throw error;
    console.log('--- ORG DELETE SUCCESS ---');
  } catch (error: any) {
    console.error('Delete organization error:', error);
    throw new Error(error.message || 'Gagal menghapus Space. Pastikan Anda punya izin (RLS) di Supabase.');
  }
};

export const deleteFolder = async (folderId: string) => {
  try {
    console.log('--- STARTING DIVISION DELETE ---', folderId);
    
    // 1. Temukan semua task di folder ini untuk menghapus subtasknya
    const { data: tasks } = await supabase.from('tasks').select('id').eq('folderId', folderId);
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id);
      await supabase.from('subtasks').delete().in('taskId', taskIds);
    }

    // 2. Hapus data terkait lainnya secara paralel
    const tables = [
      'messages',
      'task_links',
      'tasks',
      'library_folders',
      'folder_members'
    ];

    await Promise.all(tables.map(async (table) => {
      try {
        await Promise.all([
          supabase.from(table).delete().eq('divisionId', folderId),
          supabase.from(table).delete().eq('folderId', folderId)
        ]);
      } catch (e) {
        // Abaikan
      }
    }));
    
    // 3. Hapus folder utamanya
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);
      
    if (error) throw error;
    console.log('--- DIVISION DELETE SUCCESS ---');
  } catch (error: any) {
    console.error('Delete folder error:', error);
    throw new Error(error.message || 'Gagal menghapus Divisi. Cek batasan database.');
  }
};

export const updateFolder = async (folderId: string, name: string) => {
  const { error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', folderId);
  if (error) throw error;
};

export const updateLibraryFolder = async (folderId: string, name: string) => {
  const { error } = await supabase
    .from('library_folders')
    .update({ name })
    .eq('id', folderId);
  if (error) throw error;
};

export const updateTaskLink = async (linkId: string, label: string, url: string) => {
  const { error } = await supabase
    .from('task_links')
    .update({ label, url })
    .eq('id', linkId);
  if (error) throw error;
};

export const deleteLibraryFolder = async (folderId: string) => {
  try {
    const { error } = await supabase
      .from('library_folders')
      .delete()
      .eq('id', folderId);
    if (error) throw error;
  } catch (error) {
    console.error('Delete library folder error:', error);
    throw error;
  }
};

export const ensureSuperadminMemberships = async (superadminId?: string) => {
  try {
    console.log('--- RUNNING ALL-SUPERADMINS MEMBERSHIP SYNC ---');
    // 1. Get all superadmins in the system
    const { data: superadmins, error: usersErr } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'superadmin');

    if (usersErr) {
      console.error('Error fetching list of superadmins:', usersErr);
    }

    // Combine list of superadmins from database, plus any known superadminId
    const superadminIdsSet = new Set<string>();
    if (superadmins) {
      superadmins.forEach((s) => superadminIdsSet.add(s.id));
    }
    if (superadminId) {
      superadminIdsSet.add(superadminId);
    }

    const allSuperadmins = Array.from(superadminIdsSet);
    if (allSuperadmins.length === 0) {
      console.log('No superadmins found to sync.');
      return;
    }

    console.log('Superadmins to enroll in all entities:', allSuperadmins);

    // 2. Organizations
    try {
      const { data: orgs } = await supabase.from('organizations').select('id, members');
      if (orgs) {
        for (const org of orgs) {
          const members = Array.isArray(org.members) ? org.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('organizations')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', org.id);
            console.log(`Updated organization ${org.id} members`);
          }
        }
      }
    } catch (e) {
      console.error('organizations sync error:', e);
    }

    // 3. Folders
    try {
      const { data: folders } = await supabase.from('folders').select('id, members');
      if (folders) {
        for (const folder of folders) {
          const members = Array.isArray(folder.members) ? folder.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('folders')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', folder.id);
            console.log(`Updated folder ${folder.id} members`);
          }
        }
      }
    } catch (e) {
      console.error('folders sync error:', e);
    }

    // 4. Library folders
    try {
      const { data: libFolders } = await supabase.from('library_folders').select('id, members');
      if (libFolders) {
        for (const lf of libFolders) {
          const members = Array.isArray(lf.members) ? lf.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('library_folders')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', lf.id);
          }
        }
      }
    } catch (e) {
      console.error('library_folders sync error:', e);
    }

    // 5. Tasks
    try {
      const { data: tasks } = await supabase.from('tasks').select('id, members');
      if (tasks) {
        for (const task of tasks) {
          const members = Array.isArray(task.members) ? task.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('tasks')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', task.id);
          }
        }
      }
    } catch (e) {
      console.error('tasks sync error:', e);
    }

    // 6. Subtasks
    try {
      const { data: subtasks } = await supabase.from('subtasks').select('id, members');
      if (subtasks) {
        for (const subtask of subtasks) {
          const members = Array.isArray(subtask.members) ? subtask.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('subtasks')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', subtask.id);
          }
        }
      }
    } catch (e) {
      console.error('subtasks sync error:', e);
    }

    // 7. Task Links
    try {
      const { data: taskLinks } = await supabase.from('task_links').select('id, members');
      if (taskLinks) {
        for (const tl of taskLinks) {
          const members = Array.isArray(tl.members) ? tl.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('task_links')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', tl.id);
          }
        }
      }
    } catch (e) {
      console.error('task_links sync error:', e);
    }

    // 8. Messages
    try {
      const { data: messages } = await supabase.from('messages').select('id, members');
      if (messages) {
        for (const msg of messages) {
          const members = Array.isArray(msg.members) ? msg.members : [];
          const missing = allSuperadmins.filter((id) => !members.includes(id));
          if (missing.length > 0) {
            await supabase.from('messages')
              .update({ members: Array.from(new Set([...members, ...allSuperadmins])) })
              .eq('id', msg.id);
          }
        }
      }
    } catch (e) {
      console.error('messages sync error:', e);
    }

    console.log('--- ALL-SUPERADMINS MEMBERSHIP SYNC COMPLETED ---');
  } catch (error) {
    console.error('Error ensuring superadmin memberships:', error);
  }
};

