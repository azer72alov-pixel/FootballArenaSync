import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import CourtCard from './components/CourtCard';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import SubscriptionPanel from './components/SubscriptionPanel';
import AdminDashboard from './components/AdminDashboard';
import { COURTS } from './constants';
import { Court, Subscription } from './types';
import { getSmartRecommendation } from './services/geminiService';
import { TRANSLATIONS } from './translations';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;
  const [lang, setLang] = useState<'az' | 'ru'>('az');
  
  // View state now includes admin screens
  const [view, setView] = useState<'home' | 'search' | 'booking' | 'subscription' | 'admin_login' | 'admin_dashboard'>('home');
  // New state for splitting Date and Time steps in booking flow
  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  // Booking Data
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [dayBookings, setDayBookings] = useState<{hour: number, type: string}[]>([]); // Added for detailed view

  const [aiTip, setAiTip] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  
  // User Name for DB
  const [userName, setUserName] = useState<string>("Guest User");

  // Admin State
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  // Initialize Telegram WebApp
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Auto-detect language from Telegram
      if (tg.initDataUnsafe?.user?.language_code) {
        const userLang = tg.initDataUnsafe.user.language_code;
        if (userLang === 'ru' || userLang === 'az') {
          setLang(userLang);
        }
      }
      
      if (tg.initDataUnsafe?.user?.first_name) {
          setUserName(tg.initDataUnsafe.user.first_name + (tg.initDataUnsafe.user.last_name ? ' ' + tg.initDataUnsafe.user.last_name : ''));
      }
    }
  }, []);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    // Only fetch AI tip on home screen to save tokens/calls
    if (view === 'home') {
        const fetchTip = async () => {
        const prompt = lang === 'az' 
            ? "Futbol üçün həftəsonu oyunu axtarıram" 
            : "Ищу место для игры в футбол на выходных";
        const tip = await getSmartRecommendation(prompt, lang);
        setAiTip(tip || "");
        };
        fetchTip();
    }
  }, [lang, view]);

  // FETCH REAL BOOKINGS FROM SUPABASE
  useEffect(() => {
    const fetchBookings = async () => {
        if (!selectedCourt) return;

        const dateStr = selectedDate.toISOString().split('T')[0];
        
        const { data, error } = await supabase
            .from('bookings')
            .select('hour, type') // Fetch type as well
            .eq('court_id', selectedCourt.id)
            .eq('date', dateStr);

        if (error) {
            console.error('Error fetching bookings:', error);
            return;
        }

        if (data) {
            setReservedHours(data.map((b: any) => b.hour));
            setDayBookings(data.map((b: any) => ({ hour: b.hour, type: b.type })));
        }
    };

    fetchBookings();
  }, [selectedCourt, selectedDate, bookingSuccess]); // Refetch when success happens

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
    // If in Time selection step, go back to Date selection
    if ((view === 'booking' || view === 'subscription') && bookingStep === 'time') {
      setBookingStep('date');
      return;
    }

    // Otherwise, go back to Home
    setSearchTerm('');
    setView('home');
    setSelectedCourt(null);
    setSelectedSubscription(null);
    setActiveImage('');
    setSelectedHour(null);
    setReservedHours([]);
    setDayBookings([]);
    setManagedCourtId(null); // Reset admin selection
    setAdminPin('');
    setBookingStep('date'); // Reset step
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setBookingSuccess(false);
  }, [view, bookingStep]);
  
  // Telegram BackButton Handler
  useEffect(() => {
    if (!tg) return;

    if (view !== 'home') {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else {
      tg.BackButton.hide();
    }

    return () => {
      tg.BackButton.offClick(handleBack);
    };
  }, [view, handleBack, tg]);

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    setActiveImage(court.image);
    setBookingStep('date'); // Always start at date
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDate(date);
    setBookingStep('time'); // Move to time selection
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBook = useCallback(async () => {
    if (!selectedHour || !selectedCourt) return;
    setIsBooking(true);
    if (tg) tg.MainButton.showProgress(false);

    const isSub = view === 'subscription';
    const rawAmount = isSub && selectedSubscription 
        ? selectedSubscription.price 
        : selectedCourt.pricePerHour;
    
    // Ensure amount is an integer (smallint in DB)
    const amount = Math.round(rawAmount);

    const dateStr = selectedDate.toISOString().split('T')[0];

    const { error } = await supabase.from('bookings').insert({
        court_id: selectedCourt.id,
        date: dateStr,
        hour: selectedHour,
        customer_name: userName,
        status: 'pending',
        type: isSub ? 'subscription' : 'hourly',
        amount: amount
    });

    if (error) {
        console.error('Booking failed detailed error:', error);
        
        let errorMsg = 'Unknown error';
        if (typeof error === 'object' && error !== null && 'message' in error) {
            errorMsg = (error as any).message;
        } else if (typeof error === 'string') {
            errorMsg = error;
        } else {
            errorMsg = JSON.stringify(error);
        }

        alert(`Booking failed: ${errorMsg}`);
        
        setIsBooking(false);
        if (tg) tg.MainButton.hideProgress();
        return;
    }

    setIsBooking(false);
    setBookingSuccess(true);
    if (tg) {
        tg.MainButton.hideProgress();
        tg.MainButton.hide();
    }
  }, [selectedHour, selectedCourt, view, selectedSubscription, selectedDate, userName, tg]);

  // Telegram MainButton Handler
  useEffect(() => {
    if (!tg) return;

    if ((view === 'booking' || view === 'subscription') && selectedCourt && selectedHour && !bookingSuccess) {
      const isSub = view === 'subscription';
      const price = isSub && selectedSubscription 
        ? selectedSubscription.price 
        : (selectedCourt ? selectedCourt.pricePerHour : 0);
      
      const label = isSub ? t.completeBooking : t.bookNow;
      const text = `${label} - ${price}₼`;
      
      tg.MainButton.text = text;
      tg.MainButton.color = "#4f46e5";
      tg.MainButton.textColor = "#ffffff";
      tg.MainButton.show();
      tg.MainButton.onClick(handleBook);
      tg.MainButton.enable();
    } else {
      tg.MainButton.hide();
    }

    return () => {
      tg.MainButton.offClick(handleBook);
    };
  }, [view, selectedCourt, selectedHour, bookingSuccess, handleBook, t.bookNow, t.completeBooking, selectedSubscription, tg]);

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
        setView('admin_dashboard'); // Go straight to dashboard
    } else {
        if (tg) tg.HapticFeedback.notificationOccurred('error');
        alert('Invalid PIN Code');
        setAdminPin('');
    }
  };

  const locale = lang === 'az' ? 'az-AZ' : 'ru-RU';
  const isTg = !!tg?.initDataUnsafe;

  return (
    <Layout 
        lang={lang} 
        onLangChange={setLang} 
    >
      {/* ---------------- ADMIN DASHBOARD VIEW ---------------- */}
      {view === 'admin_dashboard' && managedCourtId && (
        <AdminDashboard 
            lang={lang}
            managedCourtId={managedCourtId}
            allCourts={COURTS}
            onBack={handleBack}
        />
      )}

      {/* ---------------- ADMIN LOGIN VIEW ---------------- */}
      {view === 'admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-sm text-center border border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.partnerAccess}</h2>
                <p className="text-slate-500 mb-6 text-sm">{lang === 'az' ? 'Obyekt PIN kodunu daxil edin' : 'Введите PIN-код объекта'}</p>
                
                <input 
                    type="password" 
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
                    placeholder="••••"
                    maxLength={4}
                />
                
                <button 
                    onClick={handleAdminAuth}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
                >
                    {lang === 'az' ? 'Daxil ol' : 'Войти'}
                </button>
                <button 
                    onClick={handleBack}
                    className="mt-4 text-sm font-medium text-slate-400 hover:text-slate-600"
                >
                    {lang === 'az' ? 'Ləğv et' : 'Отмена'}
                </button>
            </div>
        </div>
      )}

      {/* ---------------- HOME / SEARCH VIEW ---------------- */}
      {(view === 'home' || view === 'search') && (
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Hero Section (Only Home) */}
          {view === 'home' && (
             <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl min-h-[400px] flex items-center">
                <div className="absolute inset-0">
                   <img 
                      src="https://images.unsplash.com/photo-1517466787929-bc90951d6db0?auto=format&fit=crop&q=80&w=2000" 
                      alt="Hero" 
                      className="w-full h-full object-cover opacity-60"
                   />
                   <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent"></div>
                </div>
                
                <div className="relative z-10 p-8 md:p-12 max-w-2xl">
                    <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1 mb-6 border border-white/20">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{t.heroBadge}</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
                        <span className="block text-indigo-400">{t.heroTitlePart1}</span>
                        <span className="block">{t.heroTitlePart2}</span>
                        <span className="block">{t.heroTitlePart3}</span>
                    </h1>
                    
                    <p className="text-lg text-slate-300 font-medium leading-relaxed mb-8 max-w-lg">
                        {t.heroDesc}
                    </p>

                    {/* AI TIP SECTION */}
                    {aiTip && (
                        <div className="mb-8 bg-indigo-900/50 backdrop-blur-sm border border-indigo-500/30 p-4 rounded-xl flex items-start gap-3">
                            <div className="bg-indigo-500 rounded-lg p-1.5 shrink-0 mt-0.5">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-xs font-bold text-indigo-300 uppercase block mb-1">{t.aiTipTitle}</span>
                                <p className="text-sm text-indigo-50 leading-snug">{aiTip}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                       <div className="relative flex-grow max-w-md">
                           <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                           </div>
                           <input 
                              type="text" 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                              placeholder={t.searchPlaceholder}
                              className="w-full bg-white text-slate-900 rounded-xl pl-11 pr-4 py-4 font-semibold shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30 transition-all placeholder:text-slate-400"
                           />
                       </div>
                    </div>
                </div>
             </div>
          )}
          
          {/* Search Results / Court List */}
          <div id="courts-section">
             <div className="flex items-center justify-between mb-6 px-2">
                 <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {view === 'search' ? t.searchResults : t.step1}
                 </h2>
                 {view === 'search' && (
                     <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                        {filteredCourts.length} {t.resultsFound}
                     </span>
                 )}
                 {view === 'home' && (
                    <button onClick={handlePartnerAccess} className="text-xs font-bold text-slate-300 hover:text-indigo-500 transition-colors uppercase tracking-wider">
                        Partner Access
                    </button>
                 )}
             </div>

             {filteredCourts.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCourts.map(court => (
                      <CourtCard 
                        key={court.id} 
                        court={court} 
                        isSelected={false} 
                        onSelect={handleCourtSelect}
                        lang={lang}
                      />
                    ))}
                 </div>
             ) : (
                 <div className="text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-300">
                     <p className="text-slate-400 font-medium">{t.noResults}</p>
                     <button onClick={() => {setSearchTerm(''); setView('home');}} className="mt-4 text-indigo-600 font-bold hover:underline">
                        Clear Search
                     </button>
                 </div>
             )}
          </div>
          
          {/* Subscription Section (Home only) */}
          {view === 'home' && (
              <SubscriptionPanel onSubscribe={handleSubscription} lang={lang} />
          )}
        </div>
      )}
      
      {/* ---------------- BOOKING FLOW ---------------- */}
      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Header / Summary */}
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
                    <div className="w-10"></div> {/* Spacer for center alignment */}
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
                    <p className="text-slate-500 max-w-xs mx-auto mb-8 font-medium">
                        {t.successDesc}
                    </p>
                    <div className="bg-slate-50 rounded-2xl p-6 w-full max-w-sm border border-slate-100 mb-8 text-left shadow-sm">
                        <div className="flex justify-between mb-2">
                             <span className="text-xs font-bold text-slate-400 uppercase">{t.court}</span>
                             <span className="text-sm font-bold text-slate-900 text-right">{selectedCourt.name}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                             <span className="text-xs font-bold text-slate-400 uppercase">{t.date}</span>
                             <span className="text-sm font-bold text-slate-900">{selectedDate.toLocaleDateString(locale, {weekday: 'long', day:'numeric', month: 'long'})}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                             <span className="text-xs font-bold text-slate-400 uppercase">{t.time}</span>
                             <span className="text-sm font-bold text-slate-900">{selectedHour}:00 - {selectedHour! + 1}:00</span>
                        </div>
                         <div className="flex justify-between pt-4 border-t border-slate-200 mt-2">
                             <span className="text-xs font-bold text-slate-400 uppercase">{t.totalPrice}</span>
                             <span className="text-xl font-black text-indigo-600">
                                {view === 'subscription' && selectedSubscription 
                                    ? selectedSubscription.price 
                                    : selectedCourt.pricePerHour}₼
                             </span>
                        </div>
                    </div>
                    <button onClick={handleBack} className="text-indigo-600 font-bold hover:bg-indigo-50 px-6 py-3 rounded-xl transition-colors">
                        {t.backToDashboard}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Calendar or Info */}
                    <div className="lg:col-span-5 space-y-6">
                        {bookingStep === 'date' ? (
                             <Calendar 
                                selectedDate={selectedDate} 
                                onDateChange={handleDateSelection} 
                                lang={lang}
                            />
                        ) : (
                            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                                <h3 className="font-bold text-slate-900 mb-4">{t.bookingFor}</h3>
                                <div className="aspect-video rounded-xl overflow-hidden mb-4 relative group cursor-pointer" onClick={() => setActiveImage(selectedCourt.image)}>
                                    <img src={selectedCourt.image} className="w-full h-full object-cover" alt="Selected" />
                                </div>
                                <div className="flex items-center space-x-2 text-sm text-slate-500 font-medium mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    <span>{selectedCourt.address}</span>
                                </div>
                                <button onClick={() => setBookingStep('date')} className="w-full py-3 border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                                    Change Date
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Right Column: Time Selection */}
                    <div className="lg:col-span-7">
                        {bookingStep === 'time' && (
                            <div className="animate-in slide-in-from-right-4 fade-in">
                                <TimeGrid 
                                    selectedHour={selectedHour} 
                                    onHourSelect={setSelectedHour} 
                                    lang={lang} 
                                    reservedHours={reservedHours}
                                    dayBookings={dayBookings}
                                />
                                
                                {/* Bottom Action Bar (Non-Telegram) */}
                                {!isTg && selectedHour && (
                                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-40 animate-in slide-in-from-bottom-10 fade-in">
                                        <button 
                                            onClick={handleBook}
                                            disabled={isBooking}
                                            className="w-full bg-slate-900 text-white py-4 rounded-2xl shadow-2xl shadow-slate-900/40 font-bold text-lg flex items-center justify-between px-8 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-80 disabled:cursor-not-allowed"
                                        >
                                            <span>
                                                {view === 'subscription' && selectedSubscription ? t.completeBooking : t.bookNow}
                                            </span>
                                            {isBooking ? (
                                                <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            ) : (
                                                <span>
                                                    {view === 'subscription' && selectedSubscription 
                                                        ? selectedSubscription.price 
                                                        : selectedCourt.pricePerHour} ₼
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      )}
    </Layout>
  );
};

export default App;