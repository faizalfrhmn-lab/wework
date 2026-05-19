import { supabase } from '../lib/supabase';
import { Organization, Folder, LibraryFolder } from '../types';

export const createOrganization = async (name: string, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name,
        managerId: userId,
        members: [userId],
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

export const subscribeToOrganizations = (userId: string, callback: (orgs: Organization[]) => void) => {
  const fetchOrgs = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .contains('members', [userId]);
    if (data) callback(data as Organization[]);
  };

  fetchOrgs();

  const channel = supabase
    .channel('organizations_changes')
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
    const { data, error } = await supabase
      .from('folders')
      .insert({
        organizationId: orgId,
        members,
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
  }
};

export const subscribeToFolders = (orgId: string, userId: string, callback: (folders: Folder[]) => void) => {
  const fetchFolders = async () => {
    const { data } = await supabase
      .from('folders')
      .select('*')
      .eq('organizationId', orgId)
      .contains('members', [userId]);
    if (data) callback(data as Folder[]);
  };

  fetchFolders();

  const channel = supabase
    .channel('folders_changes')
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
    const { data, error } = await supabase
      .from('library_folders')
      .insert({
        organizationId: orgId,
        divisionId,
        name,
        members,
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

export const subscribeToLibraryFolders = (divisionId: string, userId: string, callback: (folders: LibraryFolder[]) => void) => {
  const fetchFolders = async () => {
    const { data } = await supabase
      .from('library_folders')
      .select('*')
      .eq('divisionId', divisionId)
      .contains('members', [userId]);
    if (data) callback(data as LibraryFolder[]);
  };

  fetchFolders();

  const channel = supabase
    .channel('library_folders_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'library_folders' }, () => {
      fetchFolders();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateOrganization = async (orgId: string, data: Partial<Organization>) => {
  try {
    const { error } = await supabase
      .from('organizations')
      .update(data)
      .eq('id', orgId);
    if (error) throw error;
  } catch (error) {
    console.error('Update organization error:', error);
  }
};
