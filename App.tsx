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
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

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
    }
  }, []);

  const t = TRANSLATIONS[lang];

  useEffect(() => {
    if (selectedCourt && selectedDate) {
      const day = selectedDate.getDate();
      const courtIdNum = parseInt(selectedCourt.id.replace(/\D/g, '')) || 0;
      const mockReserved: number[] = [];

      if (day % 2 === 0) mockReserved.push(19, 20, 21);
      if (day % 2 !== 0) mockReserved.push(9, 10, 11);
      if (courtIdNum === 2) mockReserved.push(18);

      setReservedHours(prev => {
        const isSame = prev.length === mockReserved.length && prev.every((v, i) => v === mockReserved[i]);
        return isSame ? prev : mockReserved;
      });

      if (selectedHour && mockReserved.includes(selectedHour)) {
        setSelectedHour(null);
      }
    } else {
      setReservedHours([]);
    }
  }, [selectedCourt, selectedDate, selectedHour]);

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

  const handleBook = useCallback(() => {
    if (!selectedHour || !selectedCourt) return;
    setIsBooking(true);

    if (tg) tg.MainButton.showProgress(false);

    setTimeout(() => {
      setIsBooking(false);
      setBookingSuccess(true);
      if (tg) {
        tg.MainButton.hideProgress();
        tg.MainButton.hide();
      }
    }, 1500);
  }, [selectedHour, selectedCourt, tg]);

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
      {view === 'admin_dashboard' && managedCourtId && (
        <AdminDashboard
          lang={lang}
          managedCourtId={managedCourtId}
          allCourts={COURTS}
          onBack={handleBack}
        />
      )}

      {view === 'admin_login' && (
        <div className="animate-in fade-in zoom-in duration-300 py-10">
          <button onClick={handleBack} className="mb-8 flex items-center text-slate-500 hover:text-indigo-600 font-medium transition-colors">
            <span className="mr-2 text-xl">‹</span> {t.backToHome}
          </button>

          <div className="max-w-xs mx-auto mt-10 p-8 bg-white rounded-3xl shadow-xl shadow-indigo-100 border border-slate-100 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-xl mb-2">{t.partnerAccess}</h3>
            <p className="text-slate-400 text-sm mb-6">Enter your facility PIN code.</p>

            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="••••"
              maxLength={4}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminAuth()}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-center text-2xl font-black tracking-[0.5em] mb-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-indigo-900 placeholder-slate-300"
              autoFocus
            />

            <button
              onClick={handleAdminAuth}
              disabled={adminPin.length < 4}
              className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              Login
            </button>

            <p className="text-[10px] text-slate-300 mt-4">Demo PINs: 1001, 1002, 1003</p>
          </div>
        </div>
      )}

      {/* … Остальной JSX код остается без изменений, кроме удаления AI блока … */}
    </Layout>
  );
};

export default App;
