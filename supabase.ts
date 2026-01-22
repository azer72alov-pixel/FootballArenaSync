import { createClient } from '@supabase/supabase-js';

// ===== Уникальный ключ пользователя =====
let userKey: string;

if (typeof window !== 'undefined') {
  // Telegram WebApp
  // Используем initDataUnsafe для получения реального ID пользователя
  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    const tg = window.Telegram.WebApp;
    const user = tg.initDataUnsafe.user;
    userKey = `tg_${user.id}`;
    console.log('Telegram userKey:', userKey);
  } else {
    // APK или веб без Telegram (или старая версия TG без данных)
    const STORAGE_KEY = 'app_userKey';
    let storedKey = localStorage.getItem(STORAGE_KEY);
    
    if (!storedKey) {
      // Fallback для старых браузеров без crypto.randomUUID
      const randomId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Date.now().toString(36) + Math.random().toString(36).substring(2);
      
      storedKey = `apk_${randomId}`;
      localStorage.setItem(STORAGE_KEY, storedKey);
    }
    userKey = storedKey;
    console.log('APK/Веб userKey:', userKey);
  }
} else {
  userKey = 'guest';
}

export { userKey };

// ==========================================
// ⚡ Подключение к Supabase ⚡
// ВНИМАНИЕ: Для работы синхронизации вы должны вставить сюда свои реальные ключи Supabase.
// Получите их на https://supabase.com/dashboard/project/_/settings/api
const supabaseUrl = 'https://xxyeevnxxfkbdafyeexc.supabase.co';
const supabaseAnonKey = 'sb_publishable_ZVE0E6RBvzYO6HdOUmD7YQ_Zq4lSmAa';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);