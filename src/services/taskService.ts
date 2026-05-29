import { supabase } from '../lib/supabase';
import { Task, SubTask, LibraryItem } from '../types';
import { createBatchNotifications, createNotification } from './notificationService';

// Utilities to handle assigneeId when the database column is missing
const serializeNote = (assigneeId: string | string[] | null, noteText: string | undefined): string => {
  const assigneeIds = Array.isArray(assigneeId) ? assigneeId : (assigneeId ? [assigneeId] : []);
  const singleAssigneeId = assigneeIds[0] || null;
  return JSON.stringify({ assigneeIds, assigneeId: singleAssigneeId, text: noteText || '' });
};

const parseNote = (rawNote: string | null): { assigneeIds: string[]; assigneeId: string | null; text: string } => {
  if (!rawNote) {
    return { assigneeIds: [], assigneeId: null, text: '' };
  }
  const trimmed = rawNote.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      let assigneeIds = parsed.assigneeIds || [];
      if (!Array.isArray(assigneeIds)) {
        assigneeIds = parsed.assigneeId ? [parsed.assigneeId] : [];
      }
      return {
        assigneeIds,
        assigneeId: parsed.assigneeId || assigneeIds[0] || null,
        text: parsed.text || ''
      };
    } catch (e) {
      // Fallback
    }
  }
  return { assigneeIds: [], assigneeId: null, text: rawNote };
};

const transformTask = (dbTask: any): Task => {
  if (!dbTask) return dbTask;
  const { assigneeIds, assigneeId, text } = parseNote(dbTask.note);
  return {
    ...dbTask,
    assigneeId: assigneeId || undefined,
    assigneeIds: assigneeIds || [],
    note: text || '',
    createdBy: dbTask.createdBy // Add this line
  };
};

export const createTask = async (orgId: string, folderId: string, title: string, category: string, note: string, members: string[], deadline: string, initialAmount: number = 0, assigneeId: string | string[] | null = null, creatorId: string, creatorName: string = 'Seseorang') => {
  try {
    const safeMembers = Array.isArray(members) ? members : [];
    const inputAssignees = Array.isArray(assigneeId) ? assigneeId : (assigneeId ? [assigneeId] : []);
    
    let finalMembers = [...new Set([...safeMembers, creatorId, ...inputAssignees])];
    
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
      console.error('Error adding superadmins to task members:', e);
    }
    
    const serializedNote = serializeNote(inputAssignees, note);
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        organizationId: orgId,
        folderId,
        members: finalMembers,
        title,
        category,
        note: serializedNote,
        initialAmount,
        amount: 0,
        deadline,
        status: 'todo',
        progress: 0,
        createdAt: new Date().toISOString(),
        createdBy: creatorId
      })
      .select()
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Failed to create task: No data returned.');

    // Notify assignees specifically if not the creator
    for (const singleAssignee of inputAssignees) {
      if (singleAssignee && singleAssignee !== creatorId) {
        createNotification(
          singleAssignee,
          orgId,
          'task_assignment',
          `Tugas Baru Didelegasikan: ${title}`,
          `${creatorName} telah menugaskan tugas "${title}" kepada Anda.`,
          { view: 'folders', divisionId: folderId, taskId: data.id }
        ).catch(err => console.error('Assignee notification error:', err));
      }
    }

    // Notify all other members about task creation
    const otherRecipients = finalMembers.filter(m => m !== creatorId && !inputAssignees.includes(m));
    if (otherRecipients.length > 0) {
      createBatchNotifications(
        otherRecipients,
        orgId,
        'task_assignment',
        `Tugas Baru: ${title}`,
        `Tugas baru telah dibuat di divisi ${category}. Batas waktu: ${deadline}`,
        { view: 'folders', divisionId: folderId, taskId: data.id }
      ).catch(err => console.error('Silent notification error:', err));
    }

    return data.id;
  } catch (error) {
    console.error('Create task error:', error);
    throw error;
  }
};

export const subscribeToTasks = (divisionId: string, userId: string, callback: (tasks: Task[]) => void, isAdmin: boolean = false) => {
  let debounceTimer: ReturnType<typeof setTimeout>;
  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('folderId', divisionId);
      
      const { data, error } = await query;
      if (error) throw error;
      if (data) callback(data.map(transformTask));
    } catch (err) {
      console.error('Fetch tasks error:', err);
    }
  };

  const debouncedFetchTasks = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchTasks, 500);
  };

  fetchTasks();

  const channelId = `tasks_${divisionId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `folderId=eq.${divisionId}` }, () => {
      debouncedFetchTasks();
    })
    .subscribe();

  return () => {
    clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
};

export const addSubTask = async (orgId: string, taskId: string, members: string[], title: string, description: string = '', url: string = '', initialAmount: number = 0) => {
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
      console.error('Error adding superadmins to subtask members:', e);
    }

    const { data, error } = await supabase
      .from('subtasks')
      .insert({
        organizationId: orgId,
        taskId,
        members: finalMembers,
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

export const subscribeToSubTasks = (taskId: string, userId: string, callback: (subtasks: SubTask[]) => void, isAdmin: boolean = false) => {
  let debounceTimer: ReturnType<typeof setTimeout>;
  const fetchSubTasks = async () => {
    let query = supabase
      .from('subtasks')
      .select('*')
      .eq('taskId', taskId);
    const { data } = await query;
    if (data) callback(data as SubTask[]);
  };

  const debouncedFetchSubTasks = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchSubTasks, 500);
  };

  fetchSubTasks();

  const channelId = `subtasks_${taskId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks', filter: `taskId=eq.${taskId}` }, () => {
      debouncedFetchSubTasks();
    })
    .subscribe();

  return () => {
    clearTimeout(debounceTimer);
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
      console.error('Error adding superadmins to task link members:', e);
    }

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
        members: finalMembers,
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

export const subscribeToLibraryItems = (divisionId: string, userId: string, callback: (links: LibraryItem[]) => void, isAdmin: boolean = false) => {
  let debounceTimer: ReturnType<typeof setTimeout>;
  const fetchLinks = async () => {
    let query = supabase
      .from('task_links')
      .select('*')
      .eq('divisionId', divisionId);
    const { data } = await query;
    if (data) callback(data as LibraryItem[]);
  };

  const debouncedFetchLinks = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchLinks, 500);
  };

  fetchLinks();

  const channelId = `links_${divisionId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'task_links', filter: `divisionId=eq.${divisionId}` }, () => {
      debouncedFetchLinks();
    })
    .subscribe();

  return () => {
    clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
};

export const subscribeToLinksInFolder = (libraryFolderId: string, userId: string, callback: (links: LibraryItem[]) => void, isAdmin: boolean = false) => {
  const fetchLinks = async () => {
    let query = supabase
      .from('task_links')
      .select('*')
      .eq('libraryFolderId', libraryFolderId);
    const { data } = await query;
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
    const { data: dbTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (fetchError) throw fetchError;
    const task = transformTask(dbTask);

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

export const subscribeToOrgTasks = (orgId: string, userId: string, callback: (tasks: Task[]) => void, isAdmin: boolean = false) => {
  let debounceTimer: ReturnType<typeof setTimeout>;
  const fetchTasks = async () => {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('organizationId', orgId);
    const { data } = await query;
    if (data) callback(data.map(transformTask));
  };

  const debouncedFetchTasks = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fetchTasks, 500);
  };

  fetchTasks();

  const channelId = `org_tasks_${orgId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `organizationId=eq.${orgId}` }, () => {
      debouncedFetchTasks();
    })
    .subscribe();

  return () => {
    clearTimeout(debounceTimer);
    supabase.removeChannel(channel);
  };
};

export const subscribeToOrgLinks = (orgId: string, userId: string, callback: (links: LibraryItem[]) => void, isAdmin: boolean = false) => {
  const fetchLinks = async () => {
    let query = supabase
      .from('task_links')
      .select('*')
      .eq('organizationId', orgId);
    const { data } = await query;
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

export const deleteTaskLink = async (linkId: string) => {
  try {
    const { error } = await supabase
      .from('task_links')
      .delete()
      .eq('id', linkId);
    if (error) throw error;
  } catch (error) {
    console.error('Delete task link error:', error);
    throw error;
  }
};

export const updateTaskAssignee = async (taskId: string, assigneeId: string | string[] | null, orgId: string, userId: string, senderName: string = 'Seseorang') => {
  try {
    const { data: dbTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (fetchError) throw fetchError;

    const { assigneeIds: oldAssigneeIds, text } = parseNote(dbTask.note);
    const newAssigneeIds = Array.isArray(assigneeId) ? assigneeId : (assigneeId ? [assigneeId] : []);

    const setsEqual = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
    if (setsEqual(oldAssigneeIds, newAssigneeIds)) return; // No change

    const serializedNote = serializeNote(newAssigneeIds, text);
    
    let members = Array.isArray(dbTask.members) ? [...dbTask.members] : [];
    for (const singleId of newAssigneeIds) {
      if (singleId && !members.includes(singleId)) {
        members.push(singleId);
      }
    }

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        note: serializedNote,
        members
      })
      .eq('id', taskId);

    if (updateError) throw updateError;

    // Send assignment notifications to newly added users
    const addedAssignees = newAssigneeIds.filter(id => !oldAssigneeIds.includes(id));
    for (const singleId of addedAssignees) {
      if (singleId && singleId !== userId) {
        await createNotification(
          singleId,
          orgId,
          'task_assignment',
          `Tugas Baru Didelegasikan`,
          `${senderName} telah menugaskan tugas "${dbTask.title}" kepada Anda.`,
          { view: 'folders', divisionId: dbTask.folderId, taskId: dbTask.id }
        );
      }
    }
  } catch (error) {
    console.error('Update task assignee error:', error);
    throw error;
  }
};

export const updateTaskNote = async (taskId: string, text: string) => {
  try {
    const { data: dbTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (fetchError) throw fetchError;

    const { assigneeIds } = parseNote(dbTask.note);
    const serializedNote = serializeNote(assigneeIds, text);
    
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        note: serializedNote
      })
      .eq('id', taskId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Update task note error:', error);
    throw error;
  }
};
