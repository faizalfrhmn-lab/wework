import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Task, AppUser, UserProfile, Organization } from '../types';
import { subscribeToOrgTasks } from '../services/taskService';
import { Target, ListTodo, TrendingUp, Activity } from 'lucide-react';

interface DashboardViewProps {
  user: AppUser;
  profile: UserProfile | null;
  org: Organization;
}

export default function DashboardView({ user, profile, org }: DashboardViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToOrgTasks(org.id, user.uid, (data) => {
      setTasks(data);
      setIsLoading(false);
    }, false);
    return unsub;
  }, [org.id, user.uid]);

  const userTasks = tasks.filter(t => t.assigneeId === user.uid || t.assigneeIds?.includes(user.uid));
  const activeUserTasks = userTasks.filter(t => t.status !== 'done');

  if (isLoading) return <div className="h-full flex items-center justify-center">Loading...</div>;

  return (
    <div className="h-full flex flex-col p-8 md:p-12 bg-[#FAFAFA] overflow-y-auto no-scrollbar font-sans">
      <div className="max-w-7xl mx-auto w-full">
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Hallo, {profile?.displayName || user.displayName || 'User'}!</h1>
        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Semangat yah hari ini! Kamu punya {activeUserTasks.length} task aktif.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {[
              { 
                  label: 'Total Assigned', 
                  value: userTasks.length.toString(), 
                  icon: ListTodo, 
                  color: 'text-emerald-600', 
                  bg: 'bg-emerald-50',
                  sub: 'All tasks assigned to me'
              },
              { 
                  label: 'Active Tasks', 
                  value: activeUserTasks.length.toString(), 
                  icon: Target, 
                  color: 'text-blue-500', 
                  bg: 'bg-blue-50',
                  sub: 'Currently in progress'
              },
              { 
                  label: 'Completed', 
                  value: userTasks.filter(t => t.status === 'done').length.toString(), 
                  icon: TrendingUp, 
                  color: 'text-orange-500', 
                  bg: 'bg-orange-50',
                  sub: 'Finished task count'
              },
              { 
                  label: 'Completion Rate', 
                  value: userTasks.length > 0 ? `${Math.round((userTasks.filter(t => t.status === 'done').length / userTasks.length) * 100)}%` : '0%', 
                  icon: Activity, 
                  color: 'text-purple-500', 
                  bg: 'bg-purple-50',
                  sub: 'Of total assigned tasks'
              },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden"
              >
                  <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-6 group-hover:rotate-6 transition-transform`}>
                    <stat.icon className="w-7 h-7" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1 leading-none">{stat.label}</p>
                  <h3 className="text-3xl font-black text-gray-900 mb-1 tracking-tighter">{stat.value}</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">{stat.sub}</p>
              </motion.div>
            ))}
         </div>
      </div>
    </div>
  );
}
