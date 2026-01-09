import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import CourtCard from './components/CourtCard';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import SubscriptionPanel from './components/SubscriptionPanel';
import AdminDashboard from './components/AdminDashboard';
import { COURTS } from './constants';
import { Court, Subscription } from './types';
import { TRANSLATIONS } from './translations';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;
  const [lang, setLang] = useState<'az' | 'ru' | 'en'>('az');
  
  // View state now includes admin screens
  const [view, setView] = useState<'home' | 'search' | 'booking' | 'subscription' | 'admin_login' | 'admin_dashboard'>('home');
  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  // Booking Data
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [dayBookings, setDayBookings] = useState<{hour: number, type: string}[]>([]);
  // New state for calendar indicators
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());

  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  
  const [userName, setUserName] = useState<string>("Guest User");

  // Admin State
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  // Initialize Telegram WebApp
  useEffect(() => {
    if (tg) {
      tg.ready();
      try {
        tg.expand();
        // Force header color to white to match our app design, preventing the default Telegram header clash
        tg.setHeaderColor('#ffffff');
        tg.setBackgroundColor('#f8fafc');
      } catch (e) {
        console.log('Telegram styling error', e);
      }

      if (tg.initDataUnsafe?.user?.language_code) {
        const userLang = tg.initDataUnsafe.user.language_code;
        if (userLang === 'ru' || userLang === 'az' || userLang === 'en') setLang(userLang as 'az' | 'ru' | 'en');
      }
      
      // Format name as "Name Surname (@username)" if available
      if (tg.initDataUnsafe?.user?.first_name) {
          const user = tg.initDataUnsafe.user;
          let fullName = user.first_name;
          if (user.last_name) fullName += ` ${user.last_name}`;
          if (user.username) fullName += ` (@${user.username})`;
          setUserName(fullName);
      }
    }
  }, []);

  const t = TRANSLATIONS[lang];

  // FETCH REAL BOOKINGS FOR SELECTED DATE (Time Slots)
  const fetchBookings = useCallback(async () => {
        if (!selectedCourt) return;
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('bookings')
            .select('hour, type')
            .eq('court_id', selectedCourt.id)
            .eq('date', dateStr);

        if (data) {
            setReservedHours(data.map((b: any) => b.hour));
            setDayBookings(data.map((b: any) => ({ hour: b.hour, type: b.type })));
        }
  }, [selectedCourt, selectedDate]);

  // FETCH ALL BOOKED DATES (For Calendar Dots)
  const fetchOccupiedDates = useCallback(async () => {
        if (!selectedCourt) return;
        
        // Fetch all bookings for this court to mark calendar
        const { data, error } = await supabase
            .from('bookings')
            .select('date')
            .eq('court_id', selectedCourt.id);

        if (data) {
            const dates = new Set<string>();
            data.forEach((b: any) => dates.add(b.date));
            setBookedDates(dates);
        }
  }, [selectedCourt]);

  // Initial Fetch
  useEffect(() => {
    fetchBookings();
    fetchOccupiedDates();
  }, [fetchBookings, fetchOccupiedDates, bookingSuccess]);

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel('public:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        // Refresh bookings when any change happens in DB
        fetchBookings();
        fetchOccupiedDates();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookings, fetchOccupiedDates]);

  const filteredCourts = useMemo(() => {
    return COURTS.filter(court => 
      court.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      court.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      court.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      setView('search');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = useCallback(() => {
    if (bookingSuccess) {
        setBookingSuccess(false);
        setView('home');
        setBookingStep('date');
        setSearchTerm('');
        setSelectedCourt(null);
        setSelectedSubscription(null);
        setActiveImage('');
        setSelectedHour(null);
        setReservedHours([]);
        setDayBookings([]);
        setBookedDates(new Set());
        setManagedCourtId(null); 
        setAdminPin('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    if ((view === 'booking' || view === 'subscription') && bookingStep === 'time') {
      setBookingStep('date');
      return;
    }

    setSearchTerm('');
    setView('home');
    setSelectedCourt(null);
    setSelectedSubscription(null);
    setActiveImage('');
    setSelectedHour(null);
    setReservedHours([]);
    setDayBookings([]);
    setBookedDates(new Set());
    setManagedCourtId(null);
    setAdminPin('');
    setBookingStep('date');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setBookingSuccess(false);
  }, [view, bookingStep, bookingSuccess]);
  
  useEffect(() => {
    if (!tg) return;
    if (view !== 'home' || bookingSuccess) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else {
      tg.BackButton.hide();
    }
    return () => { tg.BackButton.offClick(handleBack); };
  }, [view, handleBack, tg, bookingSuccess]);

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    setActiveImage(court.image);
    setBookingStep('date');
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDate(date);
    setBookingStep('time');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBook = async () => {
    if (selectedHour === null || !selectedCourt) return;
    
    setIsBooking(true);
    if (tg) tg.MainButton.showProgress(false);

    const isSub = view === 'subscription';
    const rawAmount = isSub && selectedSubscription 
        ? selectedSubscription.price 
        : selectedCourt.pricePerHour;
    const amount = Math.round(rawAmount);
    const dateStr = selectedDate.toISOString().split('T')[0];

    try {
        const { error } = await supabase.from('bookings').insert({
            court_id: selectedCourt.id,
            date: dateStr,
            hour: selectedHour,
            customer_name: userName, // Now includes @username if available
            status: 'pending',
            type: isSub ? 'subscription' : 'hourly',
            amount: amount
        });

        if (error) {
            alert(`Error: ${error.message || JSON.stringify(error)}`);
            setIsBooking(false);
            if (tg) tg.MainButton.hideProgress();
            return;
        }

        // Force UI update
        setIsBooking(false);
        setBookingSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (tg) {
            tg.MainButton.hideProgress();
            tg.MainButton.hide();
            tg.HapticFeedback.notificationOccurred('success');
        }
    } catch (e) {
        setIsBooking(false);
        if (tg) tg.MainButton.hideProgress();
        alert("Booking Error: " + e);
    }
  };

  // Telegram MainButton Logic (Keep as backup)
  useEffect(() => {
    if (!tg) return;
    if ((view === 'booking' || view === 'subscription') && selectedCourt && selectedHour !== null && !bookingSuccess) {
      const isSub = view === 'subscription';
      const price = isSub && selectedSubscription 
        ? selectedSubscription.price 
        : (selectedCourt ? selectedCourt.pricePerHour : 0);
      
      tg.MainButton.text = `${isSub ? t.completeBooking : t.bookNow} - ${price}₼`;
      tg.MainButton.color = "#4f46e5";
      tg.MainButton.textColor = "#ffffff";
      tg.MainButton.show();
      tg.MainButton.onClick(handleBook);
      tg.MainButton.enable();
    } else {
      tg.MainButton.hide();
    }
    return () => { tg.MainButton.offClick(handleBook); };
  }, [view, selectedCourt, selectedHour, bookingSuccess, selectedSubscription]); 

  const handleSubscription = (sub: Subscription) => {
    setSelectedSubscription(sub);
    if (!selectedCourt) {
        setSelectedCourt(COURTS[0]);
        setActiveImage(COURTS[0].image);
    }
    setBookingStep('date');
    setView('subscription');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin Logic
  const handlePartnerAccess = () => {
    setView('admin_login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdminAuth = () => {
    let authorizedCourt = null;
    for (const court of COURTS) {
        const storedPin = localStorage.getItem(`court_pin_${court.id}`);
        const actualPin = storedPin || court.pin;
        if (actualPin === adminPin) {
            authorizedCourt = court;
            break; 
        }
    }
    if (authorizedCourt) {
        setManagedCourtId(authorizedCourt.id);
        setAdminPin('');
        setView('admin_dashboard');
    } else {
        if (tg) tg.HapticFeedback.notificationOccurred('error');
        alert(t.invalidPin);
        setAdminPin('');
    }
  };

  const locale = lang === 'az' ? 'az-AZ' : (lang === 'ru' ? 'ru-RU' : 'en-US');
  // Check if there is a selected hour to show the sticky button
  const showStickyButton = (view === 'booking' || view === 'subscription') && selectedCourt && selectedHour !== null && !bookingSuccess;

  return (
    <Layout lang={lang} onLangChange={setLang}>
      {/* ---------------- ADMIN DASHBOARD VIEW ---------------- */}
      {view === 'admin_dashboard' && managedCourtId && (
        <AdminDashboard lang={lang} managedCourtId={managedCourtId} allCourts={COURTS} onBack={handleBack} />
      )}

      {/* ---------------- ADMIN LOGIN VIEW ---------------- */}
      {view === 'admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-sm text-center border border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.partnerAccess}</h2>
                <input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
                    placeholder="••••" maxLength={4} />
                <button onClick={handleAdminAuth} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg">
                    {lang === 'az' ? 'Daxil ol' : (lang === 'ru' ? 'Войти' : 'Login')}
                </button>
                <button onClick={handleBack} className="mt-4 text-sm font-medium text-slate-400 hover:text-slate-600">
                    {lang === 'az' ? 'Ləğv et' : (lang === 'ru' ? 'Отмена' : 'Cancel')}
                </button>
            </div>
        </div>
      )}

      {/* ---------------- HOME / SEARCH VIEW ---------------- */}
      {(view === 'home' || view === 'search') && (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
          {view === 'home' && (
             <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl min-h-[400px] flex items-center">
                <div className="absolute inset-0">
                   <img src="https://images.unsplash.com/photo-1517466787929-bc90951d6db0?auto=format&fit=crop&q=80&w=2000" alt="Hero" className="w-full h-full object-cover opacity-60"/>
                   <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
                </div>
                <div className="relative z-10 p-8 md:p-12 max-w-2xl">
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
                        <span className="block text-indigo-400">{t.heroTitlePart1}</span>
                        <span className="block">{t.heroTitlePart2}</span>
                        <span className="block">{t.heroTitlePart3}</span>
                    </h1>
                    <p className="text-lg text-slate-300 font-medium leading-relaxed mb-8 max-w-lg">{t.heroDesc}</p>
                    {/* AI Tip removed here */}
                    <div className="flex flex-col sm:flex-row gap-3">
                       <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                          placeholder={t.searchPlaceholder} className="w-full bg-white text-slate-900 rounded-xl pl-4 py-4 font-semibold shadow-xl focus:outline-none" />
                    </div>
                </div>
             </div>
          )}
          
          <div id="courts-section">
             <div className="flex items-center justify-between mb-6 px-2">
                 <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{view === 'search' ? t.searchResults : t.step1}</h2>
             </div>
             {filteredCourts.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourts.map(court => (
                      <CourtCard key={court.id} court={court} isSelected={false} onSelect={handleCourtSelect} lang={lang} />
                    ))}
                 </div>
             ) : (
                 <div className="text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-300">
                     <p className="text-slate-400 font-medium">{t.noResults}</p>
                     <button onClick={() => {setSearchTerm(''); setView('home');}} className="mt-4 text-indigo-600 font-bold hover:underline">Clear Search</button>
                 </div>
             )}
          </div>
          {view === 'home' && <SubscriptionPanel onSubscribe={handleSubscription} lang={lang} />}
          {view === 'home' && (
            <div className="flex justify-center mt-12 pb-8 border-t border-slate-200 pt-8">
                <button onClick={handlePartnerAccess} className="flex items-center space-x-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 px-6 py-3 rounded-xl border border-slate-100">
                    <span className="font-bold text-sm">{t.partnerAccess}</span>
                </button>
            </div>
          )}
        </div>
      )}
      
      {/* ---------------- BOOKING FLOW ---------------- */}
      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 -mx-4 px-4 py-4 mb-6 shadow-sm supports-[top:env(safe-area-inset-top)]:top-[env(safe-area-inset-top)]">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <button onClick={handleBack} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-slate-900 leading-none">{selectedCourt.name}</h2>
                        <p className="text-xs font-medium text-slate-500 mt-1">
                             {view === 'subscription' && selectedSubscription ? selectedSubscription.name : (selectedDate ? selectedDate.toLocaleDateString(locale, {weekday:'short', day:'numeric', month:'short'}) : '')}
                        </p>
                    </div>
                    <div className="w-10"></div>
                </div>
            </div>

            {/* Success State */}
            {bookingSuccess ? (
                <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-500">
                    <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4">{t.confirmed}</h2>
                    <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">{t.successDesc}</p>
                    <button onClick={handleBack} className="text-indigo-600 font-bold hover:bg-indigo-50 px-6 py-3 rounded-xl transition-colors">
                        {t.backToDashboard}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-32">
                    <div className="lg:col-span-5 space-y-6">
                        {bookingStep === 'date' ? (
                             <Calendar 
                                selectedDate={selectedDate} 
                                onDateChange={handleDateSelection} 
                                lang={lang} 
                                bookedDates={bookedDates} 
                             />
                        ) : (
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-4">{t.bookingFor}</h3>
                                <div className="aspect-video rounded-xl overflow-hidden mb-4 relative group cursor-pointer" onClick={() => setActiveImage(selectedCourt.image)}>
                                    <img src={selectedCourt.image} className="w-full h-full object-cover" alt="Selected" />
                                </div>
                                <button onClick={() => setBookingStep('date')} className="w-full py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                                    Change Date
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <div className="lg:col-span-7">
                        {bookingStep === 'time' && (
                            <div className="animate-in slide-in-from-right-4 fade-in">
                                <TimeGrid selectedHour={selectedHour} onHourSelect={setSelectedHour} lang={lang} reservedHours={reservedHours} dayBookings={dayBookings} />
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* FLOATING ACTION BUTTON - ALWAYS VISIBLE TO FIX TG ISSUES */}
            {showStickyButton && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50 animate-in slide-in-from-bottom-10 fade-in">
                    <button 
                        onClick={handleBook}
                        disabled={isBooking}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl shadow-2xl shadow-indigo-600/40 font-bold text-lg flex items-center justify-between px-8 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-80 disabled:cursor-not-allowed"
                    >
                        <span>{view === 'subscription' ? t.completeBooking : t.bookNow}</span>
                        {isBooking ? (
                            <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <span>{view === 'subscription' && selectedSubscription ? selectedSubscription.price : selectedCourt.pricePerHour} ₼</span>
                        )}
                    </button>
                </div>
            )}
        </div>
      )}
    </Layout>
  );
};

export default App;