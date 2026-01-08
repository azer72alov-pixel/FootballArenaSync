import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Create a mock client if keys are missing to prevent crash during development/setup
const createMockClient = () => {
  console.log('⚠️ Supabase keys missing. Using mock client in DEMO MODE (Success).');
  
  // Return SUCCESS to allow UI testing without DB
  const successResult = { 
    data: [], 
    error: null 
  };

  const mockBuilder: any = {
    select: () => mockBuilder,
    insert: () => mockBuilder,
    update: () => mockBuilder,
    delete: () => mockBuilder,
    eq: () => mockBuilder,
    order: () => mockBuilder,
    single: () => mockBuilder,
    // The builder is then-able, returning success when awaited
    then: (resolve: any) => resolve(successResult)
  };

  return {
    from: () => mockBuilder
  } as any;
};

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();