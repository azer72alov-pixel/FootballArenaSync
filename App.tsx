import React, { useState } from 'react';
import Layout from './components/Layout';
import Calendar from './components/Calendar';
import TimeGrid from './components/TimeGrid';
import CourtCard from './components/CourtCard';
import { TRANSLATIONS } from './translations';

type Step = 'courts' | 'calendar' | 'time' | 'confirm';

const App: React.FC = () => {
  const [lang, setLang] = useState<'az' | 'ru'>('ru');
  const t = TRANSLATIONS[lang];

  const [step, setStep] = useState<Step>('courts');
  const [selectedCourt, setSelectedCourt] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const resetAll = () => {
    setStep('courts');
    setSelectedCourt(null);
    setSelectedDate(null);
    setSelectedHour(null);
  };

  return (
    <Layout lang={lang} setLang={setLang}>
      {/* ШАГ 1 — ПЛОЩАДКИ */}
      {step === 'courts' && (
        <div className="grid gap-4">
          {['Court A', 'Court B', 'Court C'].map(court => (
            <CourtCard
              key={court}
              title={court}
              onClick={() => {
                setSelectedCourt(court);
                setStep('calendar');
              }}
            />
          ))}
        </div>
      )}

      {/* ШАГ 2 — КАЛЕНДАРЬ */}
      {step === 'calendar' && (
        <Calendar
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setStep('time');
          }}
          lang={lang}
        />
      )}

      {/* ШАГ 3 — ВЫБОР ВРЕМЕНИ */}
      {step === 'time' && (
        <>
          <TimeGrid
            selectedHour={selectedHour}
            onHourSelect={(hour) => {
              setSelectedHour(hour);
              setStep('confirm');
            }}
            lang={lang}
          />

          <button
            className="mt-4 w-full py-3 rounded-xl bg-slate-200"
            onClick={() => setStep('calendar')}
          >
            ← {t.back}
          </button>
        </>
      )}

      {/* ШАГ 4 — ПОДТВЕРЖДЕНИЕ */}
      {step === 'confirm' && (
        <div className="bg-white p-6 rounded-2xl shadow space-y-4">
          <h2 className="text-xl font-bold">{t.confirmReservation}</h2>

          <div className="text-sm text-slate-600 space-y-1">
            <div>{t.court}: {selectedCourt}</div>
            <div>{t.date}: {selectedDate?.toLocaleDateString()}</div>
            <div>{t.time}: {selectedHour}:00</div>
          </div>

          <button
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold"
            onClick={() => {
              // тут позже будет Supabase insert
              resetAll();
            }}
          >
            {t.confirm}
          </button>

          <button
            className="w-full py-2 text-sm text-slate-500"
            onClick={() => setStep('time')}
          >
            ← {t.back}
          </button>
        </div>
      )}
    </Layout>
  );
};

export default App;
