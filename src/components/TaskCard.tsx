import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MoreVertical, 
  MessageSquare, 
  Paperclip, 
  Link as LinkIcon,
  CheckSquare,
  Clock,
  ChevronRight,
  PlusCircle,
  ExternalLink,
  Tag,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { Task, SubTask, LibraryItem, UserProfile, Organization, AppUser } from '../types';
import { subscribeToSubTasks, addSubTask, toggleSubTask, addTaskLink, updateTaskProgress, subscribeToLibraryItems, updateTaskStatus, updateSubTaskRevenue } from '../services/taskService';
import { subscribeToUserProfile } from '../services/authService';

interface TaskCardProps {
  key?: string | number;
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
  task: Task;
  isSelected?: boolean;
}

export default function TaskCard({ user, profile, org, task, isSelected }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(isSelected);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [taskLinks, setTaskLinks] = useState<LibraryItem[]>([]);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDesc, setNewSubtaskDesc] = useState('');
  const [newSubtaskUrl, setNewSubtaskUrl] = useState('');
  const [newSubtaskInitialAmount, setNewSubtaskInitialAmount] = useState<string>('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [assigneeProfile, setAssigneeProfile] = useState<UserProfile | null>(null);

  const handleAddSubTask = async (e: FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      await addSubTask(
        org.id, 
        task.id, 
        org.members, 
        newSubtaskTitle.trim(), 
        newSubtaskDesc.trim(), 
        newSubtaskUrl.trim(),
        Number(newSubtaskInitialAmount) || 0
      );
      setNewSubtaskTitle('');
      setNewSubtaskDesc('');
      setNewSubtaskUrl('');
      setNewSubtaskInitialAmount('');
      setShowAddSubtask(false);
    }
  };

  const handleAddLink = async (e: FormEvent) => {
    e.preventDefault();
    if (newLinkLabel.trim() && newLinkUrl.trim()) {
      await addTaskLink(
        org.id,
        task.id, 
        task.folderId, 
        newLinkLabel.trim(), 
        newLinkUrl.trim(), 
        org.members, 
        null, 
        'task'
      );
      setNewLinkLabel('');
      setNewLinkUrl('');
      setShowAddLink(false);
    }
  };

  const isManager = profile?.role === 'manager' || profile?.role === 'superadmin' || org.managerId === user.uid;
  const isRevenueEnabled = org.settings?.revenueEnabledDivisions?.includes(task.folderId) || 
                           org.settings?.revenueEnabledCategories?.includes(task.category || '');

  useEffect(() => {
    if (task.assigneeId) {
      const unsub = subscribeToUserProfile(task.assigneeId, setAssigneeProfile);
      return unsub;
    } else {
      setAssigneeProfile(null);
    }
  }, [task.assigneeId]);

  useEffect(() => {
    if (isExpanded || isSelected) {
      const isSuperadmin = profile?.role === 'superadmin';
      const unsubSubtasks = subscribeToSubTasks(task.id, user.uid, setSubtasks, isSuperadmin);
      const unsubLinks = subscribeToLibraryItems(task.folderId, user.uid, (links) => {
        setTaskLinks(links.filter(l => l.taskId === task.id));
      }, isSuperadmin);
      return () => {
        unsubSubtasks();
        unsubLinks();
      };
    }
  }, [isExpanded, isSelected, task.id, task.folderId, user.uid, profile?.role]);

  useEffect(() => {
    if (subtasks.length > 0) {
      const completedCount = subtasks.filter(s => s.completed).length;
      const progress = Math.round((completedCount / subtasks.length) * 100);
      if (progress !== task.progress) {
        updateTaskProgress(task.id, progress);
      }
    }
  }, [subtasks, task.id, task.progress]);

  const handleStatusUpdate = async (status: string) => {
    await updateTaskStatus(task.id, status, user.uid);
    if (status === 'done') {
      const messages = [
        "Luar biasa! Pekerjaan yang sangat solid.",
        "Kerja bagus! Tim bangga dengan pencapaian ini.",
        "Sempurna! Standar kualitas yang sangat tinggi.",
        "Mantap! Terus pertahankan performa hebat ini.",
        "Excellent! Task diselesaikan dengan sangat baik."
      ];
      setSuccessMsg(messages[Math.floor(Math.random() * messages.length)]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const handleUpdateSubtaskRevenue = (subtaskId: string, count: number, amount: number, proofUrl: string) => {
    updateSubTaskRevenue(task.id, subtaskId, count, amount, proofUrl);
  };

  const StatusButtons = () => (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-50">
      {task.status === 'todo' && (
        <button 
          onClick={(e) => { e.stopPropagation(); handleStatusUpdate('in-progress'); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors"
        >
          <ArrowRight className="w-3 h-3" />
          Start Work
        </button>
      )}
      {task.status === 'in-progress' && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); handleStatusUpdate('todo'); }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleStatusUpdate('review'); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-orange-100 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />
            Report Work
          </button>
        </>
      )}
      {task.status === 'review' && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); handleStatusUpdate('revision'); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Revision
          </button>
          {isManager && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleStatusUpdate('done'); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
          )}
        </>
      )}
      {task.status === 'revision' && (
        <button 
          onClick={(e) => { e.stopPropagation(); handleStatusUpdate('in-progress'); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Resume Work
        </button>
      )}
      {task.status === 'done' && (
        <div className="flex-1 py-1.5 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 text-center">
          <CheckSquare className="w-3 h-3" />
          Final Approved
        </div>
      )}
    </div>
  );

  return (
    <motion.div 
      layout
      transition={{ layout: { duration: 0.2 } }}
      className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all group cursor-pointer relative ${isSelected ? 'ring-4 ring-orange-500/20 border-orange-500 shadow-xl' : 'border-gray-100'}`}
      onClick={() => !isExpanded && setIsExpanded(true)}
    >
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-500/95 z-50 flex flex-col items-center justify-center text-center p-6 text-white"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <CheckCircle2 className="w-12 h-12 mb-4" />
            </motion.div>
            <h5 className="text-xl font-black mb-2 uppercase tracking-tight">Approved!</h5>
            <p className="text-sm font-bold text-white/90 leading-snug">{successMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 bg-gray-100 text-[#141414] text-[10px] font-black uppercase tracking-widest rounded-lg">
              {task.category || 'General'}
            </span>
            <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
               <Clock className="w-3 h-3" />
               {task.deadline}
            </span>
            {task.initialAmount !== undefined && task.initialAmount > 0 && (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
                 <DollarSign className="w-3 h-3" />
                 Init: Rp {task.initialAmount.toLocaleString()}
              </span>
            )}
            {task.amount !== undefined && task.amount > 0 && (
              <span className="px-2.5 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1">
                 <DollarSign className="w-3 h-3" />
                 Rev: Rp {task.amount.toLocaleString()}
              </span>
            )}
          </div>
          <button className="text-gray-300 hover:text-gray-600 transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <h4 className="font-bold text-gray-900 leading-tight mb-3 group-hover:text-orange-600 transition-colors">
          {task.title}
        </h4>

        {/* Progress Bar */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className="text-gray-400">Completion</span>
            <span className="text-orange-500">{task.progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${task.progress}%` }}
              className="h-full bg-orange-500"
            />
          </div>
        </div>

        {!isExpanded && <StatusButtons />}

        <div className="flex items-center justify-between pt-4 mt-1 border-t border-gray-50">
           <div className="flex items-center gap-4 text-gray-300">
             <div className="flex items-center gap-1.5" title="Links attached">
               <LinkIcon className="w-4 h-4" />
               <span className="text-[11px] font-bold">{taskLinks.length}</span>
             </div>
             <div className="flex items-center gap-1.5" title="Subtasks">
               <CheckSquare className="w-4 h-4" />
               <span className="text-[11px] font-bold">{subtasks.length}</span>
             </div>
           </div>
           <div className="flex items-center gap-2">
             <div className="flex flex-col items-end">
               <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400">Assignee</span>
               <span className="text-[10px] font-bold text-gray-600 max-w-[80px] truncate">
                 {assigneeProfile ? (assigneeProfile.displayName || assigneeProfile.email) : 'Unassigned'}
               </span>
             </div>
             <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-100 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
               {assigneeProfile?.photoURL ? (
                 <img src={assigneeProfile.photoURL} alt="" className="w-full h-full object-cover" />
               ) : (
                 <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${assigneeProfile?.displayName || task.assigneeId || '?'}`} alt="" />
               )}
             </div>
             <ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
           </div>
         </div>
       </div>

       {/* Approval Actions */}
         {profile?.role === 'superadmin' && task.status === 'review' && (
           <div className="px-6 py-4 bg-orange-50/50 border-y border-orange-100 flex items-center justify-between gap-4">
             <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">Review Request</span>
             <div className="flex gap-2">
               <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate('revision'); }} className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold">Reject</button>
               <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate('done'); }} className="px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold">Approve</button>
             </div>
           </div>
         )}
         {profile?.role !== 'superadmin' && task.status === 'in-progress' && (
           <div className="px-6 py-3 bg-gray-50 border-y border-black/5 flex justify-end">
             <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate('review'); }} className="px-6 py-2 bg-black text-white rounded-xl text-xs font-bold">Submit for Review</button>
           </div>
         )}

       <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100 bg-gray-50/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-6">
              <StatusButtons />

              {/* Note Section */}
              {task.note && (
                <div className="space-y-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Notes</p>
                  <p className="text-sm text-gray-600 italic">"{task.note}"</p>
                </div>
              )}

              {/* Subtasks Management */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <h5 className="text-[11px] font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                     <CheckSquare className="w-3.5 h-3.5" />
                     Sub-tasks
                   </h5>
                   <button 
                    onClick={() => setShowAddSubtask(!showAddSubtask)}
                    className="text-orange-500 hover:text-orange-600 transition-colors"
                   >
                     <PlusCircle className="w-4 h-4" />
                   </button>
                </div>

                <div className="space-y-3">
                  {subtasks.map((st) => (
                    <div key={st.id} className="p-4 bg-white border border-gray-100 rounded-2xl transition-all group/st shadow-sm space-y-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => toggleSubTask(task.id, st.id, !st.completed)}
                          className={`w-5 h-5 rounded-[0.5rem] border flex items-center justify-center transition-colors ${
                            st.completed ? 'bg-green-500 border-green-500' : 'border-gray-300'
                          }`}
                        >
                           {st.completed && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </button>
                        <span className={`text-sm font-bold flex-1 ${st.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {st.title}
                        </span>
                        {st.url && (
                          <a 
                            href={st.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-500 hover:text-indigo-600 p-1"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      {/* Revenue Inputs for Revenue-Enabled Categories/Divisions */}
                      {isRevenueEnabled && task.status === 'in-progress' && (
                        <div className="space-y-3 pl-8">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Closing Count</label>
                              <input 
                                type="number"
                                defaultValue={st.closingCount}
                                onBlur={(e) => handleUpdateSubtaskRevenue(st.id, Number(e.target.value), st.closingAmount || 0, st.proofUrl || '')}
                                className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/10"
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nominal Closing</label>
                              <input 
                                type="number"
                                defaultValue={st.closingAmount}
                                onBlur={(e) => handleUpdateSubtaskRevenue(st.id, st.closingCount || 0, Number(e.target.value), st.proofUrl || '')}
                                className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/10"
                                placeholder="Rp 0"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              <LinkIcon className="w-2.5 h-2.5" />
                              Bukti Pembayaran (URL)
                            </label>
                            <input 
                              type="url"
                              defaultValue={st.proofUrl}
                              onBlur={(e) => handleUpdateSubtaskRevenue(st.id, st.closingCount || 0, st.closingAmount || 0, e.target.value)}
                              className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/10"
                              placeholder="https://..."
                            />
                            {st.proofUrl && (
                              <a 
                                href={st.proofUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-indigo-500 hover:text-indigo-600 underline"
                              >
                                View Proof <ExternalLink className="w-2 h-2" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Show amounts if present and completed */}
                      {(st.initialAmount !== undefined || st.closingAmount !== undefined) && (
                        <div className="flex flex-wrap gap-3 pl-8 pb-1">
                          {st.initialAmount !== undefined && st.initialAmount > 0 && (
                            <div className="text-[9px] font-black uppercase tracking-tight text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                              Init: Rp {st.initialAmount.toLocaleString()}
                            </div>
                          )}
                          {st.closingAmount !== undefined && st.closingAmount > 0 && (
                            <div className="text-[9px] font-black uppercase tracking-tight text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                              Closed: Rp {st.closingAmount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {st.description && (
                        <p className={`text-xs ml-8 ${st.completed ? 'text-gray-300' : 'text-gray-400'} italic`}>
                          {st.description}
                        </p>
                      )}
                    </div>
                  ))}
                  
                  {showAddSubtask && (
                    <form onSubmit={handleAddSubTask} className="mt-2 space-y-2 bg-white p-4 rounded-2xl border border-gray-200">
                      <input 
                        autoFocus
                        type="text"
                        required
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Step title..."
                        className="w-full text-sm font-bold bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500/20 outline-none"
                      />
                      <textarea 
                        value={newSubtaskDesc}
                        onChange={(e) => setNewSubtaskDesc(e.target.value)}
                        placeholder="Description..."
                        rows={2}
                        className="w-full text-xs bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500/20 outline-none resize-none"
                      />
                      <input 
                        type="url"
                        value={newSubtaskUrl}
                        onChange={(e) => setNewSubtaskUrl(e.target.value)}
                        placeholder="Reference URL (optional)"
                        className="w-full text-xs bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500/20 outline-none"
                      />
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Initial Amount (Optional)</label>
                        <input 
                          type="number"
                          value={newSubtaskInitialAmount}
                          onChange={(e) => setNewSubtaskInitialAmount(e.target.value)}
                          placeholder="0"
                          className="w-full text-xs font-bold bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500/20 outline-none"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button 
                          type="button" 
                          onClick={() => setShowAddSubtask(false)}
                          className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit" 
                          className="flex-[2] bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-orange-500 transition-colors"
                        >
                          Add Step
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Links Management */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                   <h5 className="text-[11px] font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                     <LinkIcon className="w-3.5 h-3.5" />
                     Pinned Links
                   </h5>
                   <button 
                    onClick={() => setShowAddLink(!showAddLink)}
                    className="text-orange-500 hover:text-orange-600 transition-colors"
                   >
                     <PlusCircle className="w-4 h-4" />
                   </button>
                </div>

                {showAddLink && (
                  <form onSubmit={handleAddLink} className="space-y-2 bg-white p-4 rounded-2xl border border-gray-200">
                    <input 
                      type="text"
                      required
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      placeholder="Label (e.g. Design Doc)"
                      className="w-full text-xs font-bold bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-0 shadow-inner"
                    />
                    <input 
                      type="url"
                      required
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="Link URL"
                      className="w-full text-xs bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-0 shadow-inner"
                    />
                    <button type="submit" className="w-full bg-black text-white text-[10px] font-black uppercase py-4 rounded-xl active:scale-95 shadow-xl hover:bg-orange-500 transition-all">Add Link</button>
                  </form>
                )}

                <div className="space-y-2">
                   {taskLinks.map((link) => (
                     <a 
                       key={link.id} 
                       href={link.url} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-indigo-500/30 transition-all group/link shadow-sm"
                     >
                        <div className="p-2 container bg-indigo-50 text-indigo-500 rounded-xl">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-gray-700 flex-1 truncate">{link.label}</span>
                        <div className="opacity-0 group-hover/link:opacity-100 transition-opacity">
                           <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                     </a>
                   ))}
                </div>
              </div>

              <button 
                onClick={() => setIsExpanded(false)}
                className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 border-t border-gray-50 transition-colors"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
