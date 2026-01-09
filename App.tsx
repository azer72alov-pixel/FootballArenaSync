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
  const [view, setView] = useState<
    'home' | 'search' | 'booking' | 'subscription' | 'admin_login' | 'admin_dashboard'
  >('home');

  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [activeImage, setActiveImage] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // admin
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      const userLang = tg.initDataUnsafe?.user?.language_code;
      if (userLang === 'ru' || userLang === 'az') {
        setLang(userLang);
      }
    }
  }, []);

  const t = TRANSLATIONS[lang];
  const locale = lang === 'az' ? 'az-AZ' : 'ru-RU';
  const isTg = !!tg?.initDataUnsafe;

  useEffect(() => {
    if (selectedCourt && selectedDate) {
      const day = selectedDate.getDate();
      const mock: number[] = [];
      if (day % 2 === 0) mock.push(19, 20, 21);
      else mock.push(9, 10, 11);
      setReservedHours(mock);
      if (selectedHour && mock.includes(selectedHour)) setSelectedHour(null);
    }
  }, [selectedCourt, selectedDate, selectedHour]);

  const filteredCourts = useMemo(
    () =>
      COURTS.filter(c =>
        `${c.name} ${c.address} ${c.type}`.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchTerm]
  );

  const handleBack = useCallback(() => {
    if (bookingStep === 'time') {
      setBookingStep('date');
      return;
    }
    setView('home');
    setSelectedCourt(null);
    setSelectedSubscription(null);
    setSelectedHour(null);
    setBookingSuccess(false);
    setBookingStep('date');
    setManagedCourtId(null);
    setAdminPin('');
  }, [bookingStep]);

  useEffect(() => {
    if (!tg) return;
    if (view !== 'home') {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else tg.BackButton.hide();
    return () => tg.BackButton.offClick(handleBack);
  }, [view, handleBack]);

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    setActiveImage(court.image);
    setView('booking');
    setBookingStep('date');
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDate(date);
    setBookingStep('time');
  };

  const handleBook = () => {
    if (!selectedCourt || selectedHour === null) return;
    setIsBooking(true);
    setTimeout(() => {
      setIsBooking(false);
      setBookingSuccess(true);
    }, 1200);
  };

  return (
    <Layout lang={lang} onLangChange={setLang}>
      {view === 'home' && (
        <>
          <section className="mb-12">
            <h1 className="text-3xl font-black">{t.heroTitlePart1}</h1>
            <p className="text-slate-500">{t.heroDesc}</p>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {COURTS.map(court => (
              <CourtCard
                key={court.id}
                court={court}
                isSelected={false}
                onSelect={handleCourtSelect}
                lang={lang}
              />
            ))}
          </section>

          <SubscriptionPanel onSubscribe={sub => {
            setSelectedSubscription(sub);
            setSelectedCourt(COURTS[0]);
            setView('subscription');
          }} lang={lang} />
        </>
      )}

      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <>
          {bookingStep === 'date' && (
            <Calendar
              selectedDate={selectedDate}
              onDateChange={handleDateSelection}
              lang={lang}
            />
          )}

          {bookingStep === 'time' && (
            <TimeGrid
              selectedHour={selectedHour}
              onHourSelect={setSelectedHour}
              reservedHours={reservedHours}
              lang={lang}
            />
          )}
        </>
      )}

      {!isTg && selectedCourt && selectedHour !== null && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white p-4 rounded-xl">
          <button onClick={handleBook} disabled={isBooking}>
            {isBooking ? '...' : t.completeBooking}
          </button>
        </div>
      )}

      {bookingSuccess && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl text-center">
            <h2 className="text-xl font-bold">{t.successTitle}</h2>
            <button onClick={handleBack} className="mt-4">
              {t.backToDashboard}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;                 
