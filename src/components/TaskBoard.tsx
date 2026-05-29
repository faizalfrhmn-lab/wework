import { useState, useEffect, useCallback } from 'react';
import { Plus, ListTodo, X, ChevronLeft, ChevronRight, Minimize2, Maximize2, RefreshCw } from 'lucide-react';
import { Editor, Toolbar, BtnBold, BtnItalic, BtnLink, BtnBulletList, BtnNumberedList, EditorProvider } from 'react-simple-wysiwyg';
import { Task, UserProfile, Organization, AppUser } from '../types';
import { subscribeToTasks, createTask, addSubTask } from '../services/taskService';
import { subscribeToUsersByIds } from '../services/authService';
import TaskCard from './TaskCard';
import Modal from './Modal';

interface TaskBoardProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
  divisionId: string;
  selectedTaskId?: string | null;
  isFocusMode: boolean;
  setIsFocusMode: (v: boolean) => void;
  onClearSelectedTask?: () => void;
}

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function TaskBoard({ 
  user, 
  profile, 
  org, 
  divisionId, 
  selectedTaskId, 
  isFocusMode, 
  setIsFocusMode,
  onClearSelectedTask 
}: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  // Automatically expand the column containing the selectedTaskId if it is collapsed
  useEffect(() => {
    if (selectedTaskId && tasks.length > 0) {
      const selectedTask = tasks.find(t => t.id === selectedTaskId);
      if (selectedTask && selectedTask.status) {
        setCollapsedColumns(prev => prev.filter(status => status !== selectedTask.status));
      }
    }
  }, [selectedTaskId, tasks]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNote, setNewTaskNote] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('General');
  const [newTaskDeadline, setNewTaskDeadline] = useState(getTodayDateString());
  const [newTaskAmount, setNewTaskAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
  const [showOnlyMyTasks, setShowOnlyMyTasks] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [newTaskAssigneeIds, setNewTaskAssigneeIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<{ title: string; initialAmount: number }[]>([]);

  useEffect(() => {
    if (!isModalOpen) {
      setFormError(null);
    }
  }, [isModalOpen]);

  useEffect(() => {
    const unsub = subscribeToUsersByIds(org.members, setAllUsers);
    return unsub;
  }, [org.members]);

  useEffect(() => {
    const unsub = subscribeToTasks(divisionId, user.uid, setTasks, profile?.role === 'superadmin');
    return unsub;
  }, [divisionId, user.uid, profile]);

  const toggleColumnCollapse = (status: string) => {
    setCollapsedColumns(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const collapseAll = () => setCollapsedColumns([...categories]);
  const expandAll = () => setCollapsedColumns([]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // subscribeToTasks internally fetches immediately, so we can re-trigger it by changing a key if needed,
    // but here we just want to show the user that we are checking.
    // The easiest way is to just wait a second or re-run the fetch logic if we had it exposed.
    // For now, let's just use a timeout to simulate a refresh call to the subscription.
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const handleCreateTask = async (e: any) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    setFormError(null);
    setIsSubmitting(true);
    try {
      const deadlineVal = newTaskDeadline || getTodayDateString();
      const taskId = await createTask(
        org.id, 
        divisionId, 
        newTaskTitle.trim(), 
        newTaskCategory.trim(), 
        newTaskNote.trim(), 
        org.members,
        deadlineVal,
        newTaskCategory.toLowerCase().includes('finance') ? newTaskAmount : 0,
        newTaskAssigneeIds.length > 0 ? newTaskAssigneeIds : null,
        user.uid,
        profile?.displayName || user.displayName || user.email || 'Seseorang'
      );

      if (!taskId) {
         throw new Error('Database denied entry. Check RLS or connection.');
      }

      // Add subtasks if any were requested
      if (subtasks.length > 0) {
        for (const sub of subtasks) {
          if (sub.title.trim()) {
            await addSubTask(
              org.id,
              taskId,
              org.members,
              sub.title.trim(),
              '', // description
              '', // url
              sub.initialAmount || 0
            );
          }
        }
      }

      setNewTaskTitle('');
      setNewTaskNote('');
      setNewTaskCategory('General');
      setNewTaskDeadline(getTodayDateString());
      setNewTaskAmount(0);
      setNewTaskAssigneeIds([]);
      setSubtasks([]);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Task creation UI error:', err);
      setFormError(err.message || 'Gagal membuat tugas. Silakan cek koneksi internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ['todo', 'in-progress', 'review', 'revision', 'done'] as const;

  return (
    <>
    <div className={`h-full flex flex-col transition-all duration-500 ${isFocusMode ? 'bg-[#0079BF]' : 'bg-white'}`}>
       <div className={`px-10 py-6 transition-all duration-300 flex items-center justify-between shrink-0 ${
         isFocusMode ? 'bg-black/10 border-white/10 text-white' : 'bg-transparent'
       }`}>
          <div className="flex items-center gap-4">
             <div className={`flex items-center gap-1 p-1 rounded-xl ${
               isFocusMode ? 'bg-white/10' : 'bg-gray-50'
             }`}>
                <button 
                  onClick={expandAll}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isFocusMode ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-black'
                  }`}
                >
                  Expand
                </button>
                <div className={`w-[1px] h-3 ${isFocusMode ? 'bg-white/10' : 'bg-gray-200'}`} />
                <button 
                  onClick={collapseAll}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    isFocusMode ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-black'
                  }`}
                >
                  Collapse
                </button>
             </div>

             <button 
                onClick={handleRefresh}
                className={`p-2.5 rounded-xl transition-all ${
                  isFocusMode ? 'bg-white/10 text-white/60 hover:text-white' : 'bg-gray-100 text-gray-400 hover:text-black'
                } ${isRefreshing ? 'animate-spin' : ''}`}
                title="Refresh Tasks"
             >
                <RefreshCw className="w-3.5 h-3.5" />
             </button>

              <button 
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                  isFocusMode 
                    ? 'bg-white text-[#0079BF] shadow-xl' 
                    : 'bg-gray-900 text-white hover:bg-orange-500'
                }`}
             >
                {isFocusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {isFocusMode ? 'Exit focus' : 'Focus view'}
             </button>
             <button 
                onClick={() => setShowOnlyMyTasks(!showOnlyMyTasks)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                  showOnlyMyTasks
                    ? 'bg-orange-500 text-white shadow-xl' 
                    : isFocusMode ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
             >
                {showOnlyMyTasks ? 'Showing My Tasks' : 'Show My Tasks Only'}
             </button>
          </div>
          <div className="flex items-center gap-4">
             <span className={`text-[10px] font-bold uppercase tracking-widest opacity-30 ${isFocusMode ? 'text-white' : 'text-black'}`}>
                {tasks.length} Active Records
             </span>
          </div>
       </div>

       <div className={`flex-1 overflow-x-auto px-10 pb-10 transition-colors duration-500 ${isFocusMode ? 'bg-transparent' : 'bg-[#FAFAFA]'}`} style={{ overscrollBehaviorX: 'none' }}>
          <div className="flex gap-6 h-full min-w-max items-start">
            {categories.map((status) => {
              const isCollapsed = collapsedColumns.includes(status);
              const columnTasks = tasks.filter(t => {
                const isStatusMatch = t.status === status;
                const isAssigned = showOnlyMyTasks ? (t.assigneeId === user.uid || t.assigneeIds?.includes(user.uid)) : true;
                return isStatusMatch && isAssigned;
              });
              
              if (isCollapsed) {
                return (
                  <div 
                    key={status} 
                    className={`w-12 flex flex-col h-full rounded-[2rem] border shadow-sm overflow-hidden p-3 items-center group cursor-pointer transition-all ${
                      isFocusMode 
                        ? 'bg-white/10 border-white/10 text-white hover:bg-white/20' 
                        : 'bg-white border-black/5 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleColumnCollapse(status)}
                  >
                    <button className={`mb-8 transition-colors ${isFocusMode ? 'text-white/40 group-hover:text-white' : 'text-gray-400 group-hover:text-black'}`}>
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <div className="flex flex-col items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ring-4 shadow-sm ${
                        status === 'todo' ? 'bg-gray-400' : 
                        status === 'in-progress' ? 'bg-blue-500' : 
                        status === 'review' ? 'bg-orange-500' : 
                        status === 'revision' ? 'bg-red-500' : 'bg-green-500'
                      } ${isFocusMode ? 'ring-white/20' : 'ring-white'}`} />
                      <h3 className={`font-black uppercase tracking-tighter text-[10px] vertical-text whitespace-nowrap ${
                        isFocusMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {status.replace('-', ' ')}
                      </h3>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                        isFocusMode ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {columnTasks.length}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={status} className="w-80 flex flex-col h-full shrink-0">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        status === 'todo' ? 'bg-gray-400' : 
                        status === 'in-progress' ? 'bg-blue-500' : 
                        status === 'review' ? 'bg-orange-500' : 
                        status === 'revision' ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <h3 className={`font-bold uppercase tracking-widest text-[11px] ${
                        isFocusMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {status === 'todo' ? 'To Do' : status === 'in-progress' ? 'In Progress' : status === 'review' ? 'In Review' : status === 'revision' ? 'Revision' : 'Done'}
                      </h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isFocusMode ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {columnTasks.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {status === 'todo' && (
                        <button 
                          onClick={() => setIsModalOpen(true)}
                          className={`p-1 rounded-md transition-colors ${
                            isFocusMode ? 'hover:bg-white/10 text-white/40 hover:text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-black'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => toggleColumnCollapse(status)}
                        className={`p-1.5 rounded-lg transition-all ${
                          isFocusMode ? 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white' : 'bg-gray-100 hover:bg-black text-gray-400 hover:text-white'
                        }`}
                        title="Collapse Column"
                      >
                        <Minimize2 className="w-4 h-4 transition-transform" />
                      </button>
                    </div>
                  </div>

                  <div className={`flex-1 space-y-4 overflow-y-auto no-scrollbar pb-8 rounded-[2rem] transition-all p-4 ${
                    isFocusMode ? 'bg-black/10' : 'bg-transparent'
                  }`}>
                     {columnTasks.map((task: Task) => (
                       <TaskCard 
                        key={task.id} 
                        user={user} 
                        profile={profile}
                        org={org}
                        task={task} 
                        isSelected={task.id === selectedTaskId}
                        onCloseDetail={() => {
                          if (task.id === selectedTaskId && onClearSelectedTask) {
                            onClearSelectedTask();
                          }
                        }}
                       />
                     ))}
                     
                     {columnTasks.length === 0 && (
                       <div className="border-2 border-dashed border-gray-200 rounded-2xl h-24 flex items-center justify-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-300">No {status} tasks</p>
                       </div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
       </div>
    </div>
    
    <Modal 
      isOpen={isModalOpen} 
      onClose={() => setIsModalOpen(false)} 
      title="Create New Task"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleCreateTask} className="space-y-6">
        {formError && (
          <div className="p-4 bg-red-50 border border-red-250 rounded-2xl text-red-700 text-xs font-semibold leading-relaxed">
            {formError}
          </div>
        )}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Task Title</label>
          <input 
            autoFocus
            required
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
            placeholder="e.g. Design Landing Page"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Description / Note</label>
          <div className="border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-orange-500/10 focus-within:border-orange-500/30 transition-all bg-white">
            <EditorProvider>
              <Editor 
                value={newTaskNote}
                onChange={(e) => setNewTaskNote(e.target.value)}
              >
                <Toolbar>
                  <BtnBold />
                  <BtnItalic />
                  <BtnLink />
                  <BtnBulletList />
                  <BtnNumberedList />
                </Toolbar>
              </Editor>
            </EditorProvider>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Category</label>
            <select 
              required
              value={newTaskCategory}
              onChange={(e) => setNewTaskCategory(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
            >
              <option value="General">General</option>
              <option value="Finance">Finance</option>
              <option value="Marketing">Marketing</option>
              <option value="Design">Design</option>
              <option value="Development">Development</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Deadline (Optional)</label>
            <input 
              type="date"
              value={newTaskDeadline}
              onChange={(e) => setNewTaskDeadline(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
            />
          </div>
        </div>
        {newTaskCategory.toLowerCase().includes('finance') && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Initial Amount (Optional)</label>
            <input 
              type="number"
              value={newTaskAmount}
              onChange={(e) => setNewTaskAmount(Number(e.target.value))}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
              placeholder="e.g. 500000"
            />
          </div>
        )}

        {/* Dynamic Subtask/Sub-todo Creation block */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Subtask / Sub-todo(s)</label>
            <button
              type="button"
              onClick={() => setSubtasks(prev => [...prev, { title: '', initialAmount: 0 }])}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-orange-500 hover:text-orange-650 transition-all font-bold"
            >
              <Plus className="w-3.5 h-3.5 animate-pulse" />
              Add Subtask
            </button>
          </div>
          
          {subtasks.length > 0 && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 max-h-60 overflow-y-auto no-scrollbar">
              {subtasks.map((sub, index) => (
                <div key={index} className="flex items-center gap-3">
                  <input
                    required
                    type="text"
                    value={sub.title}
                    onChange={(e) => {
                      const updated = [...subtasks];
                      updated[index].title = e.target.value;
                      setSubtasks(updated);
                    }}
                    placeholder={`Subtask #${index + 1} Name`}
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/30 transition-all outline-none"
                  />
                  {newTaskCategory.toLowerCase().includes('finance') && (
                    <input
                      type="number"
                      value={sub.initialAmount || ''}
                      onChange={(e) => {
                        const updated = [...subtasks];
                        updated[index].initialAmount = Number(e.target.value);
                        setSubtasks(updated);
                      }}
                      placeholder="Amount"
                      className="w-32 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/30 transition-all outline-none"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSubtasks(prev => prev.filter((_, idx) => idx !== index));
                    }}
                    className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Delete Subtask"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {allUsers.length > 0 && (
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Assign To Users</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50/50 p-3 rounded-2xl border border-gray-100 max-h-48 overflow-y-auto no-scrollbar">
              {allUsers.map(u => {
                const isSelected = newTaskAssigneeIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setNewTaskAssigneeIds(prev => prev.filter(id => id !== u.id));
                      } else {
                        setNewTaskAssigneeIds(prev => [...prev, u.id]);
                      }
                    }}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-950 font-semibold'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs truncate">{u.displayName || u.email}</span>
                  </button>
                );
              })}
            </div>
            {newTaskAssigneeIds.length === 0 && (
              <p className="text-[11px] text-gray-400 italic">No one assigned yet. Defaults to self / unassigned.</p>
            )}
          </div>
        )}
        <button 
          type="submit" 
          disabled={isSubmitting || !newTaskTitle.trim()}
          className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95"
        >
          {isSubmitting ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </Modal>
    </>
  );
}

