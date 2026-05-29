import { supabase } from '../lib/supabase';
import { Message, UserProfile } from '../types';
import { createBatchNotifications } from './notificationService';

export const sendMessage = async (
  orgId: string, 
  userId: string, 
  userName: string, 
  text: string, 
  members: string[],
  spaceMembers: UserProfile[],
  divisionId: string | null = null,
  taggedTaskId: string | null = null,
  taggedTaskDivisionId: string | null = null,
  taggedTaskTitle: string | null = null
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
      console.error('Error adding superadmins to message members:', e);
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        organizationId: orgId,
        divisionId,
        senderId: userId,
        senderName: userName,
        text,
        members: finalMembers,
        taggedTaskId,
        taggedTaskDivisionId,
        taggedTaskTitle,
        createdAt: new Date().toISOString()
      });
    
    if (error) throw error;

    // Detect mentions
    const mentionedUserIds = spaceMembers
      .filter(member => {
        const displayName = member.displayName || member.email;
        return text.includes(`@${displayName}`);
      })
      .map(member => member.id);

    // Notify defined recipients
    const recipientIds = (mentionedUserIds.length > 0 ? mentionedUserIds : members)
      .filter(m => m !== userId);
      
    if (recipientIds.length > 0) {
      const isTaskComment = !!taggedTaskId;
      const notificationTitle = isTaskComment
        ? `${userName} menyebut Anda di tugas: ${taggedTaskTitle}`
        : `Pesan Baru dari ${userName}`;
      
      const notificationMessage = isTaskComment
        ? text
        : (text.length > 50 ? text.substring(0, 47) + '...' : text);

      await createBatchNotifications(
        recipientIds,
        orgId,
        isTaskComment ? 'task_assignment' : 'message',
        notificationTitle,
        notificationMessage,
        isTaskComment
          ? { view: 'folders', divisionId: divisionId || undefined, taskId: taggedTaskId, scrollTo: 'comments' }
          : { view: 'chat', divisionId: divisionId || undefined }
      );
    }
  } catch (error) {
    console.error('Send message error:', error);
  }
};

export const subscribeToMessages = (orgId: string, userId: string, divisionId: string | null = null, callback: (messages: Message[]) => void, isAdmin: boolean = false) => {
  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('organizationId', orgId);

    query = query.order('createdAt', { ascending: true })
      .limit(100);
    
    if (divisionId) {
      query = query.eq('divisionId', divisionId);
    } else {
      query = query.is('divisionId', null);
    }

    const { data } = await query;
    if (data) callback(data as Message[]);
  };

  fetchMessages();

  const channelId = `messages_${orgId}_${divisionId || 'global'}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      fetchMessages();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const clearChatMessages = async (orgId: string, divisionId: string | null) => {
  try {
    let query = supabase
      .from('messages')
      .delete()
      .eq('organizationId', orgId);

    if (divisionId) {
      query = query.eq('divisionId', divisionId);
    } else {
      query = query.is('divisionId', null);
    }

    const { error } = await query;
    if (error) throw error;
  } catch (error) {
    console.error('Clear messages error:', error);
    throw error;
  }
};

export const unsendMessage = async (messageId: string) => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
      
    if (error) throw error;
  } catch (error) {
    console.error('Unsend message error:', error);
    throw error;
  }
};

export const subscribeToTaskComments = (
  taskId: string,
  callback: (messages: Message[]) => void
) => {
  const fetchTaskComments = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('taggedTaskId', taskId)
        .order('createdAt', { ascending: true });
        
      if (error) throw error;
      if (data) callback(data as Message[]);
    } catch (err) {
      console.error('Fetch task comments error:', err);
    }
  };

  fetchTaskComments();

  const channelId = `task_comments_${taskId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `taggedTaskId=eq.${taskId}` },
      () => {
        fetchTaskComments();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

