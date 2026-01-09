import React, { useState } from 'react';
import Calendar from './components/Calendar'; // твой календарь
import TimeGrid from './components/TimeGrid';
import { TRANSLATIONS } from './translations';

type Lang = 'az' | 'ru';

const courts = ['Court 1', 'Court 2', 'Court 3']; // пример корта

const App: React.FC = () => {
  const [lang, setLang] = useState<Lang>('az');
  const [step, setStep] = useState<'court' | 'date' | 'time' | 'confirm'>('court');

  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const t = TRANSLATIONS[lang];

  const resetSelection = () => {
    setSelectedCourt(null);
    setSelectedDate(null);
    setSelectedHour(null);
    setStep('court');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6">
        {/* STEP: Choose Court */}
        {step === 'court' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">{t.chooseCourt}</h2>
            {courts.map(court => (
              <button
                key={court}
                className="py-2 px-4 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                onClick={() => {
                  setSelectedCourt(court);
                  setStep('date');
                }}
              >
                {court}
              </button>
            ))}
          </div>
        )}

        {/* STEP: Choose Date */}
        {step === 'date' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">{t.chooseDate}</h2>
            <Calendar
              selectedDate={selectedDate}
              onDateSelect={(date) => {
                setSelectedDate(date instanceof Date ? date : new Date(date));
                setStep('time');
              }}
            />
            <button
              className="py-2 px-4 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition"
              onClick={() => setStep('court')}
            >
              {t.back}
            </button>
          </div>
        )}

        {/* STEP: Choose Time */}
        {step === 'time' && selectedDate && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">{t.chooseTime}</h2>
            <TimeGrid
              selectedHour={selectedHour}
              onHourSelect={(hour) => {
                setSelectedHour(hour);
                setStep('confirm');
              }}
              lang={lang}
              dayBookings={[]} // можно подключить брони
            />
            <button
              className="py-2 px-4 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition"
              onClick={() => setStep('date')}
            >
              {t.back}
            </button>
          </div>
        )}

        {/* STEP: Confirm */}
        {step === 'confirm' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">{t.confirmReservation}</h2>
            <p>{t.court}: {selectedCourt || '-'}</p>
            <p>{t.date}: {selectedDate ? selectedDate.toLocaleDateString() : '-'}</p>
            <p>{t.time}: {selectedHour !== null ? `${selectedHour}:00` : '-'}</p>

            <button
              className="py-2 px-4 rounded-lg bg-green-600 text-white hover:bg-green-700 transition"
              onClick={() => {
                alert(`${t.confirmed}: ${selectedCourt} - ${selectedDate?.toLocaleDateString()} ${selectedHour}:00`);
                resetSelection();
              }}
            >
              {t.confirm}
            </button>

            <button
              className="py-2 px-4 rounded-lg bg-gray-300 text-gray-800 hover:bg-gray-400 transition"
              onClick={() => setStep('time')}
            >
              {t.back}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
