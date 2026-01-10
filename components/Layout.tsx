import React, { useEffect, useState } from 'react';
import { TRANSLATIONS } from '../translations';
import { supabase } from '../supabase';
import { PLATFORM_BOT_LINK } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  lang: 'az' | 'ru' | 'en';
  onLangChange: (lang: 'az' | 'ru' | 'en') => void;
  onSecretTrigger?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, lang, onLangChange, onSecretTrigger }) => {
  const t = TRANSLATIONS[lang];
  const isTg = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initDataUnsafe;
  const [isDbReal, setIsDbReal] = useState(false);

  // Secret Trigger Logic
  const [logoTapCount, setLogoTapCount] = useState(0);

  // QR Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

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

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(PLATFORM_BOT_LINK)}&color=0f172a`;

  const copyLink = () => {
      navigator.clipboard.writeText(PLATFORM_BOT_LINK);
      if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }
      setIsQrModalOpen(false);
  };

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)] transition-colors duration-200" style={{ backgroundColor: 'var(--tg-theme-bg-color, #f8fafc)' }}>
      {/* --- QR MODAL --- */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" onClick={() => setIsQrModalOpen(false)}></div>
             <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-6 text-indigo-600 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                 </div>
                 
                 <h3 className="text-2xl font-black text-slate-900 mb-2">{t.shareApp}</h3>
                 <p className="text-slate-500 text-sm mb-6 max-w-[200px]">{t.scanToOpenApp}</p>
                 
                 <div className="bg-white p-4 rounded-3xl shadow-inner border border-slate-100 mb-8">
                     <img src={qrCodeUrl} alt="App QR" className="w-48 h-48 mix-blend-multiply" />
                 </div>

                 <div className="flex gap-3 w-full">
                     <button onClick={() => setIsQrModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                         {t.close}
                     </button>
                     <button onClick={copyLink} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                         {t.copyLink}
                     </button>
                 </div>
             </div>
        </div>
      )}

      <nav 
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
            {/* QR Button */}
            <button 
                onClick={() => setIsQrModalOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors"
                title="App QR Code"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4h2v-4zM6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>

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