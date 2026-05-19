import { supabase } from '../lib/supabase';
import { Task, SubTask, LibraryItem } from '../types';
import { createBatchNotifications, createNotification } from './notificationService';

export const createTask = async (orgId: string, folderId: string, title: string, category: string, note: string, members: string[], deadline: string, initialAmount: number = 0, assigneeId: string | null = null) => {
  try {
    const finalMembers = [...new Set([...members, ...(assigneeId ? [assigneeId] : [])])];
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        organizationId: orgId,
        folderId,
        members: finalMembers,
        title,
        category,
        note,
        initialAmount,
        amount: 0,
        deadline,
        status: 'todo',
        progress: 0,
        assigneeId,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;

    // Notify all members about initial assignment/creation
    await createBatchNotifications(
      members,
      orgId,
      'task_assignment',
      `New Task: ${title}`,
      `A new task has been created in ${category}. Due: ${deadline}`,
      { view: 'folders', divisionId: folderId, taskId: data.id }
    );

    return data.id;
  } catch (error) {
    console.error('Create task error:', error);
  }
};

export const subscribeToTasks = (divisionId: string, userId: string, callback: (tasks: Task[]) => void, isAdmin: boolean = false) => {
  const fetchTasks = async () => {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('folderId', divisionId);
    
    if (!isAdmin) {
      query = query.contains('members', [userId]);
    }

    const { data } = await query;
    if (data) callback(data as Task[]);
  };

  fetchTasks();

  const channelId = `tasks_${divisionId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `folderId=eq.${divisionId}` }, () => {
      fetchTasks();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const addSubTask = async (orgId: string, taskId: string, members: string[], title: string, description: string = '', url: string = '', initialAmount: number = 0) => {
  try {
    const { data, error } = await supabase
      .from('subtasks')
      .insert({
        organizationId: orgId,
        taskId,
        members,
        title,
        description,
        url,
        initialAmount,
        completed: false,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Add subtask error:', error);
  }
};

export const toggleSubTask = async (taskId: string, subtaskId: string, completed: boolean) => {
  try {
    const { error } = await supabase
      .from('subtasks')
      .update({ completed })
      .eq('id', subtaskId);
    if (error) throw error;
  } catch (error) {
    console.error('Toggle subtask error:', error);
  }
};

export const subscribeToSubTasks = (taskId: string, userId: string, callback: (subtasks: SubTask[]) => void) => {
  const fetchSubTasks = async () => {
    const { data } = await supabase
      .from('subtasks')
      .select('*')
      .eq('taskId', taskId)
      .contains('members', [userId]);
    if (data) callback(data as SubTask[]);
  };

  fetchSubTasks();

  const channelId = `subtasks_${taskId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks', filter: `taskId=eq.${taskId}` }, () => {
      fetchSubTasks();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const addTaskLink = async (
  orgId: string,
  taskId: string | null, 
  divisionId: string, 
  label: string, 
  url: string, 
  members: string[], 
  libraryFolderId: string | null = null,
  source: 'task' | 'manual' = 'task'
) => {
  try {
    const { data, error } = await supabase
      .from('task_links')
      .insert({
        organizationId: orgId,
        taskId,
        divisionId,
        libraryFolderId,
        label,
        url,
        source,
        members,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Add task link error:', error);
  }
};

export const subscribeToLibraryItems = (divisionId: string, userId: string, callback: (links: LibraryItem[]) => void) => {
  const fetchLinks = async () => {
    const { data } = await supabase
      .from('task_links')
      .select('*')
      .eq('divisionId', divisionId)
      .contains('members', [userId]);
    if (data) callback(data as LibraryItem[]);
  };

  fetchLinks();

  const channelId = `links_${divisionId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `divisionId=eq.${divisionId}` }, () => {
      fetchLinks();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToLinksInFolder = (libraryFolderId: string, userId: string, callback: (links: LibraryItem[]) => void) => {
  const fetchLinks = async () => {
    const { data } = await supabase
      .from('task_links')
      .select('*')
      .eq('libraryFolderId', libraryFolderId)
      .contains('members', [userId]);
    if (data) callback(data as LibraryItem[]);
  };

  fetchLinks();

  const channelId = `folder_links_${libraryFolderId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `libraryFolderId=eq.${libraryFolderId}` }, () => {
      fetchLinks();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const updateTaskStatus = async (taskId: string, status: string, userId: string) => {
  try {
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (fetchError) throw fetchError;

    const updateData: any = { status };
    if (status === 'done') {
      updateData.completedAt = new Date().toISOString();
    }
    
    const { error: updateError } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);
    
    if (updateError) throw updateError;

    // Notify members about status change
    const recipientIds = (task.members as string[]).filter(m => m !== userId);
    if (recipientIds.length > 0) {
      await createBatchNotifications(
        recipientIds,
        task.organizationId,
        'task_status',
        `Task Status Update: ${task.title}`,
        `Status changed to: ${status.replace('-', ' ')}`,
        { view: 'folders', divisionId: task.folderId, taskId: task.id }
      );
    }
  } catch (error) {
    console.error('Update task status error:', error);
  }
};

export const updateSubTaskRevenue = async (taskId: string, subtaskId: string, closingCount: number, closingAmount: number, proofUrl: string = '') => {
  try {
    const { error } = await supabase
      .from('subtasks')
      .update({ 
        closingCount, 
        closingAmount,
        proofUrl
      })
      .eq('id', subtaskId);
    if (error) throw error;
    
    // Recalculate total task amount
    const { data: subtasks } = await supabase
      .from('subtasks')
      .select('closingAmount')
      .eq('taskId', taskId);
    
    if (subtasks) {
      const totalAmount = subtasks.reduce((sum, st) => sum + (st.closingAmount || 0), 0);
      await supabase
        .from('tasks')
        .update({ amount: totalAmount })
        .eq('id', taskId);
    }
  } catch (error) {
    console.error('Update revenue error:', error);
  }
};

export const updateTaskProgress = async (taskId: string, progress: number) => {
  try {
    await supabase
      .from('tasks')
      .update({ progress })
      .eq('id', taskId);
  } catch (error) {
    console.error('Update progress error:', error);
  }
};

export const subscribeToOrgTasks = (orgId: string, userId: string, callback: (tasks: Task[]) => void) => {
  const fetchTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('organizationId', orgId)
      .contains('members', [userId]);
    if (data) callback(data as Task[]);
  };

  fetchTasks();

  const channelId = `org_tasks_${orgId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `organizationId=eq.${orgId}` }, () => {
      fetchTasks();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToOrgLinks = (orgId: string, userId: string, callback: (links: LibraryItem[]) => void) => {
  const fetchLinks = async () => {
    const { data } = await supabase
      .from('task_links')
      .select('*')
      .eq('organizationId', orgId)
      .contains('members', [userId]);
    if (data) callback(data as LibraryItem[]);
  };

  fetchLinks();

  const channelId = `org_links_${orgId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `organizationId=eq.${orgId}` }, () => {
      fetchLinks();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
