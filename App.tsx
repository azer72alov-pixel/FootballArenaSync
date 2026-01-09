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
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [userName, setUserName] = useState<string>("Guest User");
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  // Telegram init
  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();
    if (tg.initDataUnsafe?.user?.language_code) {
      const userLang = tg.initDataUnsafe.user.language_code;
      if (userLang === 'ru' || userLang === 'az') setLang(userLang);
    }
    if (tg.initDataUnsafe?.user?.first_name) {
      setUserName(
        tg.initDataUnsafe.user.first_name +
        (tg.initDataUnsafe.user.last_name ? ' ' + tg.initDataUnsafe.user.last_name : '')
      );
    }
  }, []);

  const t = TRANSLATIONS[lang];

  // Fetch bookings from Supabase
  useEffect(() => {
    if (!selectedCourt) return;
    const fetchBookings = async () => {
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
    return () => tg.BackButton.offClick(handleBack);
  }, [view, handleBack, tg]);

  const handleCourtSelect = (court: Court) => {
    setSelectedCourt(court);
    setActiveImage(court.image);
    setBookingStep('date');
    setView('booking');
  };

  const handleDateSelection = (date: Date) => {
    setSelectedDate(date);
    setBookingStep('time');
    setSelectedHour(null);
  };

  const handleHourSelection = (hour: number) => {
    setSelectedHour(hour);
  };

  const handleBook = useCallback(async () => {
    if (!selectedCourt || selectedHour === null) return;
    setIsBooking(true);
    const isSub = view === 'subscription';
    const rawAmount = isSub && selectedSubscription ? selectedSubscription.price : selectedCourt.pricePerHour;
    const amount = Math.round(rawAmount);
    const dateStr = selectedDate.toISOString().split('T')[0];

    const { error } = await supabase.from('bookings').insert({
      court_id: selectedCourt.id,
      date: dateStr,
      hour: selectedHour,
      customer_name: userName,
      status: 'pending',
      type: isSub ? 'subscription' : 'hourly',
      amount
    });

    if (error) {
      console.error('Booking failed:', error);
      setIsBooking(false);
      return;
    }

    setIsBooking(false);
    setBookingSuccess(true);
    setView('home');
    setSelectedCourt(null);
    setSelectedHour(null);
    setBookingStep('date');
  }, [selectedCourt, selectedHour, selectedDate, selectedSubscription, userName, view]);

  // Telegram MainButton
  useEffect(() => {
    if (!tg) return;
    if (bookingStep === 'time' && selectedHour !== null) {
      tg.MainButton.show();
      tg.MainButton.setText("Confirm Booking");
      tg.MainButton.onClick(handleBook);
    } else {
      tg.MainButton.hide();
    }
    return () => tg.MainButton.offClick(handleBook);
  }, [bookingStep, selectedHour, tg, handleBook]);

  return (
    <Layout lang={lang} onLangChange={setLang}>
      {(view === 'home' || view === 'search') && (
        <div className="space-y-8">
          <div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setView('search')}
              placeholder={t.searchPlaceholder}
            />
          </div>
          <div>
            {filteredCourts.map(court => (
              <CourtCard
                key={court.id}
                court={court}
                isSelected={selectedCourt?.id === court.id}
                onSelect={handleCourtSelect}
                lang={lang}
              />
            ))}
          </div>
          {view === 'home' && <SubscriptionPanel onSubscribe={() => setView('subscription')} lang={lang} />}
        </div>
      )}

      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <div className="space-y-4">
          <div className="w-full h-48">
            <img src={activeImage} alt={selectedCourt.name} className="w-full h-full object-cover rounded-lg" />
          </div>
          {bookingStep === 'date' && (
            <Calendar selectedDate={selectedDate} onDateChange={handleDateSelection} lang={lang} />
          )}
          {bookingStep === 'time' && (
            <TimeGrid
              selectedHour={selectedHour}
              onHourSelect={handleHourSelection}
              reservedHours={reservedHours}
              dayBookings={dayBookings}
              lang={lang}
            />
          )}
        </div>
      )}

      {view === 'admin_login' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <input
            type="password"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            placeholder="PIN"
          />
          <button onClick={() => {
            const court = COURTS.find(c => localStorage.getItem(`court_pin_${c.id}`) === adminPin || c.pin === adminPin);
            if (court) {
              setManagedCourtId(court.id);
              setAdminPin('');
              setView('admin_dashboard');
            } else {
              alert('Invalid PIN');
              setAdminPin('');
            }
          }}>Login</button>
          <button onClick={handleBack}>Cancel</button>
        </div>
      )}

      {view === 'admin_dashboard' && managedCourtId && (
        <AdminDashboard
          lang={lang}
          managedCourtId={managedCourtId}
          allCourts={COURTS}
          onBack={handleBack}
        />
      )}
    </Layout>
  );
};

export default App;
