import { useState, useEffect } from 'react';
import { Plus, ListTodo, X, ChevronLeft, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';
import { Task, UserProfile, Organization, AppUser } from '../types';
import { subscribeToTasks, createTask } from '../services/taskService';
import { getAllUsers } from '../services/authService';
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
}

export default function TaskBoard({ user, profile, org, divisionId, selectedTaskId, isFocusMode, setIsFocusMode }: TaskBoardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('General');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [newTaskAmount, setNewTaskAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<string>('');

  useEffect(() => {
    if (profile?.role === 'superadmin') {
      const unsub = getAllUsers(setAllUsers);
      return unsub;
    }
  }, [profile]);

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

  const handleCreateTask = async (e: any) => {
    e.preventDefault();
    if (newTaskTitle.trim() && newTaskDeadline) {
      setIsSubmitting(true);
      try {
        await createTask(
          org.id, 
          divisionId, 
          newTaskTitle.trim(), 
          newTaskCategory.trim(), 
          '', 
          org.members,
          newTaskDeadline,
          newTaskCategory.toLowerCase().includes('finance') ? newTaskAmount : 0,
          newTaskAssigneeId || null
        );
        setNewTaskTitle('');
        setNewTaskCategory('General');
        setNewTaskDeadline('');
        setNewTaskAmount(0);
        setNewTaskAssigneeId('');
        setIsModalOpen(false);
      } finally {
        setIsSubmitting(false);
      }
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
              const columnTasks = tasks.filter(t => t.status === status);
              
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
    >
      <form onSubmit={handleCreateTask} className="space-y-6">
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
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Deadline</label>
            <input 
              required
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
        {profile?.role === 'superadmin' && allUsers.length > 0 && (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Assign To User</label>
            <select 
              value={newTaskAssigneeId}
              onChange={(e) => setNewTaskAssigneeId(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-orange-500/10 focus:bg-white transition-all outline-none"
            >
              <option value="">Self (Unassigned)</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.displayName || u.email} ({u.role})</option>
              ))}
            </select>
          </div>
        )}
        <button 
          type="submit" 
          disabled={isSubmitting || !newTaskTitle.trim() || !newTaskDeadline}
          className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-xl disabled:opacity-30 flex items-center justify-center gap-2 active:scale-95"
        >
          {isSubmitting ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </Modal>
    </>
  );
}

