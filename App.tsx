import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import { COURTS } from './constants';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;
  const [view, setView] = useState<'home' | 'booking'>('home');
  const [bookingStep, setBookingStep] = useState<'date' | 'time'>('date');
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [reservedHours, setReservedHours] = useState<number[]>([]);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [userName, setUserName] = useState('Guest');

  // Telegram initialization
  useEffect(() => {
    if (!tg) return;
    tg.ready();
    tg.expand();
    if (tg.initDataUnsafe?.user?.first_name) {
      setUserName(tg.initDataUnsafe.user.first_name);
    }
  }, []);

  // Back button
  const handleBack = useCallback(() => {
    if (bookingStep === 'time') {
      setBookingStep('date');
      return;
    }
    setView('home');
    setBookingStep('date');
    setBookingSuccess(false);
    setSelectedHour(null);
  }, [bookingStep]);

  useEffect(() => {
    if (!tg) return;
    if (view === 'booking') {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else {
      tg.BackButton.hide();
    }
    return () => tg?.BackButton.offClick(handleBack);
  }, [view, handleBack]);

  // Fetch reserved hours
  useEffect(() => {
    const fetchBookings = async () => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data } = await supabase
        .from('bookings')
        .select('hour')
        .eq('court_id', selectedCourt.id)
        .eq('date', dateStr);
      if (data) setReservedHours(data.map((b: any) => b.hour));
    };
    fetchBookings();
  }, [selectedCourt, selectedDate, bookingSuccess]);

  // Handle booking
  const handleBook = async () => {
    if (!selectedHour) return;
    setIsBooking(true);
    const { error } = await supabase.from('bookings').insert({
      court_id: selectedCourt.id,
      date: selectedDate.toISOString().split('T')[0],
      hour: selectedHour,
      customer_name: userName,
      status: 'pending',
    });
    if (!error) {
      setBookingSuccess(true);
      tg?.MainButton.hide();
    }
    setIsBooking(false);
  };

  // Show Telegram MainButton
  useEffect(() => {
    if (!tg) return;
    if (bookingStep === 'time' && selectedHour && !bookingSuccess) {
      tg.MainButton.setText('Confirm Booking');
      tg.MainButton.show();
      tg.MainButton.onClick(handleBook);
    } else {
      tg.MainButton.hide();
    }
    return () => tg?.MainButton.offClick(handleBook);
  }, [bookingStep, selectedHour, bookingSuccess]);

  return (
    <Layout>
      {view === 'home' && (
        <div className="home-screen">
          <h1>Welcome to ArenaSync</h1>
          <button onClick={() => setView('booking')}>Book a Court</button>
        </div>
      )}

      {view === 'booking' && selectedCourt && (
        <div className="booking-screen">
          <h2>{selectedCourt.name}</h2>
          {!bookingSuccess ? (
            <div>
              {bookingStep === 'date' ? (
                <Calendar
                  selectedDate={selectedDate}
                  onDateChange={(date) => {
                    setSelectedDate(date);
                    setBookingStep('time');
                  }}
                />
              ) : (
                <TimeGrid
                  reservedHours={reservedHours}
                  selectedHour={selectedHour}
                  onHourSelect={setSelectedHour}
                />
              )}
              {isBooking && <p>Booking...</p>}
            </div>
          ) : (
            <div className="confirmation">
              <h3>Booking Confirmed!</h3>
              <p>
                {selectedCourt.name} on {selectedDate.toDateString()} at {selectedHour}:00
              </p>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;
