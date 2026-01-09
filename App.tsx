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
  
  const [view, setView] = useState<'home' | 'search' | 'booking' | 'subscription' | 'admin_login' | 'admin_dashboard'>('home');
  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [dayBookings, setDayBookings] = useState<{hour: number, type: string}[]>([]);

  const [aiTip, setAiTip] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  
  const [userName, setUserName] = useState<string>("Guest User");

  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
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

  // ---------------- FETCH BOOKINGS ----------------
  useEffect(() => {
    const fetchBookings = async () => {
        if (!selectedCourt) return;
        const dateStr = selectedDate.toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('bookings')
            .select('hour, type')
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
  }, [selectedCourt, selectedDate, bookingSuccess]);

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
    setManagedCourtId(null);
    setAdminPin('');
    setBookingStep('date');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setBookingSuccess(false);
  }, [view, bookingStep]);
  
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
    setBookingStep('date');
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDate(date);
    setBookingStep('time');
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
        alert('Invalid PIN Code');
        setAdminPin('');
    }
  };

  const locale = lang === 'az' ? 'az-AZ' : 'ru-RU';
  const isTg = !!tg?.initDataUnsafe;

  return (
    <Layout lang={lang} onLangChange={setLang}>
      {/* ... ВСЯ ДРУГАЯ ЛОГИКА КОМПОНЕНТОВ ... */}

      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-5 space-y-6">
              {bookingStep === 'date' ? (
                <Calendar selectedDate={selectedDate} onDateChange={handleDateSelection} lang={lang} />
              ) : (
                <div> {/* Info о корте */}</div>
              )}
            </div>

            {/* Right Column */}
            <div className="lg:col-span-7">
              {bookingStep === 'time' && (
                <div className="animate-in slide-in-from-right-4 fade-in">
                  {/* Сетка часов */}
                  <TimeGrid 
                      selectedHour={selectedHour} 
                      onHourSelect={setSelectedHour} 
                      lang={lang} 
                      reservedHours={reservedHours}
                      dayBookings={dayBookings}
                  />

                  {/* ----------------- VISUAL BOOKINGS ----------------- */}
                  {dayBookings.length > 0 && (
                    <div className="bg-white p-4 rounded-xl shadow-md mt-6 border border-slate-200">
                      <h3 className="text-lg font-bold text-slate-900 mb-2">
                        Брони на {selectedDate.toLocaleDateString(locale)}
                      </h3>
                      <ul className="text-sm text-slate-700">
                        {dayBookings.map((b, idx) => (
                          <li key={idx}>
                            {b.hour}:00 — {b.type}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bottom Action Bar */}
                  {!isTg && selectedHour && (
                    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-40 animate-in slide-in-from-bottom-10 fade-in">
                      {/* ... кнопка бронирования ... */}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
