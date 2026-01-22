import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import CourtCard from './components/CourtCard';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import NewsModal from './components/ChatWidget';
import { COURTS, NOTIFICATION_CONFIG, SUPER_ADMIN_PIN, SUBSCRIPTIONS } from './constants';
import { Court, Subscription, Section } from './types';
import { TRANSLATIONS } from './translations';
import { supabase } from './supabase';

// Helper to format date in LOCAL time (YYYY-MM-DD)
export const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC = () => {
  const tg = window.Telegram?.WebApp;
  const [lang, setLang] = useState<'az' | 'ru' | 'en'>('az');
  
  // Dynamic Courts State
  const [courts, setCourts] = useState<Court[]>(COURTS);

  // Views
  const [view, setView] = useState<'home' | 'search' | 'booking' | 'admin_login' | 'admin_dashboard' | 'super_admin_login' | '