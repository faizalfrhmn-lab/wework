import { supabase } from '../lib/supabase';
import { AppNotification, NotificationType } from '../types';

export const createNotification = async (
  userId: string,
  orgId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: AppNotification['link']
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        userId,
        orgId,
        type,
        title,
        message,
        link: link || null,
        read: false,
        createdAt: new Date().toISOString()
      });
    if (error) throw error;
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

export const createBatchNotifications = async (
  userIds: string[],
  orgId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: AppNotification['link']
) => {
  try {
    const notifications = userIds.map(uid => ({
      userId: uid,
      orgId,
      type,
      title,
      message,
      link: link || null,
      read: false,
      createdAt: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
    if (error) throw error;
  } catch (error) {
    console.error('Batch notification error:', error);
  }
};

export const subscribeToNotifications = (userId: string, orgId: string, callback: (notifications: AppNotification[]) => void) => {
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('userId', userId)
      .eq('orgId', orgId)
      .order('createdAt', { ascending: false })
      .limit(20);
    if (data) callback(data as AppNotification[]);
  };

  fetchNotifications();

  const channelId = `notifications_${userId}_${Math.random().toString(36).substring(7)}`;
  const channel = supabase
    .channel(channelId)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'notifications', 
      filter: `userId=eq.${userId}` 
    }, () => {
      fetchNotifications();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const markAsRead = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    if (error) throw error;
  } catch (error) {
    console.error('Mark read error:', error);
  }
};

export const markAllAsRead = async (notifications: AppNotification[]) => {
  try {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);
    if (error) throw error;
  } catch (error) {
    console.error('Mark all read error:', error);
  }
};
