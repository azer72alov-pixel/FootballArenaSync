import React, { useState, useEffect } from 'react';
import { Court } from '../types';
import { supabase } from '../lib/supabase';
import { TRANSLATIONS } from '../translations';

interface SuperAdminDashboardProps {
  lang: 'az' | 'ru' | 'en';
  allCourts: Court[];
  suspendedCourts: string[];
  onToggleSuspend: (courtId: string) => void;
  onBack: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ 
  lang, 
  allCourts, 
  suspendedCourts, 
  onToggleSuspend, 
  onBack 
}) => {
  const [stats, setStats] = useState<Record<string, { totalRevenue: number; totalBookings: number }>>({});
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    // Fetch aggregated stats for all courts
    const fetchStats = async () => {
      const { data } = await supabase.from('bookings').select('court_id, amount');
      
      if (data) {
        const newStats: Record<string, { totalRevenue: number; totalBookings: number }> = {};
        
        allCourts.forEach(c => {
            newStats[c.id] = { totalRevenue: 0, totalBookings: 0 };
        });

        data.forEach((b: any) => {
          if (!newStats[b.court_id]) newStats[b.court_id] = { totalRevenue: 0, totalBookings: 0 };
          newStats[b.court_id].totalRevenue += (b.amount || 0);
          newStats[b.court_id].totalBookings += 1;
        });

        setStats(newStats);
      }
    };

    fetchStats();
  }, [allCourts]);

  const totalPlatformRevenue = Object.values(stats).reduce((acc: number, curr: { totalRevenue: number }) => acc + curr.totalRevenue, 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 pb-20">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
        <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
                <button onClick={onBack} className="text-slate-400 hover:text-white text-sm font-bold flex items-center">
                    <span className="mr-1">‹</span> {t.backToDashboard}
                </button>
                <div className="px-3 py-1 bg-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Owner Mode
                </div>
            </div>
            <h1 className="text-2xl font-black mb-1">Platform Overview</h1>
            <p className="text-slate-400 text-sm mb-6">Manage your partners and monitor revenue.</p>
            
            <div className="flex items-center gap-4">
                <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Total Revenue</div>
                    <div className="text-3xl font-black text-emerald-400">{totalPlatformRevenue} ₼</div>
                </div>
                <div className="h-8 w-px bg-slate-700"></div>
                <div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Total Partners</div>
                    <div className="text-3xl font-black text-white">{allCourts.length}</div>
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-4">
        {allCourts.map(court => {
            const isSuspended = suspendedCourts.includes(court.id);
            const courtStats = stats[court.id] || { totalRevenue: 0, totalBookings: 0 };

            return (
                <div key={court.id} className={`bg-white rounded-2xl p-5 border shadow-sm transition-all ${isSuspended ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <img src={court.image} className={`w-12 h-12 rounded-lg object-cover ${isSuspended ? 'grayscale opacity-50' : ''}`} />
                            <div>
                                <h3 className={`font-bold text-slate-900 leading-tight ${isSuspended ? 'text-slate-500 line-through' : ''}`}>
                                    {court.name}
                                </h3>
                                <div className="text-xs text-slate-400">{court.address}</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase mb-2 ${isSuspended ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {isSuspended ? 'Suspended' : 'Active'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Revenue</div>
                            <div className="text-lg font-black text-slate-900">{courtStats.totalRevenue} ₼</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[10px] text-slate-400 font-bold uppercase">Bookings</div>
                            <div className="text-lg font-black text-slate-900">{courtStats.totalBookings}</div>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => onToggleSuspend(court.id)}
                            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                                isSuspended 
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 shadow-lg' 
                                : 'bg-white border-2 border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                            }`}
                        >
                            {isSuspended ? 'Activate Partner' : 'Suspend Access'}
                        </button>
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;