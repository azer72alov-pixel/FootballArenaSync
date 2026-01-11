import React from 'react';
import { BUSINESS_HOURS } from '../constants';
import { TRANSLATIONS } from '../translations';

interface TimeGridProps {
  selectedHour: number | null;
  onHourSelect: (hour: number) => void;
  lang: 'az' | 'ru' | 'en';
  reservedHours?: number[]; // Legacy prop support if needed
  dayBookings?: { hour: number; type: string }[]; // New detail prop
}

const TimeGrid: React.FC<TimeGridProps> = ({ selectedHour, onHourSelect, lang, reservedHours, dayBookings }) => {
  const t = TRANSLATIONS[lang];

  // Group business hours into periods
  const periods = [
    { label: t.morning, hours: BUSINESS_HOURS.filter(h => h < 12) },
    { label: t.afternoon, hours: BUSINESS_HOURS.filter(h => h >= 12 && h < 17) },
    { label: t.evening, hours: BUSINESS_HOURS.filter(h => h >= 17) },
  ];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 h-full flex flex-col">
      <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
        <span className="bg-indigo-100 text-indigo-600 p-2 rounded-lg mr-3">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </span>
        {t.availableTimes}
      </h3>
      
      <div className="flex-grow space-y-6 overflow-y-auto pr-1 custom-scrollbar">
        {periods.map((period, idx) => (
          period.hours.length > 0 && (
            <div key={idx}>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center">
                {period.label}
                <span className="ml-3 flex-grow h-px bg-slate-100"></span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {period.hours.map(hour => {
                  const isSelected = selectedHour === hour;
                  
                  // Check detailed bookings first, then fall back to simple reserved array
                  const detailBooking = dayBookings?.find(b => b.hour === hour);
                  const isSimpleReserved = reservedHours?.includes(hour);
                  const isReserved = !!detailBooking || !!isSimpleReserved;
                  
                  // Determine reservation type for coloring
                  const isSubscription = detailBooking?.type === 'subscription';

                  // 24-hour format label (e.g., 17:00)
                  const label = `${hour.toString().padStart(2, '0')}:00`;
                  
                  // Base classes
                  let btnClass = "relative py-3 px-1 rounded-xl flex flex-col items-center justify-center transition-all duration-200 border-2 ";
                  
                  // State Logic
                  if (isSelected) {
                      btnClass += "bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105 z-10";
                  } else if (isReserved) {
                      if (isSubscription) {
                          // PURPLE for SUBSCRIPTIONS
                          btnClass += "bg-purple-100 text-purple-600 border-purple-200 cursor-not-allowed opacity-90";
                      } else {
                          // RED for ONE-TIME / HOURLY
                          btnClass += "bg-red-100 text-red-500 border-red-200 cursor-not-allowed opacity-90";
                      }
                  } else {
                      // GREEN (Available)
                      btnClass += "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md";
                  }

                  return (
                    <button
                      key={hour}
                      onClick={() => onHourSelect(hour)}
                      disabled={isReserved}
                      className={btnClass}
                    >
                      <span className="text-sm font-bold leading-none">{label}</span>
                      
                      {isSelected && (
                         <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                         </div>
                      )}
                      
                      {isReserved && isSubscription && (
                          <div className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full" title="Subscription"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-100 flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider justify-center">
          <div className="flex items-center">
              <div className="w-2 h-2 bg-red-400 rounded-full mr-1.5"></div>
              {t.oneTime}
          </div>
          <div className="flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></div>
              {t.subscription}
          </div>
          <div className="flex items-center">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></div>
              Free
          </div>
      </div>
    </div>
  );
};

export default TimeGrid;