import { createClient } from '@supabase/supabase-js';

// ==========================================
// ⚡ ПРЯМОЕ ПОДКЛЮЧЕНИЕ К БАЗЕ ⚡
// ==========================================
// Если вы используете Supabase, ключи будут здесь.
// Если нет, приложение автоматически переключится в Mock Mode.
const supabaseUrl = 'https://xxyeevnxxfkbdafyeexc.supabase.co';
const supabaseAnonKey = 'sb_publishable_ZVE0E6RBvzYO6HdOUmD7YQ_Zq4lSmAa';

// Проверка валидности ключа
const isValidKey = (key: string | undefined) => 
  key && key.length > 5 && key !== 'undefined' && key !== '';

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

  // Helper to make operations Then-able (awaitable) directly
  const executeOp = (operation: () => any) => {
      return {
          select: () => ({
              then: (resolve: any) => resolve({ data: operation().data, error: operation().error })
          }),
          then: (resolve: any) => resolve({ data: operation().data, error: operation().error })
      };
  };

  const mockChannel = { 
    on: () => mockChannel, 
    subscribe: () => mockChannel, 
    unsubscribe: () => {} 
  };

  return {
    from: (table: string) => ({
      select: (columns: string = '*') => ({
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
      
      insert: (data: any) => executeOp(() => {
          const db = getDb();
          const newRows = Array.isArray(data) ? data : [data];
          
          // Check for existing bookings
          const existing = newRows.some(newRow => 
              db.some((row: any) => row.court_id === newRow.court_id && row.date === newRow.date && row.hour === newRow.hour)
          );
          
          if (existing) {
              return { data: null, error: { code: '23505', message: 'Double booking' } };
          }
          
          const entries = newRows.map((r: any) => ({ id: Date.now() + Math.random(), ...r }));
          setDb([...db, ...entries]);
          return { data: entries, error: null };
      }),

      update: (data: any) => ({
          eq: (col: string, val: any) => executeOp(() => {
              const db = getDb();
              const newDb = db.map((row: any) => row[col] == val ? { ...row, ...data } : row);
              setDb(newDb);
              return { data: null, error: null };
          })
      }),

      delete: () => ({ 
          eq: (col: string, val: any) => executeOp(() => {
              const db = getDb();
              const newDb = db.filter((row: any) => row[col] != val);
              setDb(newDb);
              return { data: null, error: null };
          }) 
      })
    }),
    channel: () => mockChannel,
    removeChannel: () => {},
    auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
    getDb 
  } as any;
};

// Создаем клиент. Если ключи невалидны (или сеть недоступна в теории), используем Mock (но здесь проверка статическая).
export const supabase = hasRealKeys
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();