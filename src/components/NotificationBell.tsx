import { useState, useEffect, useRef } from 'react';
import { Bell, BellRing, BellOff, X, MessageSquare, Tag, AlertCircle, Clock, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppNotification } from '../types';
import { subscribeToNotifications, markAsRead, markAllAsRead } from '../services/notificationService';

interface NotificationBellProps {
  userId: string;
  orgId: string;
  onNavigateToTask: (divisionId: string, taskId: string) => void;
  onNavigateToChat: (divisionId?: string) => void;
}

export default function NotificationBell({ userId, orgId, onNavigateToTask, onNavigateToChat }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToNotifications(userId, orgId, setNotifications);
    return unsub;
  }, [userId, orgId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id);
    setIsOpen(false);
    
    if (n.link) {
      if (n.link.view === 'folders' && n.link.divisionId && n.link.taskId) {
        onNavigateToTask(n.link.divisionId, n.link.taskId);
      } else if (n.link.view === 'chat') {
        onNavigateToChat(n.link.divisionId);
      }
    }
  };

  const IconMap = {
    message: <MessageSquare className="w-4 h-4 text-blue-500" />,
    task_assignment: <Tag className="w-4 h-4 text-orange-500" />,
    task_status: <CheckCircle className="w-4 h-4 text-green-500" />,
    deadline: <Clock className="w-4 h-4 text-red-500" />
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-3 rounded-2xl transition-all relative group ${
          isOpen ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-black'
        }`}
      >
        <motion.div
          animate={unreadCount > 0 ? { rotate: [0, 10, -10, 10, -10, 0] } : {}}
          transition={{ repeat: Infinity, duration: 2, repeatDelay: 5 }}
        >
          {unreadCount > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </motion.div>
        
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white group-hover:scale-110 transition-transform">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-white rounded-[2rem] shadow-2xl border border-black/5 overflow-hidden z-[100]"
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Notifications</h4>
              {unreadCount > 0 && (
                <button 
                  onClick={() => markAllAsRead(notifications)}
                  className="text-[9px] font-bold text-orange-500 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto text-gray-200">
                    <BellOff className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-gray-400">All caught up!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full flex items-start gap-4 p-4 rounded-2xl transition-all text-left group ${
                        n.read ? 'opacity-60 grayscale-[0.5]' : 'bg-orange-50/30'
                      } hover:bg-gray-50`}
                    >
                      <div className={`mt-1 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        n.read ? 'bg-gray-100' : 'bg-white shadow-sm ring-1 ring-black/5'
                      }`}>
                        {IconMap[n.type] || <AlertCircle className="w-4 h-4 text-gray-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs mb-0.5 truncate ${n.read ? 'font-medium text-gray-600' : 'font-black text-gray-900'}`}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[9px] text-gray-300 mt-2 font-bold uppercase tracking-widest">
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
