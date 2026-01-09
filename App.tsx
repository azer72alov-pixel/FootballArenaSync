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
  
  const [aiTip, setAiTip] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [userName, setUserName] = useState<string>("Guest User");
  
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  // Telegram initialization
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user?.language_code) {
        const userLang = tg.initDataUnsafe.user.language_code;
        if (userLang === 'ru' || userLang === 'az') setLang(userLang);
      }
      if (tg.initDataUnsafe?.user?.first_name) {
        setUserName(tg.initDataUnsafe.user.first_name + (tg.initDataUnsafe.user.last_name ? ' ' + tg.initDataUnsafe.user.last_name : ''));
      }
    }
  }, []);

  const t = TRANSLATIONS[lang];

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
    return () => tg?.BackButton.offClick(handleBack);
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
  };

  const handleBook = useCallback(async () => {
    if (!selectedHour || !selectedCourt) return;
    setIsBooking(true);
    const isSub = view === 'subscription';
    const amount = Math.round(isSub && selectedSubscription ? selectedSubscription.price : selectedCourt.pricePerHour);
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
      alert('Booking failed: ' + JSON.stringify(error));
      setIsBooking(false);
      return;
    }

    setIsBooking(false);
    setBookingSuccess(true);
  }, [selectedHour, selectedCourt, view, selectedSubscription, selectedDate, userName]);

  // Fetch bookings from Supabase
  useEffect(() => {
    const fetchBookings = async () => {
      if (!selectedCourt) return;
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data } = await supabase.from('bookings').select('hour, type').eq('court_id', selectedCourt.id).eq('date', dateStr);
      if (data) {
        setReservedHours(data.map((b: any) => b.hour));
        setDayBookings(data.map((b: any) => ({ hour: b.hour, type: b.type })));
      }
    };
    fetchBookings();
  }, [selectedCourt, selectedDate, bookingSuccess]);

  return (
    <Layout lang={lang} onLangChange={setLang}>
      {view === 'home' && <div> {/* Home screen */} </div>}

      {(view === 'booking' || view === 'subscription') && selectedCourt && (
        <div>
          {bookingSuccess ? (
            <div>
              <h2>Reservation Confirmed</h2>
              <p>{selectedCourt.name}, {selectedDate.toDateString()} {selectedHour}:00</p>
            </div>
          ) : (
            <div>
              {bookingStep === 'date' ? (
                <Calendar selectedDate={selectedDate} onDateChange={handleDateSelection} lang={lang} />
              ) : (
                <TimeGrid selectedHour={selectedHour} onHourSelect={setSelectedHour} lang={lang} reservedHours={reservedHours} dayBookings={dayBookings} />
              )}
              <button onClick={handleBook} disabled={isBooking}>
                {isBooking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;
