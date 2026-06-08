import { supabase } from '../lib/supabase';
import { Task, SubTask, LibraryItem } from '../types';
import { createBatchNotifications, createNotification } from './notificationService';

// Utilities to handle assigneeId when the database column is missing
const serializeNote = (assigneeId: string | string[] | null, noteText: string | undefined, isPersonal?: boolean, attachments?: any[]): string => {
  const assigneeIds = Array.isArray(assigneeId) ? assigneeId : (assigneeId ? [assigneeId] : []);
  const singleAssigneeId = assigneeIds[0] || null;
  return JSON.stringify({ 
    assigneeIds, 
    assigneeId: singleAssigneeId, 
    text: noteText || '', 
    isPersonal: !!isPersonal,
    attachments: attachments || []
  });
};

const parseNote = (rawNote: string | null): { 
  assigneeIds: string[]; 
  assigneeId: string | null; 
  text: string;
  extensionRequested: boolean;
  extensionStatus: 'pending' | 'approved' | 'rejected' | null;
  isPersonal: boolean;
  attachments: any[];
} => {
  if (!rawNote) {
    return { assigneeIds: [], assigneeId: null, text: '', extensionRequested: false, extensionStatus: null, isPersonal: false, attachments: [] };
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
        text: parsed.text || '',
        extensionRequested: !!parsed.extensionRequested,
        extensionStatus: parsed.extensionStatus || null,
        isPersonal: !!parsed.isPersonal,
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : []
      };
    } catch (e) {
      // Fallback
    }
  }
  return { assigneeIds: [], assigneeId: null, text: rawNote, extensionRequested: false, extensionStatus: null, isPersonal: false, attachments: [] };
};

const transformTask = (dbTask: any): Task => {
  if (!dbTask) return dbTask;
  const { assigneeIds, assigneeId, text, extensionRequested, extensionStatus, isPersonal, attachments } = parseNote(dbTask.note);
  return {
    ...dbTask,
    assigneeId: assigneeId || undefined,
    assigneeIds: assigneeIds || [],
    note: text || '',
    extensionRequested: extensionRequested || false,
    extensionStatus: extensionStatus || undefined,
    isPersonal: isPersonal || false,
    attachments: attachments || []
  };
};

export const createTask = async (orgId: string, folderId: string, title: string, category: string, note: string, members: string[], deadline: string, initialAmount: number = 0, assigneeId: string | string[] | null = null, creatorId: string, creatorName: string = 'Seseorang', isPersonal: boolean = false) => {
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
    
    const serializedNote = serializeNote(inputAssignees, note, isPersonal);
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

    // We only notify the assignees of the task. Keep otherRecipients silent as requested,
    // so no generic workspace-wide notification is sent unless they are specifically assigned.
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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `folderId=eq.${divisionId}` }, (payload) => {
      console.log('Task change detected:', payload);
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

export const deleteSubTask = async (subtaskId: string) => {
  try {
    const { error } = await supabase
      .from('subtasks')
      .delete()
      .eq('id', subtaskId);
    if (error) throw error;
  } catch (error) {
    console.error('Delete subtask error:', error);
    throw error;
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

    const progressMap: { [key: string]: number } = {
      'todo': 0,
      'revision': 25,
      'in-progress': 50,
      'review': 85,
      'done': 100
    };
    const progress = progressMap[status] !== undefined ? progressMap[status] : task.progress;

    const updateData: any = { status, progress };
    if (status === 'done') {
      updateData.completedAt = new Date().toISOString();
      
      // Synchronize all subtasks as completed when the main task is done/approved
      await supabase
        .from('subtasks')
        .update({ completed: true })
        .eq('taskId', taskId);
    } else if (status === 'todo') {
      // Synchronize all subtasks as incomplete when restarted to todo
      await supabase
        .from('subtasks')
        .update({ completed: false })
        .eq('taskId', taskId);
    }
    
    const { error: updateError } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);
    
    if (updateError) throw updateError;

    // Notify ONLY the assignees and the creator of the task about the status change
    const taskAssigneeIds = task.assigneeIds || [];
    const taskCreatorId = task.createdBy || '';
    
    const recipientSet = new Set<string>();
    taskAssigneeIds.forEach(id => {
      if (id && id !== userId) recipientSet.add(id);
    });
    if (taskCreatorId && taskCreatorId !== userId) {
      recipientSet.add(taskCreatorId);
    }
    
    const recipientIds = Array.from(recipientSet);
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

export const deleteTask = async (taskId: string) => {
  try {
    console.log('Attempting to delete task:', taskId);
    
    // Helper to delete
    const safeDeleteFromTable = async (tableName: string, column: string, id: string) => {
      try {
        const { error } = await supabase.from(tableName).delete().eq(column, id);
        if (error) console.error(`Error deleting from ${tableName}:`, error);
        else console.log(`${tableName} deleted`);
      } catch (e) {
        console.error(`Exception deleting from ${tableName}:`, e);
      }
    };

    // 1. Hapus subtasks
    await safeDeleteFromTable('subtasks', 'taskId', taskId);
    
    // 2. Hapus task links
    await safeDeleteFromTable('task_links', 'taskId', taskId);
    
    // 3. Hapus comments
    await safeDeleteFromTable('messages', 'taggedTaskId', taskId);
    
    // 4. Hapus task
    const { error: taskError, data: deletedTask } = await supabase.from('tasks').delete().eq('id', taskId).select();
    if (taskError) {
       console.error('Error deleting task (Task table):', taskError);
       throw taskError;
    }
    console.log('Task deleted successfully:', taskId, 'Result:', deletedTask);
  } catch (error) {
    console.error('Delete task error:', error);
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

    const { assigneeIds: oldAssigneeIds, text, isPersonal, attachments } = parseNote(dbTask.note);
    const newAssigneeIds = Array.isArray(assigneeId) ? assigneeId : (assigneeId ? [assigneeId] : []);

    const setsEqual = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
    if (setsEqual(oldAssigneeIds, newAssigneeIds)) return; // No change

    const serializedNote = serializeNote(newAssigneeIds, text, isPersonal, attachments);
    
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

    const { assigneeIds, isPersonal, attachments } = parseNote(dbTask.note);
    const serializedNote = serializeNote(assigneeIds, text, isPersonal, attachments);
    
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

export const updateTaskAttachments = async (taskId: string, attachments: any[]) => {
  try {
    const { data: dbTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    
    if (fetchError) throw fetchError;

    const { assigneeIds, text, isPersonal } = parseNote(dbTask.note);
    const serializedNote = serializeNote(assigneeIds, text, isPersonal, attachments);
    
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        note: serializedNote
      })
      .eq('id', taskId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Update task attachments error:', error);
    throw error;
  }
};

export const requestTaskExtension = async (taskId: string, creatorId: string, orgId: string, requesterName: string, taskTitle: string) => {
  try {
    // Fetch task info to get note details and folderId
    const { data: dbTask, error: fetchErr } = await supabase
      .from('tasks')
      .select('note, folderId, title')
      .eq('id', taskId)
      .single();
    if (fetchErr) throw fetchErr;

    const currentNoteRaw = dbTask?.note || '';
    let parsed: any = { assigneeIds: [] as string[], assigneeId: null as string | null, text: '' };
    
    if (currentNoteRaw.trim().startsWith('{') && currentNoteRaw.trim().endsWith('}')) {
      try {
        parsed = JSON.parse(currentNoteRaw);
      } catch (e) {}
    } else {
      parsed.text = currentNoteRaw;
    }

    const updatedNote = JSON.stringify({
      ...parsed,
      extensionRequested: true,
      extensionStatus: 'pending'
    });

    const { error: updateErr } = await supabase
      .from('tasks')
      .update({
        note: updatedNote
      })
      .eq('id', taskId);
    if (updateErr) throw updateErr;
    
    const folderId = dbTask?.folderId || '';
    const resolvedTitle = dbTask?.title || taskTitle;

    const notifyUserIds = new Set<string>();
    if (creatorId) {
      notifyUserIds.add(creatorId);
    }

    try {
      // Find all superadmins and managers
      const { data: adminAndManagers } = await supabase
        .from('users')
        .select('id, role')
        .in('role', ['superadmin', 'manager']);
      
      if (adminAndManagers) {
        // Fetch organization members to ensure managers belong to this organization scope or are superadmin
        const { data: dbOrg } = await supabase
          .from('organizations')
          .select('members')
          .eq('id', orgId)
          .single();
        
        const orgMembers = dbOrg?.members || [];
        
        adminAndManagers.forEach((u) => {
          if (u.role === 'superadmin' || orgMembers.includes(u.id)) {
            notifyUserIds.add(u.id);
          }
        });
      }
    } catch (dbErr) {
      console.error('Failed to query admins/managers for notification:', dbErr);
    }

    const notificationTargets = Array.from(notifyUserIds);
    if (notificationTargets.length > 0) {
      await createBatchNotifications(
        notificationTargets,
        orgId,
        'deadline',
        'Permintaan Perpanjangan Deadline',
        `${requesterName} meminta perpanjangan deadline untuk tugas "${resolvedTitle}".`,
        { view: 'folders', divisionId: folderId, taskId: taskId }
      );
    }
  } catch (error) {
    console.error('Request task extension error:', error);
    throw error;
  }
};

export const updateTaskExtensionStatus = async (
  taskId: string, 
  status: 'approved' | 'rejected', 
  orgId: string,
  approverName: string,
  newDeadline?: string
) => {
  try {
    // Fetch current task row to read existing note structures
    const { data: dbTask, error: fetchErr } = await supabase
      .from('tasks')
      .select('note, title, folderId, deadline')
      .eq('id', taskId)
      .single();
    if (fetchErr) throw fetchErr;

    const currentNoteRaw = dbTask?.note || '';
    let parsed: any = { assigneeIds: [] as string[], assigneeId: null as string | null, text: '' };
    
    if (currentNoteRaw.trim().startsWith('{') && currentNoteRaw.trim().endsWith('}')) {
      try {
        parsed = JSON.parse(currentNoteRaw);
      } catch (e) {}
    } else {
      parsed.text = currentNoteRaw;
    }

    const updatedNote = JSON.stringify({
      ...parsed,
      extensionRequested: false,
      extensionStatus: status
    });

    const updateData: any = {
      note: updatedNote
    };
    if (status === 'approved' && newDeadline) {
      updateData.deadline = newDeadline;
    }

    const { error: updateErr } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);
    if (updateErr) throw updateErr;

    // Send realtime notification back to assignees so they know it is approved/rejected
    try {
      if (dbTask) {
        const { assigneeIds } = parseNote(updatedNote); // Use the updatedNote values we just built
        if (assigneeIds && assigneeIds.length > 0) {
          const statusLabel = status === 'approved' ? 'DISETUJUI & PERPANJANG' : 'DITOLAK';
          const deadlineText = status === 'approved' && newDeadline 
            ? `, batas waktu baru diperpanjang sampai tanggal ${newDeadline}` 
            : '';
          
          await createBatchNotifications(
            assigneeIds,
            orgId,
            'task_assignment',
            `Pengajuan Perpanjangan ${statusLabel}`,
            `Pengajuan perpanjangan waktu untuk tugas "${dbTask.title}" telah ${status === 'approved' ? 'disetujui' : 'ditolak'} oleh ${approverName}${deadlineText}.`,
            { view: 'folders', divisionId: dbTask.folderId, taskId: taskId }
          );
        }
      }
    } catch (notifErr) {
      console.error('Failed to dispatch extension decision notifications:', notifErr);
    }
  } catch (error) {
    console.error('Update task extension status error:', error);
    throw error;
  }
};
