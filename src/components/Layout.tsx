import React from 'react';
import { Court } from '../types';

interface LayoutProps {
  language: 'en' | 'ru';
  setLanguage: (lang: 'en' | 'ru') => void;
  courts: Court[];
  translations: any;
}

const Layout: React.FC<LayoutProps> = ({ language, setLanguage, courts, translations }) => {
  const t = translations[language];

  return (
    <div>
      <h1>{t.title}</h1>
      <p>{t.welcome}</p>
      <button onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}>
        Switch Language
      </button>
    </div>
  );
};

export default Layout;
