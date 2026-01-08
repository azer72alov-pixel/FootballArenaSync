import React from 'react';
import { Court } from '../types';
import { TRANSLATIONS } from '../translations';

interface CourtCardProps {
  court: Court;
  isSelected: boolean;
  onSelect: (court: Court) => void;
  lang: 'az' | 'ru';
}

const CourtCard: React.FC<CourtCardProps> = ({ court, isSelected, onSelect, lang }) => {
  const t = TRANSLATIONS[lang];
  const courtTypeLabel = t[court.type.toLowerCase() as keyof typeof t] || court.type;

  return (
    <div 
      onClick={() => onSelect(court)}
      className={`group relative overflow-hidden rounded-[2rem] cursor-pointer transition-all duration-300 border flex flex-col h-full bg-white ${
        isSelected 
        ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-2xl transform -translate-y-1' 
        : 'border-slate-100 hover:shadow-xl hover:border-slate-200 hover:-translate-y-1'
      }`}
    >
      <div className="h-56 w-full relative shrink-0 overflow-hidden">
        <img 
          src={court.image} 
          alt={court.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
        <div className="absolute top-4 left-4">
          <span className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-slate-900 uppercase tracking-widest shadow-sm">
            {courtTypeLabel}
          </span>
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-grow relative">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-extrabold text-slate-900 leading-tight pr-2 line-clamp-2">{court.name}</h3>
        </div>
        
        <div className="flex flex-col space-y-3 mb-4 mt-1">
          <div className="flex items-start text-xs text-slate-500 font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{court.address}</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="bg-slate-50 px-2 py-1 rounded text-[10px] font-bold text-slate-500 uppercase">5-a-side</div>
             <div className="bg-slate-50 px-2 py-1 rounded text-[10px] font-bold text-slate-500 uppercase">Synthetic</div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.perHour}</span>
              <span className="text-xl font-black text-indigo-600">{court.pricePerHour}₼</span>
          </div>
          <button className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourtCard;