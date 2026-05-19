import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Zap, 
  Activity,
  Users,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Wallet,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';
import { Organization, Task, AppUser } from '../types';
import { subscribeToOrgTasks } from '../services/taskService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardViewProps {
  user: AppUser;
  org: Organization;
}

export default function DashboardView({ user, org }: DashboardViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToOrgTasks(org.id, user.uid, (data) => {
      setTasks(data);
      setIsLoading(false);
    });
    return unsub;
  }, [org.id, user.uid]);

  const financeTasks = tasks.filter(t => t.category?.toLowerCase().includes('finance') || t.amount !== undefined);
  const totalPotentialAmount = financeTasks.reduce((sum, t) => sum + (t.amount || 0), 0);
  const approvedFinanceAmount = financeTasks
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const completionRate = tasks.length > 0 
    ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) 
    : 0;

  // Prepare chart data (Revenue by Month)
  const chartData = tasks
    .filter(t => t.status === 'done' && t.completedAt)
    .reduce((acc: any[], task) => {
      const date = new Date(task.completedAt);
      const month = date.toLocaleString('default', { month: 'short' });
      const existing = acc.find(d => d.name === month);
      if (existing) {
        existing.revenue += task.amount || 0;
      } else {
        acc.push({ name: month, revenue: task.amount || 0 });
      }
      return acc;
    }, [])
    .sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a.name) - months.indexOf(b.name);
    });

  const stats = [
    { 
      label: 'Financial Potential', 
      value: `Rp ${totalPotentialAmount.toLocaleString()}`, 
      icon: Wallet, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      sub: `${approvedFinanceAmount.toLocaleString()} approved`
    },
    { 
      label: 'Completion Rate', 
      value: `${completionRate}%`, 
      icon: Target, 
      color: 'text-blue-500', 
      bg: 'bg-blue-50',
      sub: 'Of all tasks marked approve'
    },
    { 
      label: 'Approved Rev', 
      value: approvedFinanceAmount > 1000000 ? `${(approvedFinanceAmount/1000000).toFixed(1)}M` : `Rp ${approvedFinanceAmount.toLocaleString()}`, 
      icon: TrendingUp, 
      color: 'text-orange-500', 
      bg: 'bg-orange-50',
      sub: 'Revenue from approved tasks'
    },
    { 
      label: 'On Schedule', 
      value: tasks.filter(t => t.status !== 'done').length.toString(), 
      icon: Activity, 
      color: 'text-purple-500', 
      bg: 'bg-purple-50',
      sub: 'Active tasks in pipeline'
    },
  ];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full shadow-2xl shadow-orange-500/20"
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 md:p-12 bg-[#FAFAFA] overflow-y-auto no-scrollbar font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-12">
         <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-1 bg-orange-500 rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">Live Analytics</span>
              </div>
              <h2 className="text-5xl font-black tracking-tighter text-gray-900 mb-2 uppercase">Performance Dashboard</h2>
              <p className="text-gray-400 font-bold text-sm max-w-lg uppercase tracking-tight">
                Tracking {org.name} organization metrics and revenue growth.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white p-3 rounded-[1.5rem] shadow-xl border border-black/5">
               <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                  <Activity className="w-5 h-5" />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</p>
                  <p className="text-sm font-black uppercase text-gray-900 tracking-tighter">System Healthy</p>
               </div>
            </div>
         </header>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
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

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-xl border border-black/5 flex flex-col h-[500px]">
               <div className="flex items-center justify-between mb-10">
                 <div>
                   <h3 className="text-2xl font-black uppercase tracking-tighter text-gray-900">Revenue Growth</h3>
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Monthly Approved Income</p>
                 </div>
                 <BarChart3 className="w-6 h-6 text-orange-500" />
               </div>
               
               <div className="flex-1 w-full -ml-4">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis 
                       dataKey="name" 
                       axisLine={false} 
                       tickLine={false} 
                       tick={{ fontSize: 10, fontWeight: 800, fill: '#9ca3af', textTransform: 'uppercase' }} 
                     />
                     <YAxis 
                       hide 
                     />
                     <Tooltip 
                       cursor={{ fill: '#f8fafc' }}
                       contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                       itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#f97316' }}
                       formatter={(value: any) => [`Rp ${value.toLocaleString()}`, 'REVENUE']}
                     />
                     <Bar dataKey="revenue" radius={[10, 10, 10, 10]} barSize={40}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#f97316' : '#E2E8F0'} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="bg-[#141414] text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex-1 group">
                 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-125 transition-transform duration-1000">
                    <Zap className="w-32 h-32" />
                 </div>
                 <div className="relative z-10">
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-8">Performance Mix</h3>
                    <div className="space-y-8">
                       {[
                         { 
                           label: 'Revenue Realization', 
                           val: totalPotentialAmount > 0 ? Math.round((approvedFinanceAmount / totalPotentialAmount) * 100) : 0,
                           color: 'bg-orange-500'
                         },
                         { 
                           label: 'Team Efficiency', 
                           val: tasks.length > 0 ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length) : 0,
                           color: 'bg-blue-500'
                         },
                         { 
                           label: 'Submission Health', 
                           val: completionRate,
                           color: 'bg-emerald-500'
                         },
                       ].map((item) => (
                         <div key={item.label} className="space-y-3">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                               <span>{item.label}</span>
                               <span className="text-white">{item.val}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                               <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.val}%` }}
                                  className={`h-full ${item.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                               />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="bg-orange-500 p-10 rounded-[3rem] text-white shadow-2xl shadow-orange-500/20 relative overflow-hidden">
                 <div className="relative z-10">
                    <Trophy className="w-8 h-8 mb-4" />
                    <h3 className="text-xl font-black uppercase tracking-tighter">Milestone Reached</h3>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-tight mt-3 leading-relaxed">
                      {approvedFinanceAmount > 0 
                        ? `You have successfully approved Rp ${approvedFinanceAmount.toLocaleString()} in realized revenue.`
                        : "Start approving finance-related tasks to see realized revenue growth."}
                    </p>
                 </div>
              </div>
            </div>
         </div>
      </div>
    </div>
  );
}
