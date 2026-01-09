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
import './index.css';

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
  const [userName, setUserName] = useState<string>("Guest User");
  const [managedCourtId, setManagedCourtId] = useState<string | null>(null);
  const [adminPin, setAdminPin] = useState('');

  useEffect(() => {
    if (tg) {
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
  }, []);

  return (
    <Layout lang={lang} onLangChange={setLang}>
      {(view === 'home' || view === 'search') && (
        <div className="space-y-8">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setView('search')}
            placeholder={t.searchPlaceholder}
          />
          {filteredCourts.map(court => (
            <CourtCard
              key={court.id}
              court={court}
              isSelected={false}
              onSelect={() => setSelectedCourt(court)}
              lang={lang}
            />
          ))}
        </div>
      )}
      {view === 'booking' && selectedCourt && (
        <div>
          {bookingStep === 'date' && (
            <Calendar selectedDate={selectedDate} onDateChange={setSelectedDate} lang={lang} />
          )}
          {bookingStep === 'time' && (
            <TimeGrid selectedHour={selectedHour} onHourSelect={setSelectedHour} lang={lang} reservedHours={reservedHours} dayBookings={dayBookings} />
          )}
        </div>
      )}
    </Layout>
  );
};

export default App;
