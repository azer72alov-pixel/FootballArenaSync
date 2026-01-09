import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// --- STATEFUL MOCK CLIENT ---
// This client mimics the Supabase API structure using LocalStorage for persistence
// when real credentials are not provided or are invalid.
const createMockClient = () => {
  console.log('⚠️ Supabase keys missing or invalid. Using LOCAL STORAGE mock.');
  const STORAGE_KEY = 'mock_bookings_db_v2';

  const getDb = () => {
      try {
          const item = localStorage.getItem(STORAGE_KEY);
          return item ? JSON.parse(item) : [];
      } catch (e) { return []; }
  };

  const setDb = (data: any[]) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  };

  // Mock Realtime Subscription
  const mockChannel = {
      on: () => mockChannel,
      subscribe: () => {
        console.log('Mock Realtime Subscribed');
        return mockChannel;
      },
      unsubscribe: () => console.log('Mock Realtime Unsubscribed')
  };

  return {
    from: (table: string) => ({
      select: (columns: string) => ({
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
        then: (resolve: any) => {
           resolve({ data: getDb(), error: null });
        }
      }),
      insert: (data: any) => ({
         select: () => ({
            then: (resolve: any) => {
                const db = getDb();
                const newRows = Array.isArray(data) ? data : [data];
                const entries = newRows.map((r: any) => ({ id: Date.now() + Math.random(), ...r }));
                const newDb = [...db, ...entries];
                setDb(newDb);
                resolve({ data: entries, error: null });
            }
         }),
         then: (resolve: any) => {
             const db = getDb();
             const rows = Array.isArray(data) ? data : [data];
             const newRows = rows.map((r: any) => ({ id: Math.floor(Math.random()*999999), ...r }));
             const newDb = [...db, ...newRows];
             setDb(newDb);
             resolve({ data: newRows, error: null });
         }
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
      delete: () => ({
          eq: (col: string, val: any) => ({
              then: (resolve: any) => {
                  const db = getDb();
                  const newDb = db.filter((row: any) => row[col] != val);
                  setDb(newDb);
                  resolve({ data: null, error: null });
              }
          })
      })
    }),
    channel: (name: string) => mockChannel,
    removeChannel: (channel: any) => {},
    auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    getDb: getDb // Helper for detection
  } as any;
};

// Check if keys are valid (Supabase keys are typically JWTs, but we allow user specific formats)
const isValidKey = (key: string | undefined) => 
  key && 
  key.length > 5 && 
  !key.includes('your-') && 
  key !== 'undefined' && 
  key !== 'null';

export const supabase = (isValidKey(supabaseUrl) && isValidKey(supabaseAnonKey))
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : createMockClient();