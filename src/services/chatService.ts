import { supabase } from '../lib/supabase';
import { Message } from '../types';
import { createBatchNotifications } from './notificationService';

export const sendMessage = async (
  orgId: string, 
  userId: string, 
  userName: string, 
  text: string, 
  members: string[],
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

    // Notify other members
    const recipientIds = members.filter(m => m !== userId);
    if (recipientIds.length > 0) {
      await createBatchNotifications(
        recipientIds,
        orgId,
        'message',
        `New Message from ${userName}`,
        text.length > 50 ? text.substring(0, 47) + '...' : text,
        { view: 'chat', divisionId: divisionId || undefined }
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
