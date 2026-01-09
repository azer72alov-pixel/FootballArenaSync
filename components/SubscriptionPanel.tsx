import React from 'react';
import { SUBSCRIPTIONS } from '../constants';
import { Subscription } from '../types';
import { TRANSLATIONS } from '../translations';

interface SubscriptionPanelProps {
  onSubscribe: (sub: Subscription) => void;
  lang: 'az' | 'ru' | 'en';
}

const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({ onSubscribe, lang }) => {
  const t = TRANSLATIONS[lang];

  return (
    <div className="mt-16">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">{t.becomeMember}</h2>
        <p className="text-slate-500 max-w-2xl mx-auto">{t.memberDesc}</p>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-md">
            {SUBSCRIPTIONS.map(sub => (
            <div 
                key={sub.id} 
                onClick={() => onSubscribe(sub)}
                className="group relative bg-white rounded-3xl p-8 border border-slate-200 hover:border-indigo-600 transition-all duration-300 hover:shadow-2xl flex flex-col transform hover:-translate-y-1 cursor-pointer"
            >
                <div className={`w-16 h-16 rounded-2xl ${sub.color} flex items-center justify-center mb-6 text-white shadow-lg group-hover:scale-110 transition-transform mx-auto`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                </div>
                
                <h3 className="text-3xl font-bold text-slate-900 mb-2 text-center">{sub.name}</h3>
                <div className="mb-8 text-center">
                <span className="text-5xl font-black text-slate-900 tracking-tight">{sub.price}₼</span>
                <span className="text-slate-400 font-medium ml-1">{t.perMonth}</span>
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-center border border-slate-100">
                <div className="text-sm font-semibold text-slate-500 mb-1 uppercase tracking-wide">{t.totalIncludedTime}</div>
                <div className="text-2xl font-black text-indigo-600">{sub.hours} {t.hours}</div>
                </div>

                <ul className="space-y-4 mb-8 flex-grow px-2">
                {sub.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-slate-700 font-medium">
                    <div className="bg-emerald-100 rounded-full p-1 mr-3 flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    {feature}
                    </li>
                ))}
                </ul>

                <button 
                className="w-full py-4 px-6 rounded-2xl bg-slate-900 text-white font-bold text-lg group-hover:bg-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/30 transition-all"
                >
                {t.getStarted}
                </button>
            </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPanel;