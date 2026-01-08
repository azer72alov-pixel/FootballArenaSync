import React from 'react';
import { Court } from '../types';

interface LayoutProps {
  language: 'en' | 'ru';
  setLanguage: (lang: 'en' | 'ru') => void;
  courts: Court[];
  translations: any;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  language,
  setLanguage,
  courts,
  translations,
  children,
}) => {
  const t = translations[language];

  return (
    <div>
      <header>
        <h1>{t.title}</h1>
        <p>{t.welcome}</p>
        <button onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}>
          Switch Language
        </button>
      </header>

      <main>
        {children}
      </main>
    </div>
  );
};

export default Layout;
