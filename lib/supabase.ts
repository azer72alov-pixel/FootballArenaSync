import { createClient } from '@supabase/supabase-js';

// ==========================================
// 🚨 ВСТАВЬТЕ ВАШИ ДАННЫЕ ИЗ SUPABASE НИЖЕ 🚨
// ==========================================
const MANUAL_SUPABASE_URL = "https://xxyeevnxxfkbdafyeexc.supabase.co"; // Сюда ваш URL
const MANUAL_SUPABASE_KEY = "sb_publishable_ZVE0E6RBvzYO6HdOUmD7YQ_Zq4lSmAa"; // Сюда ваш Ключ

// Безопасное получение переменных (защита от белого экрана)
const getEnv = (name: string): string | undefined => {
  try {
    // Пробуем получить из Vite (import.meta.env)
    // @ts-ignore
    if (import.meta.env && import.meta.env[name]) return import.meta.env[name];
    
    // Пробуем получить из process.env (если Vercel/Vite их подставил)
    if (typeof process !== 'undefined' && process.env) {
      return (process.env as any)[name];
    }
  } catch (e) {
    console.warn(`Could not find env variable: ${name}`);
  }
  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || MANUAL_SUPABASE_URL;
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || MANUAL_SUPABASE_KEY;

const isValidKey = (key: string | undefined) => 
  key && 
  key.length > 10 && 
  !key.includes('your-project') && 
  key !== 'undefined' &&
  key !== '';

const hasRealKeys = isValidKey(supabaseUrl) && isValidKey(supabaseAnonKey);

const createMockClient = () => {
  console.log('⚠️ Работа в локальном режиме (Offline Mock Mode).');
  const STORAGE_KEY = 'mock_bookings_db_v3';
  const getDb = () => {
      try {
          const item = localStorage.getItem(STORAGE_KEY);
          return item ? JSON.parse(item) : [];
      } catch (e) { return []; }
  };
  const setDb = (data: any[]) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  };
  const mockChannel = { 
    on: () => mockChannel, 
    subscribe: () => mockChannel, 
    unsubscribe: () => {} 
  };
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: any) => ({
          eq: (col2: string, val2: any) => ({
            then: (resolve: any) => {
               const db = getDb();
               const res = db.filter((row: any) => row[col] == val && row[col2] == val2);
               resolve({ data: res, error: null });
            }
          }),
          then: (resolve: any) => {
             const db = getDb();
             const res = db.filter((row: any) => row[col] == val);
             resolve({ data: res, error: null });
          }
        }),
        then: (resolve: any) => resolve({ data: getDb(), error: null })
      }),
      insert: (data: any) => ({
         select: () => ({
            then: (resolve: any) => {
                const db = getDb();
                const newRows = Array.isArray(data) ? data : [data];
                const existing = newRows.some(newRow => 
                    db.some((row: any) => row.court_id === newRow.court_id && row.date === newRow.date && row.hour === newRow.hour)
                );
                if (existing) {
                    resolve({ data: null, error: { code: '23505', message: 'Double booking' } });
                    return;
                }
                const entries = newRows.map((r: any) => ({ id: Date.now() + Math.random(), ...r }));
                setDb([...db, ...entries]);
                resolve({ data: entries, error: null });
            }
         }),
      }),
      update: (data: any) => ({
          eq: (col: string, val: any) => ({
              then: (resolve: any) => {
                  const db = getDb();
                  const newDb = db.map((row: any) => row[col] == val ? { ...row, ...data } : row);
                  setDb(newDb);
                  resolve({ data: null, error: null });
              }
          })
      }),
      delete: () => ({ eq: (col: string, val: any) => ({ then: (resolve: any) => {
          const db = getDb();
          const newDb = db.filter((row: any) => row[col] != val);
          setDb(newDb);
          resolve({ data: null, error: null });
      } }) })
    }),
    channel: () => mockChannel,
    removeChannel: () => {},
    auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    getDb 
  } as any;
};

// Если ключи есть — подключаемся к базе, если нет — используем имитацию (безопасно)
export const supabase = hasRealKeys
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createMockClient();
