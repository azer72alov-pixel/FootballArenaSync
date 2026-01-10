import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import CourtCard from './components/CourtCard';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import SubscriptionPanel from './components/SubscriptionPanel';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { COURTS, NOTIFICATION_CONFIG, SUPER_ADMIN_PIN } from './constants';
import { Court, Subscription } from './types';
import { TRANSLATIONS } from './translations';
import { supabase } from './supabase';

// Helper to format date in LOCAL time (YYYY-MM-DD)
// Prevents timezone shifts (e.g. 00:00 local becoming 20:00 previous day UTC)
export const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;
  const [lang, setLang] = useState<'az' | 'ru' | 'en'>('az');
  
  const [view, setView] = useState<'home' | 'search' | 'booking' | 'subscription' | 'admin_login' | 'admin_dashboard' | 'super_admin_login' | 'super_admin_dashboard'>('home');
  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [dayBookings, setDayBookings] = useState<{hour: number, type: string}[]>([]);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());

  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [userName, setUserName] = useState<string>("Guest User");
  
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');
  
  // Super Admin State
  const [suspendedCourts, setSuspendedCourts] = useState<string[]>([]);
  
  // Состояние для всплывающих уведомлений (Alerts)
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#ffffff');
      if (tg.initDataUnsafe?.user?.first_name) {
          const user = tg.initDataUnsafe.user;
          setUserName(`${user.first_name}${user.last_name ? ' ' + user.last_name : ''}${user.username ? ' (@' + user.username + ')' : ''}`);
      }
    }
    
    // Load suspended state from local storage (Simulating DB for platform settings)
    const storedSuspended = localStorage.getItem('arena_suspended_courts');
    if (storedSuspended) {
        setSuspendedCourts(JSON.parse(storedSuspended));
    }

    // --- DEEP LINKING HANDLER ---
    // Check for ?court=ID in URL to open specific booking page immediately
    const params = new URLSearchParams(window.location.search);
    const courtIdParam = params.get('court');
    if (courtIdParam) {
        const targetCourt = COURTS.find(c => c.id === courtIdParam);
        if (targetCourt) {
            setSelectedCourt(targetCourt);
            setView('booking');
            // Optional: Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
    }
  }, []);

  const t = TRANSLATIONS[lang];

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToast({ message, type });
      if (tg) tg.HapticFeedback.notificationOccurred(type === 'error' ? 'error' : 'success');
      setTimeout(() => setToast(null), 3500);
  };

  const fetchBookings = useCallback(async () => {
        if (!selectedCourt) return;
        // FIX: Use local date string instead of toISOString()
        const dateStr = formatDateLocal(selectedDate);
        
        const { data } = await supabase.from('bookings').select('hour, type').eq('court_id', selectedCourt.id).eq('date', dateStr);
        if (data) {
            setReservedHours(data.map((b: any) => b.hour));
            setDayBookings(data.map((b: any) => ({ hour: b.hour, type: b.type })));
        }
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

  useEffect(() => {
    fetchBookings();
    fetchOccupiedDates();
  }, [fetchBookings, fetchOccupiedDates, bookingSuccess]);

  // REALTIME - ПОЛУЧЕНИЕ ОБНОВЛЕНИЙ В ЖИВОМ ЭФИРЕ
  useEffect(() => {
    const channel = supabase
      .channel('public:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        // Если кто-то другой забронировал, пока мы смотрим - уведомляем
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

  // --- OFFLINE NOTIFICATION FUNCTION (INDIVIDUAL OWNERS) ---
  const sendTelegramNotification = async (bookingDetails: any) => {
      const { BOT_TOKEN } = NOTIFICATION_CONFIG;
      
      // Determine the specific chat ID for this court's owner
      const targetCourt = COURTS.find(c => c.id === bookingDetails.court_id);
      const ownerChatId = targetCourt?.telegramChatId;

      // Skip if no bot token or no owner ID is set for this venue
      if (!BOT_TOKEN || !ownerChatId) {
          console.warn(`Notification skipped. Token: ${!!BOT_TOKEN}, OwnerID: ${!!ownerChatId}`);
          return;
      }

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
              body: JSON.stringify({
                  chat_id: ownerChatId, // Sending to the specific owner
                  text: text,
                  parse_mode: 'HTML'
              })
          });
      } catch (error) {
          console.error("Failed to send Telegram notification:", error);
      }
  };

  const handleBook = async () => {
    if (selectedHour === null || !selectedCourt) return;
    setIsBooking(true);
    if (tg) tg.MainButton.showProgress(false);

    const isSub = view === 'subscription';
    const amount = Math.round(isSub && selectedSubscription ? selectedSubscription.price : selectedCourt.pricePerHour);
    
    // Подготовка массива для вставки (одна запись или несколько для абонемента)
    const rowsToInsert = [];
    const dateStr = formatDateLocal(selectedDate);

    if (isSub && selectedSubscription) {
        // Логика абонемента: создаем записи на N недель вперед
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
        // Обычное разовое бронирование
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

        // --- SEND TELEGRAM NOTIFICATION (OFFLINE SUPPORT) ---
        // Send alert only for the primary booking (first one) to avoid spamming 4 messages for subscription
        await sendTelegramNotification(rowsToInsert[0]);

        setIsBooking(false);
        setBookingSuccess(true);
        if (tg) {
            tg.MainButton.hide();
            tg.HapticFeedback.notificationOccurred('success');
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
        return;
    }
    if ((view === 'booking' || view === 'subscription') && bookingStep === 'time') {
      setBookingStep('date'); return;
    }
    setView('home'); setSelectedCourt(null); setBookingStep('date'); setAdminPin('');
  }, [view, bookingStep, bookingSuccess]);

  useEffect(() => {
    if (!tg) return;
    if (view !== 'home' || bookingSuccess) { tg.BackButton.show(); tg.BackButton.onClick(handleBack); }
    else { tg.BackButton.hide(); }
    return () => { tg.BackButton.offClick(handleBack); };
  }, [view, handleBack, tg, bookingSuccess]);

  const showStickyButton = (view === 'booking' || view === 'subscription') && selectedCourt && selectedHour !== null && !bookingSuccess;

  // Функция входа в админку ПАРТНЕРОВ
  const handlePartnerLogin = () => {
    // SECURITY: This function only checks for Venue PINs. 
    // It does NOT accept the Super Admin PIN.
    if (adminPin === SUPER_ADMIN_PIN) {
        showToast(t.invalidPin, 'error'); // Disguise Master Key as invalid here
        setAdminPin('');
        return;
    }

    const court = COURTS.find(c => (localStorage.getItem(`court_pin_${c.id}`) || c.pin) === adminPin);

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

  // Функция входа ВЛАДЕЛЬЦА (Secret)
  const handleSuperAdminLogin = () => {
      if (adminPin === SUPER_ADMIN_PIN) { 
          setAdminPin('');
          setView('super_admin_dashboard');
      } else {
          showToast("Access Denied", 'error');
          setAdminPin('');
      }
  }

  const handleToggleSuspend = (courtId: string) => {
    const newSuspended = suspendedCourts.includes(courtId)
        ? suspendedCourts.filter(id => id !== courtId)
        : [...suspendedCourts, courtId];
    
    setSuspendedCourts(newSuspended);
    localStorage.setItem('arena_suspended_courts', JSON.stringify(newSuspended));
    showToast(`Status updated for ${COURTS.find(c => c.id === courtId)?.name}`, 'success');
  };

  // Secret Gesture Handler
  const handleSecretTrigger = () => {
      // Switches the view to the secret login screen
      setView('super_admin_login');
      setAdminPin('');
  };

  // Filter courts for public view
  const visibleCourts = useMemo(() => {
      return COURTS.filter(c => !suspendedCourts.includes(c.id));
  }, [suspendedCourts]);

  return (
    <Layout lang={lang} onLangChange={setLang} onSecretTrigger={handleSecretTrigger}>
      {/* УВЕДОМЛЕНИЯ */}
      {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-full shadow-2xl flex items-center animate-in slide-in-from-top-10 fade-in duration-300 ${
              toast.type === 'error' ? 'bg-red-500 text-white' : toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
          }`}>
              <span className="font-bold text-sm">{toast.message}</span>
          </div>
      )}

      {view === 'admin_dashboard' && managedCourtId && (
        <AdminDashboard lang={lang} managedCourtId={managedCourtId} allCourts={COURTS} onBack={handleBack} />
      )}

      {view === 'super_admin_dashboard' && (
        <SuperAdminDashboard 
            lang={lang} 
            allCourts={COURTS} 
            suspendedCourts={suspendedCourts}
            onToggleSuspend={handleToggleSuspend}
            onBack={handleBack} 
        />
      )}

      {/* PUBLIC PARTNER LOGIN - Clean, no owner hints */}
      {view === 'admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-sm text-center border border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.partnerAccess}</h2>
                <p className="text-slate-400 text-sm mb-6">{t.enterPin}</p>
                
                <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
                    placeholder="••••••" maxLength={6} />
                
                <button onClick={handlePartnerLogin} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-600 transition-colors">
                    {lang === 'az' ? 'Daxil ol' : (lang === 'ru' ? 'Войти' : 'Login')}
                </button>
            </div>
        </div>
      )}

      {/* SECRET SUPER ADMIN LOGIN - Only visible via gesture */}
      {view === 'super_admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in">
            <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl w-full max-w-sm text-center border border-slate-800 relative overflow-hidden">
                {/* Visual effect for secret mode */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>
                
                <h2 className="text-2xl font-black text-white mb-2 relative z-10">SYSTEM OVERRIDE</h2>
                <p className="text-slate-400 text-sm mb-6 relative z-10">Enter Master Key</p>
                
                <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6 relative z-10"
                    placeholder="••••••" maxLength={6} autoFocus />
                
                <button onClick={handleSuperAdminLogin} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-indigo-500 transition-colors relative z-10">
                    ACCESS
                </button>
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
                    <CourtCard key={court.id} court={court} isSelected={false} onSelect={(c) => { setSelectedCourt(c); setView('booking'); }} lang={lang} />
                ))
             ) : (
                <div className="col-span-3 text-center py-12 text-slate-400">
                    <p>{t.noResults}</p>
                </div>
             )}
          </div>
          
          <SubscriptionPanel onSubscribe={(s) => { setSelectedSubscription(s); setView('subscription'); if(!selectedCourt && visibleCourts.length > 0) setSelectedCourt(visibleCourts[0]); }} lang={lang} />
          
          <button onClick={() => { setView('admin_login'); setAdminPin(''); }} className="w-full py-4 text-slate-400 text-sm font-bold opacity-50 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t.partnerAccess}
          </button>
        </div>
      )}

      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-32">
            {bookingSuccess ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-200 text-emerald-600">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h2 className="text-3xl font-black mb-4">{t.confirmed}</h2>
                    <button onClick={handleBack} className="text-indigo-600 font-bold">{t.backToDashboard}</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-5">
                        {bookingStep === 'date' ? <Calendar selectedDate={selectedDate} onDateChange={(d) => { setSelectedDate(d); setBookingStep('time'); }} lang={lang} bookedDates={bookedDates} /> : (
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                                <img src={selectedCourt.image} className="rounded-xl mb-4" />
                                <button onClick={() => setBookingStep('date')} className="w-full py-3 border rounded-xl font-bold">Изменить дату</button>
                            </div>
                        )}
                    </div>
                    <div className="lg:col-span-7">
                        {bookingStep === 'time' && <TimeGrid selectedHour={selectedHour} onHourSelect={setSelectedHour} lang={lang} reservedHours={reservedHours} dayBookings={dayBookings} />}
                    </div>
                </div>
            )}
            {showStickyButton && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
                    <button onClick={handleBook} disabled={isBooking} className="w-full bg-indigo-600 text-white py-4 rounded-2xl shadow-2xl font-bold text-lg flex justify-between px-8">
                        <span>{t.bookNow}</span>
                        <span>{isBooking ? '...' : (view === 'subscription' ? selectedSubscription?.price : selectedCourt.pricePerHour) + ' ₼'}</span>
                    </button>
                </div>
            )}
        </div>
      )}
    </Layout>
  );
};

export default App;