import React, { useEffect, useState } from 'react';
import { BUSINESS_HOURS } from '../constants';
import { TRANSLATIONS } from '../translations';

interface TimeGridProps {
  selectedHour: number | null;
  onHourSelect?: (hour: number) => void;
  lang: 'az' | 'ru';
  reservedHours?: number[];
  dayBookings?: { hour: number; type: string }[];
}

const TimeGrid: React.FC<TimeGridProps> = ({
  selectedHour,
  onHourSelect,
  lang,
  reservedHours,
  dayBookings
}) => {
  const t = TRANSLATIONS[lang];

  // ✅ ВНУТРЕННЕЕ СОСТОЯНИЕ (КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ)
  const [localSelectedHour, setLocalSelectedHour] = useState<number | null>(null);

  // синхронизация с родителем (если он всё-таки меняет state)
  useEffect(() => {
    setLocalSelectedHour(selectedHour ?? null);
  }, [selectedHour]);

  const handleSelect = (hour: number, isReserved: boolean) => {
    if (isReserved) return;

    setLocalSelectedHour(hour);

    if (onHourSelect) {
      onHourSelect(hour);
    }
  };

  const periods = [
    { label: t.morning, hours: BUSINESS_HOURS.filter(h => h < 12) },
    { label: t.afternoon, hours: BUSINESS_HOURS.filter(h => h >= 12 && h < 17) },
    { label: t.evening, hours: BUSINESS_HOURS.filter(h => h >= 17) },
  ];

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 h-full flex flex-col">
      <h3 className="text-xl font-bold text-slate-900 mb-6">
        {t.availableTimes}
      </h3>

      <div className="flex-grow space-y-6 overflow-y-auto pr-1">
        {periods.map((period, idx) => (
          period.hours.length > 0 && (
            <div key={idx}>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">
                {period.label}
              </h4>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {period.hours.map(hour => {
                  const isSelected = localSelectedHour === hour;

                  const detailBooking = dayBookings?.find(b => b.hour === hour);
                  const isSimpleReserved = reservedHours?.includes(hour);
                  const isReserved = !!detailBooking || !!isSimpleReserved;
                  const isSubscription = detailBooking?.type === 'subscription';

                  let btnClass =
                    'py-3 rounded-xl text-center border-2 transition-all ';

                  if (isSelected) {
                    btnClass += 'bg-indigo-600 text-white border-indigo-600';
                  } else if (isReserved) {
                    btnClass += isSubscription
                      ? 'bg-purple-100 text-purple-600 border-purple-200 cursor-not-allowed'
                      : 'bg-red-100 text-red-500 border-red-200 cursor-not-allowed';
                  } else {
                    btnClass +=
                      'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
                  }

                  return (
                    <button
                      key={hour}
                      type="button"
                      className={btnClass}
                      onClick={() => handleSelect(hour, isReserved)}
                    >
                      <div className="font-bold">
                        {hour % 12 || 12}:00
                      </div>
                      <div className="text-[10px]">
                        {hour >= 12 ? 'PM' : 'AM'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default TimeGrid;
