import React, { useState } from 'react';

interface CalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  lang: 'az' | 'ru' | 'en';
  bookedDates?: Set<string>; // New prop: Set of ISO strings (YYYY-MM-DD)
}

const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateChange, lang, bookedDates }) => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); 
  const locale = lang === 'az' ? 'az-AZ' : (lang === 'ru' ? 'ru-RU' : 'en-US');
  
  const getMonths = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
      months.push(date);
    }
    return months;
  };

  const months = getMonths();
  const currentMonth = months[currentMonthIndex];
  
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handlePrev = () => setCurrentMonthIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentMonthIndex(prev => Math.min(5, prev + 1));

  const dayNames = lang === 'az' 
    ? ['Be', 'Ça', 'Çə', 'Ca', 'Cu', 'Şə', 'Ba'] 
    : (lang === 'ru' 
        ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] 
        : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);

  const renderDays = () => {
    const days = [];
    const numDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);
    // Standard Monday start adjustment
    const startOffset = (firstDay + 6) % 7; 
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }

    for (let d = 1; d <= numDays; d++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      const isSelected = date.toDateString() === selectedDate.toDateString();
      const isPast = date < today;
      const isToday = date.toDateString() === today.toDateString();
      
      // Check if this date has any booking
      // Using manual ISO construction to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const isoDate = `${year}-${month}-${day}`;
      
      const hasBooking = bookedDates?.has(isoDate);

      days.push(
        <button
          key={d}
          disabled={isPast}
          onClick={() => onDateChange(date)}
          className={`h-10 w-10 rounded-full flex flex-col items-center justify-center text-sm transition-all relative
            ${isSelected ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 transform scale-110' : ''}
            ${!isSelected && !isPast ? 'hover:bg-slate-100 text-slate-700 hover:scale-105' : ''}
            ${isPast ? 'text-slate-300 cursor-not-allowed' : ''}
            ${isToday && !isSelected ? 'text-indigo-600 font-bold border-2 border-indigo-100' : ''}
          `}
        >
          {d}
          {/* Indicator Dot for bookings */}
          {!isSelected && hasBooking && !isPast && (
            <div className="absolute bottom-1.5 w-1 h-1 bg-emerald-500 rounded-full"></div>
          )}
          {/* Current day indicator handled by border, removed bottom dot to avoid clutter if booked */}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900 capitalize flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {currentMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex space-x-1 bg-slate-50 p-1 rounded-xl">
          <button onClick={handlePrev} disabled={currentMonthIndex === 0} className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={handleNext} disabled={currentMonthIndex === 5} className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-3">
        {dayNames.map(day => (
          <div key={day} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-2 gap-x-1 flex-grow content-start">
        {renderDays()}
      </div>
      
      {/* Legend for Calendar */}
      {bookedDates && bookedDates.size > 0 && (
          <div className="mt-4 flex items-center justify-center space-x-2 text-[10px] text-slate-400 font-medium">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
              <span>Has Bookings</span>
          </div>
      )}
    </div>
  );
};

export default Calendar;