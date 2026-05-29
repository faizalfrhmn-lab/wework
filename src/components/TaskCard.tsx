import { useState, useEffect, useRef, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import Modal from "./Modal";
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
  DollarSign,
  Send,
  AtSign,
} from "lucide-react";
import {
  Task,
  SubTask,
  LibraryItem,
  UserProfile,
  Organization,
  AppUser,
} from "../types";
import {
  subscribeToSubTasks,
  addSubTask,
  toggleSubTask,
  addTaskLink,
  updateTaskProgress,
  subscribeToLibraryItems,
  updateTaskStatus,
  updateSubTaskRevenue,
  updateTaskAssignee,
  updateTaskNote,
} from "../services/taskService";
import {
  sendMessage,
  subscribeToTaskComments,
} from "../services/chatService";
import {
  subscribeToUserProfile,
  subscribeToUsersByIds,
} from "../services/authService";
import {
  Editor,
  Toolbar,
  BtnBold,
  BtnItalic,
  BtnLink,
  BtnBulletList,
  BtnNumberedList,
  EditorProvider,
} from "react-simple-wysiwyg";

interface TaskCardProps {
  key?: string | number;
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
  task: Task;
  isSelected?: boolean;
  onCloseDetail?: () => void;
  popupOnly?: boolean;
}

export default function TaskCard({
  user,
  profile,
  org,
  task,
  isSelected,
  onCloseDetail,
  popupOnly = false,
}: TaskCardProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(isSelected || false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setShowAddSubtask(false);
      setShowAddLink(false);
    }
  }, [isEditing]);
  const cardRef = useRef<HTMLDivElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [taskLinks, setTaskLinks] = useState<LibraryItem[]>([]);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [note, setNote] = useState(task.note || "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDesc, setNewSubtaskDesc] = useState("");
  const [newSubtaskUrl, setNewSubtaskUrl] = useState("");
  const [newSubtaskInitialAmount, setNewSubtaskInitialAmount] =
    useState<string>("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [assigneeProfiles, setAssigneeProfiles] = useState<UserProfile[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<UserProfile[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentSuggestions, setCommentSuggestions] = useState<UserProfile[]>([]);
  const [showCommentSuggestions, setShowCommentSuggestions] = useState(false);

  useEffect(() => {
    if (task.note !== undefined) {
      setNote(task.note);
    }
  }, [task.note]);

  useEffect(() => {
    if (isSelected) {
      setIsDetailOpen(true);

      // Perform multi-stage scrolling to ensure accurate positioning
      // as layout shifts and dynamic height items (subtasks, links) are injected.
      const scrollHandler = () => {
        cardRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      };

      const timer1 = setTimeout(scrollHandler, 150);
      const timer2 = setTimeout(scrollHandler, 500);
      const timer3 = setTimeout(scrollHandler, 1000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    } else {
      setIsDetailOpen(false);
    }
  }, [isSelected]);

  useEffect(() => {
    if (isDetailOpen && isSelected && (window as any).__scrollToComments) {
      const scrollTimer = setTimeout(() => {
        commentsSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        // Highlight the comments block momentarily to capture attention
        const commentsBlock = commentsSectionRef.current;
        if (commentsBlock) {
          commentsBlock.classList.add("ring-4", "ring-orange-500/20", "bg-orange-50/5", "rounded-3xl", "p-4");
          setTimeout(() => {
            commentsBlock.classList.remove("ring-4", "ring-orange-500/20", "bg-orange-50/5");
          }, 3000);
        }
        (window as any).__scrollToComments = false;
      }, 700);
      return () => clearTimeout(scrollTimer);
    }
  }, [isDetailOpen, isSelected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        assigneeDropdownRef.current &&
        !assigneeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (org?.members && org.members.length > 0) {
      const unsub = subscribeToUsersByIds(org.members, setMemberProfiles);
      return unsub;
    }
  }, [org?.members]);

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
        Number(newSubtaskInitialAmount) || 0,
      );
      setNewSubtaskTitle("");
      setNewSubtaskDesc("");
      setNewSubtaskUrl("");
      setNewSubtaskInitialAmount("");
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
        "task",
      );
      setNewLinkLabel("");
      setNewLinkUrl("");
      setShowAddLink(false);
    }
  };

  const formatCommentDate = (createdAtString: any) => {
    if (!createdAtString) return "";
    try {
      const d = new Date(createdAtString);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

  const handleCommentChange = (text: string) => {
    setNewComment(text);
    
    const words = text.split(/\s/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith("@")) {
      const query = lastWord.substring(1).toLowerCase();
      const filtered = memberProfiles.filter((p) => {
        const name = (p.displayName || p.email || "").toLowerCase();
        return name.includes(query);
      });
      setCommentSuggestions(filtered);
      setShowCommentSuggestions(filtered.length > 0);
    } else {
      setShowCommentSuggestions(false);
    }
  };

  const insertCommentMention = (prof: UserProfile) => {
    const words = newComment.split(/\s/);
    words[words.length - 1] = `@${prof.displayName || prof.email} `;
    setNewComment(words.join(" "));
    setShowCommentSuggestions(false);
  };

  const handleSendComment = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const txt = newComment.trim();
    if (!txt) return;

    try {
      setNewComment("");
      setShowCommentSuggestions(false);
      
      const userName = profile?.displayName || user.displayName || user.email || 'Anonymous';
      
      await sendMessage(
        org.id,
        user.uid,
        userName,
        txt,
        org.members,
        memberProfiles,
        task.folderId,
        task.id,
        task.folderId,
        task.title
      );
    } catch (err) {
      console.error("Error sending comment:", err);
    }
  };

  const renderCommentText = (text: string) => {
    if (!text) return "";
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, idx) => {
      if (token.startsWith("@")) {
        return (
          <span key={idx} className="font-bold text-orange-600 bg-orange-50/80 px-1.5 py-0.5 rounded-md inline-block">
            {token}
          </span>
        );
      }
      return token;
    });
  };

  const isManager =
    profile?.role === "manager" ||
    profile?.role === "superadmin" ||
    org.managerId === user.uid;
  const isRevenueEnabled =
    org.settings?.revenueEnabledDivisions?.includes(task.folderId) ||
    org.settings?.revenueEnabledCategories?.includes(task.category || "");

  useEffect(() => {
    const ids = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
    if (ids.length > 0) {
      const unsub = subscribeToUsersByIds(ids, setAssigneeProfiles);
      return unsub;
    } else {
      setAssigneeProfiles([]);
    }
  }, [task.assigneeId, task.assigneeIds]);

  useEffect(() => {
    if (isDetailOpen || isSelected) {
      const isSuperadmin = profile?.role === "superadmin";
      const unsubSubtasks = subscribeToSubTasks(
        task.id,
        user.uid,
        setSubtasks,
        isSuperadmin,
      );
      const unsubLinks = subscribeToLibraryItems(
        task.folderId,
        user.uid,
        (links) => {
          setTaskLinks(links.filter((l) => l.taskId === task.id));
        },
        isSuperadmin,
      );
      const unsubComments = subscribeToTaskComments(
        task.id,
        (commentsData) => {
          setComments(commentsData);
        }
      );
      return () => {
        unsubSubtasks();
        unsubLinks();
        unsubComments();
      };
    }
  }, [isDetailOpen, isSelected, task.id, task.folderId, user.uid, profile?.role]);

  useEffect(() => {
    if (subtasks.length > 0) {
      const completedCount = subtasks.filter((s) => s.completed).length;
      const progress = Math.round((completedCount / subtasks.length) * 100);
      if (progress !== task.progress) {
        updateTaskProgress(task.id, progress);
      }
    }
  }, [subtasks, task.id, task.progress]);

  const handleStatusUpdate = async (status: string) => {
    await updateTaskStatus(task.id, status, user.uid);
    if (status === "done") {
      const messages = [
        "Luar biasa! Pekerjaan yang sangat solid.",
        "Kerja bagus! Tim bangga dengan pencapaian ini.",
        "Sempurna! Standar kualitas yang sangat tinggi.",
        "Mantap! Terus pertahankan performa hebat ini.",
        "Excellent! Task diselesaikan dengan sangat baik.",
      ];
      setSuccessMsg(messages[Math.floor(Math.random() * messages.length)]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const handleUpdateSubtaskRevenue = (
    subtaskId: string,
    count: number,
    amount: number,
    proofUrl: string,
  ) => {
    updateSubTaskRevenue(task.id, subtaskId, count, amount, proofUrl);
  };

  const StatusButtons = ({ disabled = false }: { disabled?: boolean }) => (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-50">
      {task.status === "todo" && (
        <button
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleStatusUpdate("in-progress");
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowRight className="w-3 h-3" />
          Start Work
        </button>
      )}
      {task.status === "in-progress" && (
        <>
          <button
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusUpdate("todo");
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusUpdate("review");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-orange-50 text-orange-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-3 h-3" />
            Report Work
          </button>
        </>
      )}
      {task.status === "review" && (
        <>
          <button
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              handleStatusUpdate("revision");
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3 h-3" />
            Revision
          </button>
          {isManager && (
            <button
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                handleStatusUpdate("done");
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
            >
              <CheckCircle2 className="w-3 h-3" />
              Approve
            </button>
          )}
        </>
      )}
      {task.status === "revision" && (
        <button
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleStatusUpdate("in-progress");
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3 h-3" />
          Resume Work
        </button>
      )}
      {task.status === "done" && (
        <button
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            handleStatusUpdate("revision");
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3 h-3" />
          Reject to Revision
        </button>
      )}
    </div>
  );

  return (
    <motion.div
      ref={cardRef}
      layout={!popupOnly}
      transition={{ layout: { duration: 0.2 } }}
      className={popupOnly ? "pointer-events-none border-none bg-transparent w-0 h-0 max-w-0 max-h-0 p-0 m-0 overflow-visible select-none" : `bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all group cursor-pointer relative ${
        isSelected
          ? "ring-4 ring-orange-500/30 border-orange-500 border-l-8 border-l-orange-500 shadow-2xl bg-orange-50/10 scale-[1.02]"
          : "border-gray-100"
      }`}
      onClick={popupOnly ? undefined : () => setIsDetailOpen(true)}
    >
      {!popupOnly && (
        <>
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
            <h5 className="text-xl font-black mb-2 uppercase tracking-tight">
              Approved!
            </h5>
            <p className="text-sm font-bold text-white/90 leading-snug">
              {successMsg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 bg-gray-100 text-[#141414] text-[10px] font-black uppercase tracking-widest rounded-lg">
              {task.category || "General"}
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

        <StatusButtons />

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
              <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400">
                Assignee
              </span>
              <span className="text-[10px] font-bold text-gray-600 max-w-[80px] truncate">
                {assigneeProfiles.length > 0
                  ? assigneeProfiles
                      .map((ap) => ap.displayName || ap.email.split("@")[0])
                      .join(", ")
                  : "Unassigned"}
              </span>
            </div>
            <div className="flex items-center">
              {assigneeProfiles.length > 0 ? (
                <div className="flex -space-x-1.5 overflow-hidden max-w-[70px]">
                  {assigneeProfiles.slice(0, 3).map((ap, idx) => (
                    <div
                      key={ap.id}
                      style={{ zIndex: assigneeProfiles.length - idx }}
                      className="w-7 h-7 rounded-full bg-orange-50 border-2 border-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm"
                      title={ap.displayName || ap.email}
                    >
                      {ap.photoURL ? (
                        <img
                          src={ap.photoURL}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ap.id}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                  {assigneeProfiles.length > 3 && (
                    <div
                      className="w-7 h-7 rounded-full bg-gray-100 border-2 border-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm z-10"
                      title={`${assigneeProfiles.length - 3} others`}
                    >
                      <span className="text-[8px] font-black text-gray-500">
                        +{assigneeProfiles.length - 3}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-orange-50 border border-orange-100 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=unknown`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
            <ChevronRight
              className={`w-3 h-3 text-gray-400 transition-transform ${isDetailOpen ? "rotate-90" : ""}`}
            />
          </div>
        </div>
      </div>
      </>
      )}

      <Modal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setIsEditing(false);
          if (onCloseDetail) {
            onCloseDetail();
          }
        }}
        title={task.title}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-6">
          {/* Status Bar / Mode Toggle */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Mode: 
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors ${isEditing ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {isEditing ? 'Editing Mode' : 'View Mode'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 border ${
                isEditing
                  ? 'bg-orange-600 border-orange-500 text-white hover:bg-orange-700 shadow-md shadow-orange-500/10'
                  : 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100'
              }`}
            >
              {isEditing ? (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Selesai
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit
                </>
              )}
            </button>
          </div>

          {/* Assignees Selection */}
          <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-150 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-450">
                Penerima Tugas & Delegasi (Assignees)
              </span>
              {isEditing && isManager && (
                <div className="relative" ref={assigneeDropdownRef}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen);
                    }}
                    className="px-3 py-1 bg-orange-600/10 hover:bg-orange-600/20 text-orange-600 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    + Atur Delegasi
                  </button>

                  <AnimatePresence>
                    {isAssigneeDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-black/5 py-2 z-[110] max-h-60 overflow-y-auto no-scrollbar"
                      >
                        <div className="px-3 py-1 border-b border-gray-50 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block pb-1">
                            Tugaskan Ke (Banyak)
                          </span>
                        </div>

                        {memberProfiles.map((u) => {
                          const isSelected = (
                            task.assigneeIds ||
                            (task.assigneeId ? [task.assigneeId] : [])
                          ).includes(u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={async () => {
                                let currentIds =
                                  task.assigneeIds ||
                                  (task.assigneeId ? [task.assigneeId] : []);
                                let newIds: string[];
                                if (isSelected) {
                                  newIds = currentIds.filter(
                                    (id) => id !== u.id,
                                  );
                                } else {
                                  newIds = [...currentIds, u.id];
                                }
                                await updateTaskAssignee(
                                  task.id,
                                  newIds,
                                  org.id,
                                  user.uid,
                                  profile?.displayName ||
                                    user.displayName ||
                                    user.email ||
                                    "Seseorang",
                                );
                              }}
                              className={`w-full text-left px-4 py-2 text-[11px] font-bold hover:bg-gray-50 flex items-center justify-between ${
                                isSelected
                                  ? "text-orange-500 bg-orange-50/20"
                                  : "text-gray-600"
                              }`}
                            >
                              <span className="truncate flex-1">
                                {u.displayName || u.email}
                              </span>
                              <div
                                className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                                  isSelected
                                    ? "bg-orange-500 border-orange-505 text-white"
                                    : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    className="w-2.5 h-2.5 stroke-[3]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center shrink-0">
                {assigneeProfiles.length > 0 ? (
                  <div className="flex -space-x-1.5 overflow-hidden">
                    {assigneeProfiles.map((ap) => (
                      <div
                        key={ap.id}
                        className="w-8 h-8 rounded-full bg-orange-50 border border-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm"
                        title={ap.displayName || ap.email}
                      >
                        {ap.photoURL ? (
                          <img
                            src={ap.photoURL}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ap.id}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-50 border border-orange-100 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=unknown`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-700">
                  {assigneeProfiles.length > 0
                    ? assigneeProfiles.map(ap => ap.displayName || ap.email).join(", ")
                    : "Belum ditugaskan (Unassigned)"
                  }
                </span>
                <span className="text-[10px] text-gray-400">
                  {assigneeProfiles.length > 0 ? `${assigneeProfiles.length} orang ditugaskan` : 'Tugas ini terbuka untuk diambil'}
                </span>
              </div>
            </div>
          </div>

          {/* Note Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                Notes/Description
              </label>
              {isEditing && note !== (task.note || "") && (
                <button
                  type="button"
                  onClick={() => {
                    updateTaskNote(task.id, note);
                  }}
                  className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Save Note
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-orange-500/10 focus-within:border-orange-500/30 transition-all bg-white">
                <EditorProvider>
                  <Editor
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
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
            ) : (
              <div 
                className="p-5 bg-white border border-gray-100 rounded-2xl text-sm text-[#141414] leading-relaxed outline-none min-h-[100px] prose prose-sm max-w-none shadow-sm"
                dangerouslySetInnerHTML={{ 
                  __html: note || '<p class="text-xs text-gray-400 italic">No notes or description provided for this task.</p>' 
                }}
              />
            )}
          </div>

          {/* Subtasks Management */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-black uppercase tracking-widest text-gray-800 flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5" />
                Sub-tasks
              </h5>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowAddSubtask(!showAddSubtask)}
                  className="text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              {subtasks.map((st) => (
                <div
                  key={st.id}
                  className="p-4 bg-white border border-gray-100 rounded-2xl transition-all group/st shadow-sm space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!isEditing}
                      onClick={() =>
                        toggleSubTask(task.id, st.id, !st.completed)
                      }
                      className={`w-5 h-5 rounded-[0.5rem] border flex items-center justify-center transition-colors ${
                        st.completed
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300"
                      } ${!isEditing ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      {st.completed && (
                        <CheckSquare className="w-3.5 h-3.5 text-white" />
                      )}
                    </button>
                    <span
                      className={`text-sm font-bold flex-1 ${st.completed ? "text-gray-400 line-through" : "text-gray-700"}`}
                    >
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
                  {isRevenueEnabled && task.status === "in-progress" && (
                    <div className="space-y-3 pl-8">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Closing Count
                          </label>
                          <input
                            type="number"
                            disabled={!isEditing}
                            defaultValue={st.closingCount}
                            onBlur={(e) =>
                              handleUpdateSubtaskRevenue(
                                st.id,
                                Number(e.target.value),
                                st.closingAmount || 0,
                                st.proofUrl || "",
                              )
                            }
                            className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Nominal Closing
                          </label>
                          <input
                            type="number"
                            disabled={!isEditing}
                            defaultValue={st.closingAmount}
                            onBlur={(e) =>
                              handleUpdateSubtaskRevenue(
                                st.id,
                                st.closingCount || 0,
                                Number(e.target.value),
                                st.proofUrl || "",
                              )
                            }
                            className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
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
                          disabled={!isEditing}
                          defaultValue={st.proofUrl}
                          onBlur={(e) =>
                            handleUpdateSubtaskRevenue(
                              st.id,
                              st.closingCount || 0,
                              st.closingAmount || 0,
                              e.target.value,
                            )
                          }
                          className="w-full bg-gray-50 border-none rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:ring-2 focus:ring-orange-500/10 disabled:opacity-60 disabled:cursor-not-allowed"
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
                  {(st.initialAmount !== undefined ||
                    st.closingAmount !== undefined) && (
                    <div className="flex flex-wrap gap-3 pl-8 pb-1">
                      {st.initialAmount !== undefined &&
                        st.initialAmount > 0 && (
                          <div className="text-[9px] font-black uppercase tracking-tight text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            Init: Rp {st.initialAmount.toLocaleString()}
                          </div>
                        )}
                      {st.closingAmount !== undefined &&
                        st.closingAmount > 0 && (
                          <div className="text-[9px] font-black uppercase tracking-tight text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">
                            Closed: Rp {st.closingAmount.toLocaleString()}
                          </div>
                        )}
                    </div>
                  )}

                  {st.description && (
                    <p
                      className={`text-xs ml-8 ${st.completed ? "text-gray-300" : "text-gray-400"} italic`}
                    >
                      {st.description}
                    </p>
                  )}
                </div>
              ))}

              {isEditing && showAddSubtask && (
                <form
                  onSubmit={handleAddSubTask}
                  className="mt-2 space-y-2 bg-white p-4 rounded-2xl border border-gray-200"
                >
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
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                      Initial Amount (Optional)
                    </label>
                    <input
                      type="number"
                      value={newSubtaskInitialAmount}
                      onChange={(e) =>
                        setNewSubtaskInitialAmount(e.target.value)
                      }
                      placeholder="0"
                      className="w-full text-xs font-bold bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500/20 outline-none"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddSubtask(false)}
                      className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 rounded-xl transition-colors border border-gray-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-[2] bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-orange-500 transition-colors cursor-pointer"
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
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowAddLink(!showAddLink)}
                  className="text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {isEditing && showAddLink && (
              <form
                onSubmit={handleAddLink}
                className="space-y-2 bg-white p-4 rounded-2xl border border-gray-200"
              >
                <input
                  type="text"
                  required
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="Label (e.g. Design Doc)"
                  className="w-full text-xs font-bold bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-0 shadow-inner outline-none"
                />
                <input
                  type="url"
                  required
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="Link URL"
                  className="w-full text-xs bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-0 shadow-inner outline-none"
                />
                <button
                  type="submit"
                  className="w-full bg-black text-white text-[10px] font-black uppercase py-4 rounded-xl active:scale-95 shadow-xl hover:bg-orange-500 transition-all cursor-pointer"
                >
                  Add Link
                </button>
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
                  <span className="text-xs font-black text-gray-700 flex-1 truncate">
                    {link.label}
                  </span>
                  <div className="opacity-0 group-hover/link:opacity-100 transition-opacity">
                    <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Task Workflow Status */}
          <div className="bg-gray-50/75 p-4 rounded-2xl border border-gray-150 space-y-2 mt-4">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-500">
              Task Workflow Status
            </span>
            <StatusButtons disabled={false} />
          </div>

          {/* Flow Approval Controls inside Modal */}
          {profile?.role === "superadmin" && task.status === "review" && (
            <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-center justify-between gap-4 mt-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                Review Request
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusUpdate("revision");
                  }}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-xl text-xs font-bold hover:bg-red-200 transition-colors cursor-pointer"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusUpdate("done");
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-colors cursor-pointer"
                >
                  Approve
                </button>
              </div>
            </div>
          )}
          {profile?.role !== "superadmin" && task.status === "in-progress" && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-black/5 flex justify-between items-center mt-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Submit Work
              </span>
              <button
                type="button"
                disabled={false}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate("review");
                }}
                className="px-6 py-2 bg-black text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Submit for Review
              </button>
            </div>
          )}

          {/* Comments & Activity Section */}
          <div ref={commentsSectionRef} className="border-t border-gray-100 pt-6 space-y-4 transition-all duration-500">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <h5 className="text-[11px] font-black uppercase tracking-widest text-gray-800">
                Comments & Mentions ({comments.length})
              </h5>
            </div>

            {/* Comments List */}
            <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 scrollbar-thin">
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2 text-center">
                  Belum ada komentar. Tulis komentar atau mention anggota tim di bawah ini.
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                    <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden shrink-0 shadow-sm">
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.senderName || comment.senderId}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-black text-gray-800 truncate">
                          {comment.senderName}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400">
                          {formatCommentDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 break-words leading-relaxed">
                        {renderCommentText(comment.text)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Write Comment Form */}
            <form onSubmit={handleSendComment} className="relative space-y-2">
              {/* Mentions Autoplay suggestions list overlay */}
              {showCommentSuggestions && commentSuggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 max-h-[160px] overflow-y-auto p-1.5 space-y-1">
                  <div className="px-2.5 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-50">
                    Sebut / Mention Anggota:
                  </div>
                  {commentSuggestions.map((prof) => (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => insertCommentMention(prof)}
                      className="w-full flex items-center gap-3 px-2.5 py-2 hover:bg-orange-50 rounded-xl transition-all cursor-pointer text-left group"
                    >
                      <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-gray-100">
                        <img
                          src={prof.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${prof.displayName || prof.email}`}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-700 group-hover:text-orange-600 truncate">
                          {prof.displayName || prof.email}
                        </div>
                        <div className="text-[9px] font-medium text-gray-400 truncate">
                          {prof.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Text Area and Send Button */}
              <div className="relative flex items-center bg-gray-50 border border-gray-201 focus-within:border-orange-500 rounded-2xl px-3 py-2 transition-all shadow-inner">
                <textarea
                  rows={2}
                  value={newComment}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  placeholder="Kirim komentar atau ketik @ untuk menyebut..."
                  className="flex-1 text-xs font-medium bg-transparent border-none focus:ring-0 outline-none resize-none pt-1.5 pb-1 text-gray-700 placeholder-gray-400 scrollbar-none pr-10"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="absolute right-3.5 bottom-3 text-white bg-orange-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:opacity-40 p-2 rounded-xl transition-all hover:bg-orange-600 cursor-pointer disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-md shadow-orange-500/10 flex items-center justify-center"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Mention Pills */}
              {memberProfiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Sebut Cepat:</span>
                  {memberProfiles.filter(p => p.id !== user.uid).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        const mentionText = `@${p.displayName || p.email} `;
                        if (newComment.includes(mentionText)) return;
                        setNewComment(prev => prev + (prev.endsWith(" ") || prev === "" ? "" : " ") + mentionText);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full hover:bg-orange-50 hover:border-orange-200 transition-all text-[10px] font-bold text-gray-600 hover:text-orange-600 shadow-sm cursor-pointer"
                    >
                      <img
                        src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.displayName || p.email}`}
                        className="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                        alt=""
                      />
                      <span>{p.displayName || p.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsDetailOpen(false);
              setIsEditing(false);
              if (onCloseDetail) {
                onCloseDetail();
              }
            }}
            className="w-full py-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-901 border-t border-gray-100 transition-colors pt-4 mt-6 cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}
