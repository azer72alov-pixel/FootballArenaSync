import React, { useEffect, useState } from 'react';
import { COURTS } from './constants';
import { TRANSLATIONS } from './translations';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import Calendar from './components/Calendar';
import CourtCard from './components/CourtCard';
import SubscriptionPanel from './components/SubscriptionPanel';
import TimeGrid from './components/TimeGrid';

const App: React.FC = () => {
  const [language, setLanguage] = useState<'en' | 'ru'>('en');

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  return (
    <Layout
      language={language}
      setLanguage={setLanguage}
      courts={COURTS}
      translations={TRANSLATIONS}
    >
      <AdminDashboard />
      <Calendar />
      {COURTS.map(court => <CourtCard key={court.id} court={court} />)}
      <SubscriptionPanel />
      <TimeGrid />
    </Layout>
  );
};

export default App;
