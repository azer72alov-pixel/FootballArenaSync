import React, { useEffect, useState } from 'react';
import { TRANSLATIONS } from '../translations';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
  lang: 'az' | 'ru' | 'en';
  onLangChange: (lang: 'az' | 'ru' | 'en') => void;
  onSecretTrigger?: () => void; // New prop for the secret door
}

const Layout: React.FC<LayoutProps> = ({ children, lang, onLangChange, onSecretTrigger }) => {
  const t = TRANSLATIONS[lang];
  const isTg = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initDataUnsafe;
  const [isDbReal, setIsDbReal] = useState(false);

  // Secret Trigger Logic
  const [logoTapCount, setLogoTapCount] = useState(0);

  useEffect(() => {
    // Check if we are using the real Supabase client
    // @ts-ignore - checking internal property to verify if it's the real client
    const isReal = !!supabase.auth && !supabase.hasOwnProperty('getDb');
    setIsDbReal(isReal);
  }, []);

  const handleLogoTap = () => {
      const newCount = logoTapCount + 1;
      setLogoTapCount(newCount);

      // If 5 taps happen
      if (newCount >= 5) {
          if (onSecretTrigger) {
              onSecretTrigger();
              // Haptic feedback if in Telegram
              if (window.Telegram?.WebApp) {
                  window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning');
              }
          }
          setLogoTapCount(0);
      }

      // Reset count if user stops tapping for 1 second
      setTimeout(() => {
          setLogoTapCount(0);
      }, 1000);
  };

  return (
    // Changed pb-safe to pb-[env(safe-area-inset-bottom)] for robust iOS fullscreen support
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)] transition-colors duration-200" style={{ backgroundColor: 'var(--tg-theme-bg-color, #f8fafc)' }}>
      <nav 
        // Simplified pt-[env(...)] ensuring header doesn't overlap status bar
        className="sticky top-0 z-50 backdrop-blur-md border-b px-4 py-3 shadow-sm pt-[env(safe-area-inset-top)] transition-colors duration-200"
        style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#e2e8f0'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer select-none" onClick={handleLogoTap}>
            <div className="bg-indigo-600 p-1.5 md:p-2 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight text-slate-900">
              ArenaSync
            </span>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="p-1 rounded-xl flex bg-slate-100">
              <button 
                onClick={() => onLangChange('az')}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${lang === 'az' ? 'shadow-sm text-indigo-600 bg-white' : 'text-slate-500 bg-transparent'}`}
              >
                AZ
              </button>
              <button 
                onClick={() => onLangChange('ru')}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${lang === 'ru' ? 'shadow-sm text-indigo-600 bg-white' : 'text-slate-500 bg-transparent'}`}
              >
                RU
              </button>
              <button 
                onClick={() => onLangChange('en')}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${lang === 'en' ? 'shadow-sm text-indigo-600 bg-white' : 'text-slate-500 bg-transparent'}`}
              >
                EN
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {children}
      </main>
      
      {/* Small status indicator for the developer/user */}
      {!isTg && (
        <div className="fixed bottom-2 right-2 flex items-center space-x-1.5 bg-white/50 backdrop-blur px-2 py-1 rounded-full text-[8px] font-bold text-slate-400 border border-slate-100 z-50">
            <div className={`w-1.5 h-1.5 rounded-full ${isDbReal ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
            <span>{isDbReal ? 'LIVE DB' : 'LOCAL MOCK'}</span>
        </div>
      )}

      {!isTg && (
        <footer className="bg-slate-900 text-white py-12 px-4 mt-12">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
                <h3 className="text-xl font-bold mb-4">ArenaSync</h3>
                <p className="text-slate-400 text-sm">Elevate your game with professional-grade facilities and seamless booking experiences.</p>
            </div>
            </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;