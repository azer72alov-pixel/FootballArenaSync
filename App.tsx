import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import CourtCard from './components/CourtCard';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import NewsModal from './components/ChatWidget';
import { COURTS, NOTIFICATION_CONFIG, SUPER_ADMIN_PIN, SUBSCRIPTIONS } from './constants';
import { Court, Subscription, Section } from './types';
import { TRANSLATIONS } from './translations';
import { supabase } from './supabase';

// Helper to format date in LOCAL time (YYYY-MM-DD)
export const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Manual Month Names to avoid "M01" issues in some locales/browsers
const MONTH_NAMES = {
    az: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyun', 'İyul', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'],
    ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;
  const [lang, setLang] = useState<'az' | 'ru' | 'en'>('az');
  
  // Dynamic Courts State
  const [courts, setCourts] = useState<Court[]>(COURTS);

  // Views
  const [view, setView] = useState<'home' | 'search' | 'booking' | 'admin_login' | 'admin_dashboard' | 'super_admin_login' | 'super_admin_dashboard'>('home');
  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  
  // Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  
  // Booking Logic State
  const [bookingType, setBookingType] = useState<'hourly' | 'subscription'>('hourly');
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [dayBookings, setDayBookings] = useState<{hour: number, type: string}[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());

  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  
  // User Name Logic (Persisted for Android/Web)
  const [userName, setUserName] = useState<string>(() => {
      return localStorage.getItem('arena_user_name') || "Guest User";
  });
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState('');
  
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');
  
  // Super Admin State
  const [suspendedCourts, setSuspendedCourts] = useState<string[]>([]);
  
  // News Modal State
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  const t = TRANSLATIONS[lang];

  // Helper for safe Haptic Feedback
  const triggerHaptic = (type: 'success' | 'error' | 'warning') => {
      // @ts-ignore
      if (tg && tg.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
          tg.HapticFeedback.notificationOccurred(type);
      }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
      if (type !== 'info') triggerHaptic(type === 'error' ? 'error' : 'success');
      setTimeout(() => setToast(null), 3500);
  };

  // --- SYNC SETTINGS FROM DB ---
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from('court_settings').select('*');
    if (data && data.length > 0) {
      setCourts(prevCourts => prevCourts.map(court => {
        const setting = data.find((s: any) => s.court_id === court.id);
        if (setting) {
          return {
            ...court,
            pricePerHour: setting.price_per_hour ?? court.pricePerHour,
            subscriptionPrice: setting.subscription_price ?? court.subscriptionPrice,
            pin: setting.pin ?? court.pin,
            status: setting.is_suspended ? 'suspended' : 'active'
          };
        }
        return court;
      }));

      // Sync suspended list
      const suspendedIds = data.filter((s: any) => s.is_suspended).map((s: any) => s.court_id);
      setSuspendedCourts(suspendedIds);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchSettings();

    // Realtime listener for settings changes
    const channel = supabase.channel('public:court_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'court_settings' }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSettings]);

  // Handle Updates (Write to DB)
  const handleUpdateCourtSettings = async (courtId: string, settings: { pricePerHour?: number, subscriptionPrice?: number, pin?: string }) => {
      // 1. Optimistic Update (Instant UI feedback)
      setCourts(prev => prev.map(c => {
          if (c.id === courtId) {
              return { ...c, ...settings };
          }
          return c;
      }));

      // 2. DB Update
      const currentCourt = courts.find(c => c.id === courtId);
      if (!currentCourt) return;

      // Check existing row to preserve data if not provided in update
      const { data: existingRow } = await supabase.from('court_settings').select('*').eq('court_id', courtId).single();
      
      const payload = {
          court_id: courtId,
          price_per_hour: settings.pricePerHour ?? existingRow?.price_per_hour ?? currentCourt.pricePerHour,
          subscription_price: settings.subscriptionPrice ?? existingRow?.subscription_price ?? currentCourt.subscriptionPrice,
          pin: settings.pin ?? existingRow?.pin ?? currentCourt.pin,
          is_suspended: existingRow?.is_suspended ?? (currentCourt.status === 'suspended')
      };

      const { error } = await supabase.from('court_settings').upsert(payload);
      
      if (error) {
          console.error("Settings sync error:", error);
          showToast("Cloud sync failed. Check internet.", 'error');
      } else {
          showToast(lang === 'az' ? 'Yadda saxlanıldı (Cloud)' : 'Saved to Cloud', 'success');
      }
  };

  const handleToggleSuspend = async (courtId: string) => {
    // 1. Optimistic
    const isSuspended = suspendedCourts.includes(courtId);
    const newSuspended = isSuspended 
        ? suspendedCourts.filter(id => id !== courtId)
        : [...suspendedCourts, courtId];
    setSuspendedCourts(newSuspended);

    // 2. DB Update
    const currentCourt = courts.find(c => c.id === courtId);
    if (!currentCourt) return;
    const { data: existingRow } = await supabase.from('court_settings').select('*').eq('court_id', courtId).single();

    const payload = {
        court_id: courtId,
        price_per_hour: existingRow?.price_per_hour ?? currentCourt.pricePerHour,
        subscription_price: existingRow?.subscription_price ?? currentCourt.subscriptionPrice,
        pin: existingRow?.pin ?? currentCourt.pin,
        is_suspended: !isSuspended
    };

    await supabase.from('court_settings').upsert(payload);
    showToast(`Status: ${!isSuspended ? 'Suspended' : 'Active'}`, 'info');
  };

  // --- INIT TELEGRAM & DEEP LINKS ---
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      // @ts-ignore
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
          tg.setHeaderColor('#ffffff');
      }

      if (tg.initDataUnsafe?.user?.first_name) {
          const user = tg.initDataUnsafe.user;
          const fullName = `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}${user.username ? ' (@' + user.username + ')' : ''}`;
          setUserName(fullName);
      }
    }
    
    // Check deep link
    const params = new URLSearchParams(window.location.search);
    const courtIdParam = params.get('court');
    if (courtIdParam) {
        const targetCourt = courts.find(c => c.id === courtIdParam);
        if (targetCourt) {
            setSelectedCourt(targetCourt);
            setView('booking');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }
  }, []); // Run once on mount

  // --- BOOKING LOGIC ---
  const fetchBookings = useCallback(async () => {
        if (!selectedCourt) return;
        const dateStr = formatDateLocal(selectedDate);
        
        const { data } = await supabase.from('bookings').select('hour, type').eq('court_id', selectedCourt.id).eq('date', dateStr);
        
        let dbReserved: number[] = [];
        let dbDetailBookings: {hour: number, type: string}[] = [];

        if (data) {
            dbReserved = data.map((b: any) => b.hour);
            dbDetailBookings = data.map((b: any) => ({ hour: b.hour, type: b.type }));
        }

        const storedSections = localStorage.getItem(`court_sections_${selectedCourt.id}`);
        const sections: Section[] = storedSections ? JSON.parse(storedSections) : [];
        const dayOfWeek = selectedDate.getDay();
        const activeSections = sections.filter(s => s.days.includes(dayOfWeek));

        const sectionReserved: number[] = [];
        const sectionDetailBookings: {hour: number, type: string}[] = [];

        activeSections.forEach(s => {
            for(let i=0; i < s.duration; i++) {
                const h = s.startHour + i;
                sectionReserved.push(h);
                sectionDetailBookings.push({ hour: h, type: 'section' });
            }
        });

        const combinedReserved = Array.from(new Set([...dbReserved, ...sectionReserved]));
        const combinedDetails = [...dbDetailBookings, ...sectionDetailBookings];

        setReservedHours(combinedReserved);
        setDayBookings(combinedDetails);

  }, [selectedCourt, selectedDate]);

  const fetchOccupiedDates = useCallback(async () => {
        if (!selectedCourt) return;
        const { data } = await supabase.from('bookings').select('date').eq('court_id', selectedCourt.id);
        if (data) {
            const dates = new Set<string>();
            data.forEach((b: any) => dates.add(b.date));
            setBookedDates(dates);
        }
  }, [selectedCourt]);

  // Sync Logic: Auto-Refresh on Visibility Change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchBookings();
        fetchOccupiedDates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchBookings, fetchOccupiedDates]);

  useEffect(() => {
    fetchBookings();
    fetchOccupiedDates();
  }, [fetchBookings, fetchOccupiedDates, bookingSuccess]);

  // Realtime Bookings
  useEffect(() => {
    const channel = supabase
      .channel('public:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        if (view === 'booking' && payload.eventType === 'INSERT') {
            const msg = lang === 'az' ? '⚠️ Yeni rezervasiya edildi!' : (lang === 'ru' ? '⚠️ Кто-то забронировал время!' : '⚠️ Slot just taken!');
            showToast(msg, 'info');
        }
        fetchBookings();
        fetchOccupiedDates();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchBookings, fetchOccupiedDates, view, lang]);

  const sendTelegramNotification = async (bookingDetails: any) => {
      const { BOT_TOKEN } = NOTIFICATION_CONFIG;
      const targetCourt = courts.find(c => c.id === bookingDetails.court_id);
      const ownerChatId = targetCourt?.telegramChatId;

      if (!BOT_TOKEN || !ownerChatId) return;

      const text = `
🔔 <b>YENİ REZERVASİYA!</b>

🏟 <b>Meydança:</b> ${targetCourt?.name}
📅 <b>Tarix:</b> ${bookingDetails.date}
⏰ <b>Saat:</b> ${bookingDetails.hour}:00 - ${bookingDetails.hour + 1}:00
👤 <b>Müştəri:</b> ${bookingDetails.customer_name}
💰 <b>Məbləğ:</b> ${bookingDetails.amount} ₼
📝 <b>Növ:</b> ${bookingDetails.type === 'subscription' ? 'Abunəlik' : 'Bir dəfəlik'}

<i>(Zəhmət olmasa cədvəlinizi yoxlayın)</i>
      `;

      try {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: ownerChatId, text: text, parse_mode: 'HTML' })
          });
      } catch (error) {
          console.error("Failed to send Telegram notification:", error);
      }
  };

  const handleBook = async () => {
    if (selectedHour === null || !selectedCourt) return;
    setIsBooking(true);
    if (tg) tg.MainButton.showProgress(false);

    const isSub = bookingType === 'subscription';
    const amount = Math.round(isSub ? selectedCourt.subscriptionPrice : selectedCourt.pricePerHour);
    
    const rowsToInsert = [];
    const dateStr = formatDateLocal(selectedDate);

    if (isSub && selectedSubscription) {
        const iterations = selectedSubscription.hours; 
        for (let i = 0; i < iterations; i++) {
            const nextDate = new Date(selectedDate);
            nextDate.setDate(selectedDate.getDate() + (i * 7)); 
            const dStr = formatDateLocal(nextDate);

            rowsToInsert.push({
                court_id: selectedCourt.id,
                date: dStr,
                hour: selectedHour,
                customer_name: userName,
                status: 'pending',
                type: 'subscription',
                amount: i === 0 ? amount : 0 
            });
        }
    } else {
        rowsToInsert.push({
            court_id: selectedCourt.id,
            date: dateStr,
            hour: selectedHour,
            customer_name: userName,
            status: 'pending',
            type: 'hourly',
            amount: amount
        });
    }

    try {
        const { error } = await supabase.from('bookings').insert(rowsToInsert).select();

        if (error) {
            if (error.code === '23505') {
                const msg = isSub 
                    ? (lang === 'az' ? '🛑 Gələcək həftələrin birində bu vaxt tutulub!' : (lang === 'ru' ? '🛑 Одна из будущих дат уже занята!' : '🛑 One of the future dates is booked!'))
                    : (lang === 'az' ? '🛑 Bu vaxt artıq tutulub!' : (lang === 'ru' ? '🛑 Это время только что заняли!' : '🛑 Already booked!'));
                
                tg?.showPopup ? tg.showPopup({ title: 'Error', message: msg, buttons: [{type: 'ok'}] }) : showToast(msg, 'error');
                fetchBookings();
            } else if (error.message.includes('row-level security')) {
                showToast("DB SETUP ERROR: Run RLS Policies SQL in Supabase!", 'error');
            } else {
                showToast(`Error: ${error.message}`, 'error');
            }
            setIsBooking(false);
            if (tg) tg.MainButton.hideProgress();
            return;
        }

        await sendTelegramNotification(rowsToInsert[0]);
        setIsBooking(false);
        setBookingSuccess(true);
        if (tg) {
            tg.MainButton.hide();
            triggerHaptic('success');
        }
    } catch (e) {
        setIsBooking(false);
        showToast("System Error", 'error');
        console.error(e);
    }
  };

  const handleBack = useCallback(() => {
    if (bookingSuccess) {
        setBookingSuccess(false); setView('home'); setBookingStep('date');
        setSelectedCourt(null); setSelectedHour(null);
        setSelectedSubscription(null); 
        setBookingType('hourly');
        return;
    }
    if (bookingStep === 'time') {
      setBookingStep('date'); return;
    }
    setView('home'); setSelectedCourt(null); setSelectedSubscription(null); setBookingStep('date'); setAdminPin(''); setBookingType('hourly');
  }, [bookingStep, bookingSuccess, bookingType, selectedSubscription]);

  useEffect(() => {
    if (!tg) return;
    // @ts-ignore
    const supportsBack = tg.isVersionAtLeast ? tg.isVersionAtLeast('6.1') : false;

    if (supportsBack) {
        if (view !== 'home' || bookingSuccess) { 
            tg.BackButton.show(); 
            tg.BackButton.onClick(handleBack); 
        } else { 
            tg.BackButton.hide(); 
        }
        return () => { tg.BackButton.offClick(handleBack); };
    }
  }, [view, handleBack, tg, bookingSuccess]);

  const showStickyButton = view === 'booking' && selectedCourt && selectedHour !== null && !bookingSuccess;

  const handlePartnerLogin = () => {
    if (adminPin === SUPER_ADMIN_PIN) {
        showToast(t.invalidPin, 'error');
        setAdminPin('');
        return;
    }
    // Check against DB-synced courts state which includes updated PINs
    const court = courts.find(c => c.pin === adminPin);
    if (court) {
        if (suspendedCourts.includes(court.id)) {
            showToast("Account Suspended. Contact Platform Owner.", 'error');
            return;
        }
        setManagedCourtId(court.id);
        setAdminPin('');
        setView('admin_dashboard');
    } else {
        showToast(t.invalidPin, 'error');
        setAdminPin('');
    }
  };

  const handleSuperAdminLogin = () => {
      if (adminPin === SUPER_ADMIN_PIN) { 
          setAdminPin('');
          setView('super_admin_dashboard');
      } else {
          showToast("Access Denied", 'error');
          setAdminPin('');
      }
  }

  const handleSecretTrigger = () => {
      setView('super_admin_login');
      setAdminPin('');
  };

  const handleSaveName = () => {
      if (tempName.trim()) {
          setUserName(tempName);
          localStorage.setItem('arena_user_name', tempName);
          setIsNameModalOpen(false);
          showToast(lang === 'az' ? 'Ad yadda saxlanıldı' : 'Name saved', 'success');
      }
  };

  const visibleCourts = useMemo(() => {
      return courts.filter(c => !suspendedCourts.includes(c.id));
  }, [courts, suspendedCourts]);

  const getFutureDatesPreview = () => {
      if (!selectedSubscription || bookingType !== 'subscription') return [];
      const dates = [];
      for(let i=0; i < selectedSubscription.hours; i++) {
           const d = new Date(selectedDate);
           d.setDate(selectedDate.getDate() + (i * 7));
           // Manual formatting replacing toLocaleDateString to fix "M01" bug
           const day = d.getDate();
           const month = MONTH_NAMES[lang][d.getMonth()];
           dates.push(`${day} ${month}`);
      }
      return dates;
  }

  const canGoBack = view !== 'home' || bookingSuccess;
  const showProfileButton = !tg?.initDataUnsafe?.user;

  return (
    <Layout 
        lang={lang} 
        onLangChange={setLang} 
        onSecretTrigger={handleSecretTrigger}
        canGoBack={canGoBack}
        onBack={handleBack}
    >
      {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center animate-in slide-in-from-top-10 fade-in duration-300 ${
              toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
          }`}>
              <span className="font-bold text-sm">{toast.message}</span>
          </div>
      )}

      {/* --- NAME SET MODAL --- */}
      {isNameModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsNameModalOpen(false)}></div>
               <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative z-10 animate-in zoom-in-95">
                   <h3 className="text-xl font-bold text-slate-900 mb-2">{lang === 'az' ? 'Sizin Adınız' : (lang === 'ru' ? 'Ваше имя' : 'Your Name')}</h3>
                   <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)}
                       placeholder={userName} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold mb-6" autoFocus />
                   <button onClick={handleSaveName} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                       {lang === 'az' ? 'Yadda saxla' : (lang === 'ru' ? 'Сохранить' : 'Save')}
                   </button>
               </div>
          </div>
      )}

      <NewsModal isOpen={isNewsModalOpen} onClose={() => setIsNewsModalOpen(false)} lang={lang} courts={COURTS} />

      {view === 'admin_dashboard' && managedCourtId && (
        <AdminDashboard 
            lang={lang} 
            managedCourtId={managedCourtId} 
            allCourts={courts} 
            onBack={handleBack} 
            onUpdateSettings={handleUpdateCourtSettings}
        />
      )}

      {view === 'super_admin_dashboard' && (
        <SuperAdminDashboard 
            lang={lang} 
            allCourts={courts} 
            suspendedCourts={suspendedCourts}
            onToggleSuspend={handleToggleSuspend}
            onBack={handleBack} 
        />
      )}

      {view === 'admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/80 backdrop-blur-md p-8 rounded-[2rem] shadow-xl w-full max-w-sm text-center border border-white/50">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.partnerAccess}</h2>
                <p className="text-slate-500 text-sm mb-6">{t.enterPin}</p>
                <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold text-slate-900 mb-6 focus:bg-white"
                    placeholder="••••••" maxLength={6} />
                <button onClick={handlePartnerLogin} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-600 transition-colors">
                    {lang === 'az' ? 'Daxil ol' : (lang === 'ru' ? 'Войти' : 'Login')}
                </button>
            </div>
        </div>
      )}

      {view === 'super_admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in">
            <div className="bg-slate-900/90 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center border border-slate-800 relative overflow-hidden">
                <h2 className="text-2xl font-black text-white mb-2 relative z-10">SYSTEM OVERRIDE</h2>
                <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold text-white mb-6 relative z-10"
                    placeholder="••••••" maxLength={6} autoFocus />
                <button onClick={handleSuperAdminLogin} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg relative z-10">ACCESS</button>
            </div>
        </div>
      )}

      {(view === 'home' || view === 'search') && (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
          {view === 'home' && (
             <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl min-h-[400px] flex items-center">
                <div className="absolute inset-0">
                   <img src="https://images.unsplash.com/photo-1517466787929-bc90951d6db0?auto=format&fit=crop&q=80&w=2000" alt="Hero" className="w-full h-full object-cover opacity-60"/>
                   <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
                </div>
                <div className="relative z-10 p-8 md:p-12 max-w-2xl text-white">
                    <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
                        <span className="block text-indigo-400">{t.heroTitlePart1}</span> {t.heroTitlePart2}
                    </h1>
                    <p className="text-lg text-slate-300 mb-8">{t.heroDesc}</p>
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={t.searchPlaceholder} className="w-full bg-white text-slate-900 rounded-xl pl-4 py-4 font-semibold shadow-xl" />
                </div>
             </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {visibleCourts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).length > 0 ? (
                visibleCourts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(court => (
                    <CourtCard 
                        key={court.id} 
                        court={court} 
                        isSelected={false} 
                        onSelect={(c) => { 
                            setSelectedCourt(c); 
                            setView('booking'); 
                            setBookingType('hourly');
                            setSelectedSubscription(null);
                        }} 
                        lang={lang} 
                    />
                ))
             ) : (
                <div className="col-span-3 text-center py-12 text-slate-500 font-bold bg-white/50 backdrop-blur-sm rounded-2xl">
                    <p>{t.noResults}</p>
                </div>
             )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
              <button 
                onClick={() => setIsNewsModalOpen(true)}
                className="py-4 rounded-2xl bg-white/80 backdrop-blur-md text-indigo-600 text-sm font-bold flex flex-col items-center justify-center gap-2 hover:bg-white transition-colors shadow-sm"
              >
                <span>{t.parentAccess}</span>
              </button>

              <button 
                onClick={() => { setView('admin_login'); setAdminPin(''); }} 
                className="py-4 rounded-2xl bg-white/50 backdrop-blur-md text-slate-600 text-sm font-bold flex flex-col items-center justify-center gap-2 hover:bg-white/80 transition-colors shadow-sm"
              >
                <span>{t.partnerAccess}</span>
              </button>

              {showProfileButton && (
                  <button 
                    onClick={() => { setTempName(userName); setIsNameModalOpen(true); }}
                    className="col-span-2 py-3 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 text-slate-600 text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/80 transition-colors"
                  >
                     <span>{lang === 'az' ? 'Profil: ' : (lang === 'ru' ? 'Профиль: ' : 'Profile: ')} {userName}</span>
                  </button>
              )}
          </div>
        </div>
      )}

      {view === 'booking' && selectedCourt && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-32">
            {bookingSuccess ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white/80 backdrop-blur-md rounded-[3rem] shadow-xl border border-white/50">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-200 text-emerald-600">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-3xl font-black mb-4 text-slate-900">{t.confirmed}</h2>
                    <button onClick={handleBack} className="text-indigo-600 font-bold hover:underline">{t.backToDashboard}</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-6 shadow-sm border border-white/50">
                             <div className="flex items-start justify-between mb-4">
                                <h2 className="text-2xl font-black text-slate-900 leading-tight pr-4">{selectedCourt.name}</h2>
                             </div>
                             
                             <div className="flex bg-slate-100/50 p-1 rounded-xl mb-6">
                                 <button 
                                    onClick={() => { setBookingType('hourly'); setSelectedSubscription(null); }}
                                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${bookingType === 'hourly' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                                 >
                                     {t.modeHourly}
                                 </button>
                                 <button 
                                    onClick={() => setBookingType('subscription')}
                                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${bookingType === 'subscription' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500'}`}
                                 >
                                     {t.modeSubscription}
                                 </button>
                             </div>

                             {bookingType === 'subscription' && !selectedSubscription && (
                                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t.chooseYourPlan}</h3>
                                     {SUBSCRIPTIONS.map(sub => (
                                         <div 
                                            key={sub.id}
                                            onClick={() => setSelectedSubscription(sub)}
                                            className="border border-purple-100 bg-purple-50/50 rounded-2xl p-4 cursor-pointer hover:border-purple-300 hover:shadow-md transition-all active:scale-95"
                                         >
                                             <div className="flex justify-between items-center mb-2">
                                                 <span className="font-bold text-slate-900">{sub.name}</span>
                                                 <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-lg">{selectedCourt.subscriptionPrice}₼</span>
                                             </div>
                                             <div className="text-xs text-slate-500">
                                                 <p className="mb-1"><strong>{t.planIncludes}</strong> {sub.hours} {t.gamesCount}</p>
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}

                             {bookingType === 'subscription' && selectedSubscription && (
                                 <div className="bg-purple-600 text-white p-4 rounded-xl mb-4 flex justify-between items-center animate-in fade-in shadow-lg shadow-purple-200">
                                     <div>
                                         <div className="text-xs opacity-75 uppercase font-bold">{t.subscription}</div>
                                         <div className="font-bold text-lg">{selectedSubscription.name}</div>
                                     </div>
                                     <button onClick={() => setSelectedSubscription(null)} className="bg-white/20 hover:bg-white/30 p-2 rounded-lg text-xs font-bold">{t.changePlan}</button>
                                 </div>
                             )}

                             {(bookingType === 'hourly' || (bookingType === 'subscription' && selectedSubscription)) && (
                                <div className="mt-4">
                                     {bookingStep === 'time' ? (
                                        <button onClick={() => setBookingStep('date')} className="w-full py-3 border border-slate-200/50 bg-white/50 text-slate-600 rounded-xl font-bold hover:bg-white/80 transition-colors">
                                            {t.changeDate}
                                        </button>
                                     ) : (
                                        <Calendar selectedDate={selectedDate} onDateChange={(d) => { setSelectedDate(d); setBookingStep('time'); }} lang={lang} bookedDates={bookedDates} />
                                     )}
                                </div>
                             )}
                        </div>
                    </div>

                    <div className="lg:col-span-7">
                        {(bookingType === 'hourly' || (bookingType === 'subscription' && selectedSubscription)) && bookingStep === 'time' && (
                             <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <TimeGrid selectedHour={selectedHour} onHourSelect={setSelectedHour} lang={lang} reservedHours={reservedHours} dayBookings={dayBookings} />
                             </div>
                        )}
                    </div>
                </div>
            )}

            {showStickyButton && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
                    <button 
                        onClick={handleBook} 
                        disabled={isBooking || (bookingType === 'subscription' && !selectedSubscription)} 
                        className={`w-full py-4 rounded-2xl shadow-2xl font-bold text-lg flex justify-between px-8 transition-all active:scale-95 ${
                            bookingType === 'subscription' ? 'bg-purple-600 text-white shadow-purple-200' : 'bg-indigo-600 text-white shadow-indigo-200'
                        }`}
                    >
                        <span>{t.bookNow}</span>
                        <span>{isBooking ? '...' : (bookingType === 'subscription' ? selectedCourt.subscriptionPrice : selectedCourt.pricePerHour) + ' ₼'}</span>
                    </button>
                </div>
            )}
        </div>
      )}
    </Layout>
  );
};
   
export default App;