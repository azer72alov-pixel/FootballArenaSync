import React, { useEffect } from 'react';
import { TRANSLATIONS } from '../translations';

interface LayoutProps {
  children: React.ReactNode;
  lang: 'az' | 'ru';
  onLangChange: (lang: 'az' | 'ru') => void;
}

const Layout: React.FC<LayoutProps> = ({ children, lang, onLangChange }) => {
  const t = TRANSLATIONS[lang];
  // Check if we are in Telegram
  const isTg = typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initDataUnsafe;

  useEffect(() => {
    // Ensure the Telegram background matches the app background to avoid white flickering
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.setHeaderColor('secondary_bg_color');
        window.Telegram.WebApp.setBackgroundColor('secondary_bg_color');
    }
  }, []);

  return (
    // Changed bg-slate-50 to transparent because body handles the theme color now
    <div className="min-h-screen pb-safe transition-colors duration-200" style={{ backgroundColor: 'var(--tg-theme-bg-color)' }}>
      <nav 
        className="sticky top-0 z-50 backdrop-blur-md border-b px-4 py-3 shadow-sm supports-[padding-top:env(safe-area-inset-top)]:pt-[env(safe-area-inset-top)] transition-colors duration-200"
        style={{ 
            backgroundColor: isTg ? 'var(--tg-theme-secondary-bg-color)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isTg ? 'transparent' : '#e2e8f0'
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => !isTg && window.location.reload()}>
            <div className="bg-indigo-600 p-1.5 md:p-2 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight" style={{ color: 'var(--tg-theme-text-color)' }}>
              ArenaSync
            </span>
          </div>
          
          {!isTg && (
            <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-600">
                <a href="#" className="hover:text-indigo-600 transition-colors">{t.findCourts}</a>
                <a href="#" className="hover:text-indigo-600 transition-colors">{t.subscriptions}</a>
                <a href="#" className="hover:text-indigo-600 transition-colors">{t.aboutUs}</a>
            </div>
          )}

          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="p-1 rounded-xl flex" style={{ backgroundColor: isTg ? 'var(--tg-theme-bg-color)' : '#f1f5f9' }}>
              <button 
                onClick={() => onLangChange('az')}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${lang === 'az' ? 'shadow-sm text-indigo-600' : 'text-slate-500'}`}
                style={{ backgroundColor: lang === 'az' ? (isTg ? 'var(--tg-theme-secondary-bg-color)' : 'white') : 'transparent' }}
              >
                AZ
              </button>
              <button 
                onClick={() => onLangChange('ru')}
                className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all ${lang === 'ru' ? 'shadow-sm text-indigo-600' : 'text-slate-500'}`}
                style={{ backgroundColor: lang === 'ru' ? (isTg ? 'var(--tg-theme-secondary-bg-color)' : 'white') : 'transparent' }}
              >
                RU
              </button>
            </div>
            
            {!isTg && (
                <button className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-95 hidden sm:block">
                {t.bookNow}
                </button>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {children}
      </main>
      
      {!isTg && (
        <footer className="bg-slate-900 text-white py-12 px-4 mt-12">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            <div>
                <h3 className="text-xl font-bold mb-4">ArenaSync</h3>
                <p className="text-slate-400 text-sm">Elevate your game with professional-grade facilities and seamless booking experiences.</p>
            </div>
            <div>
                <h4 className="font-semibold mb-4">{t.aboutUs}</h4>
                <ul className="text-slate-400 text-sm space-y-2">
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
                <li>Member Support</li>
                <li>Contact Facility</li>
                </ul>
            </div>
            <div>
                <h4 className="font-semibold mb-4">Connect</h4>
                <div className="flex justify-center md:justify-start space-x-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors cursor-pointer">FB</div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors cursor-pointer">TW</div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-indigo-600 transition-colors cursor-pointer">IG</div>
                </div>
            </div>
            </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;