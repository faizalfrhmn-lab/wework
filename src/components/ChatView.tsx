import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Hash, MessageSquare, Coffee, Tag, X, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { Organization, Message, Task, UserProfile, AppUser } from '../types';
import { sendMessage, subscribeToMessages, clearChatMessages, unsendMessage } from '../services/chatService';
import { subscribeToOrgTasks } from '../services/taskService';
import { getAllUsers } from '../services/authService';
import { supabase } from '../lib/supabase';
import Modal from './Modal';

interface ChatViewProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
  divisionId?: string;
  divisionName?: string;
  onNavigateToTask?: (divisionId: string, taskId: string) => void;
}

export default function ChatView({ user, profile, org, divisionId, divisionName: initialDivisionName, onNavigateToTask }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [taggedTask, setTaggedTask] = useState<Task | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [divisionName, setDivisionName] = useState<string | null>(initialDivisionName || null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const spaceMembers = allUsers.filter(u => org.members.includes(u.id));

  const handleClearChat = async () => {
    if (profile?.role !== 'superadmin') return;
    await clearChatMessages(org.id, divisionId || null);
    setShowClearConfirm(false);
  };

  useEffect(() => {
    const unsub = getAllUsers(setAllUsers);
    return unsub;
  }, []);

  useEffect(() => {
    if (initialDivisionName) {
      setDivisionName(initialDivisionName);
      return;
    }
    if (!divisionId) {
      setDivisionName(null);
      return;
    }

    const fetchDivisionName = async () => {
      const { data } = await supabase
        .from('folders')
        .select('name')
        .eq('id', divisionId)
        .single();
      if (data) {
        setDivisionName(data.name);
      }
    };
    fetchDivisionName();
  }, [divisionId, initialDivisionName]);

  useEffect(() => {
    const isSuperadmin = profile?.role === 'superadmin';
    const unsubMessages = subscribeToMessages(org.id, user.uid, divisionId || null, setMessages, isSuperadmin);
    const unsubTasks = subscribeToOrgTasks(org.id, user.uid, setAllTasks, isSuperadmin);
    return () => {
      unsubMessages();
      unsubTasks();
    };
  }, [org.id, divisionId, user.uid]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: any) => {
    e.preventDefault();
    if (newMessage.trim() || taggedTask) {
      await sendMessage(
        org.id, 
        user.uid, 
        profile?.displayName || user.displayName || 'User', 
        newMessage.trim(), 
        org.members,
        spaceMembers,
        divisionId || null,
        taggedTask?.id || null,
        taggedTask?.folderId || null,
        taggedTask?.title || null
      );
      setNewMessage('');
      setTaggedTask(null);
    }
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-full bg-white overflow-hidden relative'} flex flex-col`}>
      <header className="px-8 py-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
              {divisionId ? (divisionName ? `Chat: ${divisionName}` : 'Division Chat') : 'Space Chat'}
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">
              {divisionId ? 'Focused Team Discussion' : `Global Space Chat · ${org.members.length} Members`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {profile?.role === 'superadmin' && (
            <button 
              onClick={() => setShowClearConfirm(true)}
              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Clear Chat"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5 text-gray-400" /> : <Maximize2 className="w-5 h-5 text-gray-400" />}
          </button>
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto ${isFullscreen ? 'p-4' : 'p-8'} z-10 no-scrollbar bg-[#FDFDFD]`}>
        <div className="max-w-4xl mx-auto space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
            <Coffee className="w-12 h-12 mb-4" />
            <p className="font-bold text-sm">No messages yet.<br/>Start the conversation!</p>
          </div>
        )}
        
        {messages.map((msg) => {
          const isMine = msg.senderId === user.uid;
          const senderProfile = allUsers.find(u => u.id === msg.senderId);
          const avatarUrl = senderProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`;

          return (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.id} 
              className={`flex gap-3 items-start ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              {!isMine && (
                <div className="w-10 h-10 rounded-2xl bg-orange-50/10 border border-black/5 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}

              <div className={`flex flex-col max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isMine && (
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{msg.senderName}</span>
                  )}
                  {isMine && (
                    <>
                      <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Anda</span>
                      {msg.createdAt && (new Date().getTime() - new Date(msg.createdAt).getTime()) < 60 * 1000 && (
                        <button 
                          onClick={() => unsendMessage(msg.id)}
                          className="text-[9px] font-bold text-red-500 hover:text-red-700 italic"
                        >
                          Unsend
                        </button>
                      )}
                    </>
                  )}
                  <span className="text-[9px] font-bold text-gray-400 font-mono tracking-tight">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {msg.text && (
                    <div className={`px-5 py-3 rounded-2xl text-sm font-medium leading-relaxed ${
                      isMine 
                        ? 'bg-black text-white rounded-tr-none shadow-lg' 
                        : 'bg-gray-100 text-gray-800 rounded-tl-none shadow-sm'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  
                  {msg.taggedTaskId && (
                    <button
                      onClick={() => onNavigateToTask?.(msg.taggedTaskDivisionId!, msg.taggedTaskId!)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black transition-all ${
                        isMine
                          ? 'bg-orange-500 text-white border-transparent hover:bg-orange-600 shadow-lg shadow-orange-500/20'
                          : 'bg-white text-orange-600 border-orange-100 hover:border-orange-500 shadow-sm'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[200px]">Ref: {msg.taggedTaskTitle}</span>
                    </button>
                  )}
                </div>
              </div>

              {isMine && (
                <div className="w-10 h-10 rounded-2xl bg-orange-50/10 border border-black/5 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  <img 
                    src={profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                    alt="" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
              )}
            </motion.div>
          );
        })}
        <div ref={chatEndRef} />
        </div>
      </div>

      {showTaskPicker && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-30 flex items-end justify-center p-8">
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[60%]"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-widest text-gray-900">Tag a Task</h3>
              <button onClick={() => { setShowTaskPicker(false); setTaskSearchQuery(''); }} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search tasks..."
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-black"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {allTasks.filter(t => t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())).length > 0 ? (
                allTasks.filter(t => t.title.toLowerCase().includes(taskSearchQuery.toLowerCase())).map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTaggedTask(t);
                      setShowTaskPicker(false);
                    }}
                    className="w-full text-left p-4 rounded-[1.5rem] hover:bg-gray-50 flex items-center gap-4 transition-all border border-transparent hover:border-gray-100"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                      <Tag className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{t.title}</p>
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest">In {t.category}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center text-gray-400">
                  <p className="font-bold text-sm">No tasks available to tag.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <div className={`${isFullscreen ? 'p-4' : 'p-8'} border-t border-gray-100 shrink-0 bg-white z-10`}>
        <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto space-y-3">
          <AnimatePresence>
            {taggedTask && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 p-2 px-4 bg-orange-50 text-orange-600 rounded-xl border border-orange-100 self-start"
              >
                <Tag className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest flex-1">Tagged: {taggedTask.title}</span>
                <button onClick={() => setTaggedTask(null)} className="p-1 hover:bg-orange-100 rounded-md">
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <input 
              type="text" 
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => {
                const val = e.target.value;
                setNewMessage(val);
                if (val.endsWith('@')) {
                  setShowUserPicker(true);
                }
              }}
              className="w-full pl-6 pr-24 py-4 bg-gray-50 border border-transparent rounded-[2rem] text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/20 transition-all shadow-inner"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button 
                type="button"
                onClick={() => setShowTaskPicker(true)}
                className={`p-3 rounded-full transition-all active:scale-95 ${taggedTask ? 'bg-orange-500 text-white' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <Tag className="w-4 h-4" />
              </button>
              <button 
                type="submit"
                disabled={!newMessage.trim() && !taggedTask}
                className="p-3 bg-black text-white rounded-full hover:bg-orange-500 hover:shadow-lg disabled:opacity-30 disabled:hover:bg-black transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {showUserPicker && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-30 flex items-end justify-center p-8">
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[60%]"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-black uppercase tracking-widest text-gray-900">Mention a User</h3>
              <button onClick={() => setShowUserPicker(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {spaceMembers.length > 0 ? (
                spaceMembers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setNewMessage(prev => {
                        const base = prev.endsWith('@') ? prev.slice(0, -1) : prev;
                        return base + (base.length === 0 || base.endsWith(' ') ? '' : ' ') + `@${u.displayName || u.email} `;
                      });
                      setShowUserPicker(false);
                    }}
                    className="w-full text-left p-4 rounded-[1.5rem] hover:bg-gray-50 flex items-center gap-4 transition-all border border-transparent hover:border-gray-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden">
                      <img src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <p className="font-bold text-sm text-gray-900">{u.displayName || u.email}</p>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center text-gray-400">
                  <p className="font-bold text-sm">No members available to mention.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      <Modal isOpen={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear Chat">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Are you sure you want to clear all messages in this chat? This action cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancel</button>
            <button onClick={handleClearChat} className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700">Clear Chat</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
