import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TRANSLATIONS } from '../translations';
import { SUBSCRIPTIONS } from '../constants';
import { Court, Section } from '../types';
import Calendar from './Calendar';
import TimeGrid from './TimeGrid';
import { supabase } from '../supabase';
import { formatDateLocal } from '../App'; 

interface AdminDashboardProps {
  lang: 'az' | 'ru' | 'en';
  managedCourtId: string;
  allCourts: Court[];
  onBack: () => void;
  onUpdateSettings: (courtId: string, settings: { pricePerHour?: number, subscriptionPrice?: number }) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, managedCourtId, allCourts, onBack, onUpdateSettings }) => {
  const t = TRANSLATIONS[lang];
  const court = allCourts.find(c => c.id === managedCourtId);

  // Tab State: Added 'announcements'
  const [activeTab, setActiveTab] = useState<'hourly' | 'subscription' | 'settings' | 'sections' | 'announcements'>('hourly');

  // Calendar State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [bookingType, setBookingType] = useState<'hourly' | 'subscription'>('hourly');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(SUBSCRIPTIONS[0]?.id || '');
  
  // Settings State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [priceInput, setPriceInput] = useState<string>(court?.pricePerHour.toString() || '30');
  const [subPriceInput, setSubPriceInput] = useState<string>(court?.subscriptionPrice.toString() || '100');
  const [saveMessage, setSaveMessage] = useState({ text: '', type: '' });

  // Section Management State
  const [sections, setSections] = useState<Section[]>([]);
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDays, setNewSectionDays] = useState<number[]>([]);
  const [newSectionStart, setNewSectionStart] = useState(16);
  const [newSectionDuration, setNewSectionDuration] = useState(2);

  // Announcement State
  const [announcementText, setAnnouncementText] = useState('');
  const [targetSectionId, setTargetSectionId] = useState<string>('all'); // 'all' or section UUID

  // Sound & Notification State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notification, setNotification] = useState<{message: string, visible: boolean} | null>(null);
  
  // Audio Ref - Using a gentle chime sound
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Store bookings from DB
  const [localBookings, setLocalBookings] = useState<any[]>([]);

  // Initialize Audio & Sections
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    
    // Load sections from local storage
    if (managedCourtId) {
        const stored = localStorage.getItem(`court_sections_${managedCourtId}`);
        if (stored) setSections(JSON.parse(stored));
    }
  }, [managedCourtId]);

  // Update local price inputs if prop changes
  useEffect(() => {
      if (court) {
          setPriceInput(court.pricePerHour.toString());
          setSubPriceInput(court.subscriptionPrice.toString());
      }
  }, [court]);

  // Play sound function
  const playNotification = () => {
      if (soundEnabled && audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log('Audio playback prevented by browser:', e));
      }
  };

  // Show visual toast
  const showNotification = (msg: string) => {
      setNotification({ message: msg, visible: true });
      setTimeout(() => {
          setNotification(prev => prev && prev.message === msg ? { ...prev, visible: false } : prev);
      }, 5000);
  };

  // FETCH BOOKINGS
  const fetchAllBookings = async () => {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('court_id', managedCourtId);
    
    if (data) {
        // Mapping DB columns to component state structure
        const mapped = data.map((b: any) => ({
            id: b.id,
            customer: b.customer_name,
            courtId: b.court_id,
            time: `${b.hour}:00 - ${b.hour + 1}:00`,
            amount: b.amount,
            status: b.status,
            dateStr: b.date,
            hour: b.hour,
            type: b.type
        }));
        setLocalBookings(mapped);
    }
  };

  useEffect(() => {
    fetchAllBookings();
    const channel = supabase
      .channel('admin:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new.court_id === managedCourtId) {
             const hour = payload.new.hour;
             const date = payload.new.date;
             playNotification();
             showNotification(`${t.newBookingAlert} ${date} @ ${hour}:00`);
             if (window.Telegram?.WebApp) {
                 window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
             }
        }
        fetchAllBookings();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [managedCourtId, soundEnabled]); 

  // 1. Calculate which dates have ANY bookings (for Calendar dots)
  const bookedDatesSet = useMemo(() => {
    const dates = new Set<string>();
    localBookings.forEach(b => dates.add(b.dateStr));
    return dates;
  }, [localBookings]);

  // 2. Calculate bookings + sections for the CURRENTLY selected date (for TimeGrid)
  const dayBookings = useMemo(() => {
    // A. Real DB Bookings
    const dateKey = formatDateLocal(selectedDate);
    const dbBookings = localBookings.filter(b => b.dateStr === dateKey);

    // B. Virtual Section Bookings
    const dayOfWeek = selectedDate.getDay();
    const activeSections = sections.filter(s => s.days.includes(dayOfWeek));
    const sectionBookings: any[] = [];
    
    activeSections.forEach(s => {
        for(let i=0; i<s.duration; i++) {
            const h = s.startHour + i;
            sectionBookings.push({
                hour: h,
                type: 'section',
                // Mock data to match structure
                id: `sec_${s.id}_${h}`,
                customer: s.name,
                status: 'occupied'
            });
        }
    });

    return [...dbBookings, ...sectionBookings];
  }, [selectedDate, localBookings, sections]);

  // 3. Filter bookings for the Bottom Table based on Active Tab
  const tableBookings = useMemo(() => {
      if (activeTab === 'settings' || activeTab === 'sections' || activeTab === 'announcements') return [];
      return localBookings.filter(b => b.type === activeTab);
  }, [localBookings, activeTab]);

  useEffect(() => {
    if (isModalOpen && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isModalOpen]);

  const handleApprove = async (id: number) => {
    const { error } = await supabase.from('bookings').update({ status: 'paid' }).eq('id', id);
    if (!error) {
        setLocalBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'paid' } : b));
    }
  };

  const handleReject = async (id: number) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (!error) {
        setLocalBookings(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleHourToggle = (hour: number) => {
      const isTaken = dayBookings.some(b => b.hour === hour);
      if (!isTaken) {
          setSelectedHour(hour); 
          setCustomerNameInput('');
          setBookingType(activeTab === 'subscription' ? 'subscription' : 'hourly'); 
          if (SUBSCRIPTIONS.length > 0) setSelectedPlanId(SUBSCRIPTIONS[0].id);
          setIsModalOpen(true);
      }
  };

  const handleModalConfirm = async () => {
    if (selectedHour !== null && customerNameInput.trim()) {
        const basePrice = court?.pricePerHour || 30;
        const subPrice = court?.subscriptionPrice || 100;
        const newRows = [];
        const dateStr = formatDateLocal(selectedDate);

        if (bookingType === 'hourly') {
            newRows.push({
                court_id: managedCourtId,
                date: dateStr,
                hour: selectedHour,
                customer_name: customerNameInput,
                status: 'paid',
                type: 'hourly',
                amount: basePrice
            });
        } else {
            const plan = SUBSCRIPTIONS.find(s => s.id === selectedPlanId);
            const iterations = plan ? plan.hours : 4; 
            const planPrice = subPrice; 

            for (let i = 0; i < iterations; i++) {
                const nextDate = new Date(selectedDate);
                nextDate.setDate(selectedDate.getDate() + (i * 7)); 
                const dStr = formatDateLocal(nextDate);
                
                newRows.push({
                    court_id: managedCourtId,
                    date: dStr,
                    hour: selectedHour,
                    customer_name: `${customerNameInput} (${t.subscription} ${i+1}/${iterations})`,
                    status: 'paid',
                    type: 'subscription',
                    amount: i === 0 ? planPrice : 0
                });
            }
        }

        const { error } = await supabase.from('bookings').insert(newRows).select();
        if (error) { alert("Error saving booking"); return; }
        closeModal();
    }
  };

  const closeModal = () => { setIsModalOpen(false); setSelectedHour(null); };
  
  const handlePriceSave = () => {
      const p = parseFloat(priceInput);
      const s = parseFloat(subPriceInput);
      if (!isNaN(p) && p > 0 && !isNaN(s) && s > 0) {
          onUpdateSettings(managedCourtId, { pricePerHour: p, subscriptionPrice: s });
          setSaveMessage({ text: t.priceUpdated, type: 'success' });
          setTimeout(() => setSaveMessage({ text: '', type: '' }), 3000);
      } else {
          setSaveMessage({ text: t.priceUpdateError, type: 'error' });
      }
  };

  const handlePinChange = () => {
      if(!court) return;
      const storedPin = localStorage.getItem(`court_pin_${court.id}`);
      const actualCurrentPin = storedPin || court.pin;
      if (oldPin !== actualCurrentPin) { setSaveMessage({ text: t.pinError, type: 'error' }); return; }
      if (newPin.length !== 6) { setSaveMessage({ text: lang === 'az' ? 'PIN 6 rəqəm olmalıdır' : 'PIN must be 6 digits', type: 'error' }); return; }
      if (allCourts.some(c => c.pin === newPin && c.id !== court.id)) { setSaveMessage({ text: t.pinError, type: 'error' }); return; }
      localStorage.setItem(`court_pin_${court.id}`, newPin);
      setSaveMessage({ text: t.pinUpdated, type: 'success' });
      setOldPin(''); setNewPin('');
      setTimeout(() => setSaveMessage({ text: '', type: '' }), 3000);
  };

  const handlePostAnnouncement = async () => {
      if (!announcementText.trim()) return;

      const payload = {
          court_id: managedCourtId,
          section_id: targetSectionId === 'all' ? null : targetSectionId,
          message: announcementText,
          sender_name: court?.name || 'Coach',
          created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('announcements').insert([payload]);

      if (!error) {
          setAnnouncementText('');
          showNotification(t.announcementPosted);
          if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      } else {
          showNotification("Error posting announcement");
      }
  };

  // Section Management Handlers
  const handleAddSection = () => {
      if (!newSectionName || newSectionDays.length === 0) return;
      const newSection: Section = {
          id: Date.now().toString(),
          name: newSectionName,
          days: newSectionDays,
          startHour: newSectionStart,
          duration: newSectionDuration
      };
      const updated = [...sections, newSection];
      setSections(updated);
      localStorage.setItem(`court_sections_${managedCourtId}`, JSON.stringify(updated));
      setNewSectionName('');
      setNewSectionDays([]);
      showNotification(t.sectionAdded);
  };

  const handleDeleteSection = (id: string) => {
      const updated = sections.filter(s => s.id !== id);
      setSections(updated);
      localStorage.setItem(`court_sections_${managedCourtId}`, JSON.stringify(updated));
  };

  const toggleDay = (day: number) => {
      setNewSectionDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?court=${managedCourtId}`)}&color=0f172a`;

  const revenue = localBookings.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0);
  const activeCount = localBookings.length;
  const occupancy = Math.round((activeCount / 10) * 100); 

  const stats = [
    { title: t.todaysRevenue, value: `${revenue} ₼`, change: '+12%', color: 'bg-emerald-500', icon: '💰' },
    { title: t.activeBookings, value: activeCount.toString(), change: '+3', color: 'bg-blue-500', icon: '📅' },
    { title: t.occupancyRate, value: `${occupancy}%`, change: '+5%', color: 'bg-purple-500', icon: '📈' },
  ];

  const getSubscriptionPreviewDates = () => {
      if (bookingType !== 'subscription') return [];
      const plan = SUBSCRIPTIONS.find(s => s.id === selectedPlanId);
      const count = plan ? plan.hours : 4;
      const dates = [];
      for(let i=0; i<count; i++) {
          const d = new Date(selectedDate);
          d.setDate(selectedDate.getDate() + (i * 7));
          dates.push(d.toLocaleDateString(lang === 'az' ? 'az-AZ' : (lang === 'ru' ? 'ru-RU' : 'en-US'), {day: 'numeric', month: 'short'}));
      }
      return dates;
  }

  if (!court) return <div>Error: Court not found</div>;

  return (
    <div className="animate-in fade-in duration-500 pb-20 relative">
      
      {/* ---------------- ALERT NOTIFICATION ---------------- */}
      {notification && notification.visible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm">
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-10 fade-in duration-300 border border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse"></div>
                    <span className="font-bold text-sm">{notification.message}</span>
                </div>
                <button onClick={() => setNotification(prev => prev ? {...prev, visible: false} : null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
        </div>
      )}

      {/* ---------------- MODAL ---------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal}></div>
            <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
                <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center text-white shadow-lg ${bookingType === 'subscription' ? 'bg-purple-600 shadow-purple-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
                    {bookingType === 'subscription' ? (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                    {lang === 'az' ? 'Yeni Rezervasiya' : (lang === 'ru' ? 'Новое бронирование' : 'New Booking')}
                </h3>
                <p className="text-slate-400 text-sm font-medium mb-6">
                    {bookingType === 'subscription' ? t.subscription : t.oneTime}
                </p>

                <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                         <span>{selectedDate.toLocaleDateString(lang === 'az' ? 'az-AZ' : (lang === 'ru' ? 'ru-RU' : 'en-US'), {weekday: 'long', day:'numeric', month:'short'})}</span>
                         <span className="font-bold text-slate-900">{selectedHour}:00 - {selectedHour! + 1}:00</span>
                    </div>

                    {bookingType === 'subscription' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                             <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                {t.selectPlan}
                            </label>
                            <select 
                                value={selectedPlanId}
                                onChange={(e) => setSelectedPlanId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 appearance-none"
                            >
                                {SUBSCRIPTIONS.map(sub => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.name} ({sub.hours} {t.gamesCount}) - {court.subscriptionPrice}₼
                                    </option>
                                ))}
                            </select>
                            
                            <div className="bg-purple-50 rounded-xl p-3 text-xs">
                                <span className="text-purple-800 font-bold block mb-1">{t.futureDates}</span>
                                <div className="text-purple-600 flex flex-wrap gap-1">
                                    {getSubscriptionPreviewDates().map((d, i) => (
                                        <span key={i} className="bg-white px-1.5 py-0.5 rounded border border-purple-100">{d}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            {lang === 'az' ? 'Müştəri adı' : (lang === 'ru' ? 'Имя клиента' : 'Customer Name')}
                        </label>
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={customerNameInput}
                            onChange={(e) => setCustomerNameInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
                            className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:ring-2 ${bookingType === 'subscription' ? 'focus:ring-purple-500' : 'focus:ring-indigo-500'}`}
                            placeholder={lang === 'az' ? 'Ad daxil edin...' : (lang === 'ru' ? 'Введите имя...' : 'Enter name...')}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                     <span className="text-sm font-medium text-slate-500">{t.totalTotal}</span>
                     <span className="text-xl font-black text-slate-900">
                         {bookingType === 'hourly' 
                            ? `${court.pricePerHour} ₼` 
                            : `${court.subscriptionPrice} ₼`
                         }
                     </span>
                </div>

                <div className="flex space-x-3">
                    <button 
                        onClick={closeModal}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        {lang === 'az' ? 'Ləğv et' : (lang === 'ru' ? 'Отмена' : 'Cancel')}
                    </button>
                    <button 
                        onClick={handleModalConfirm}
                        disabled={!customerNameInput.trim()}
                        className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${bookingType === 'subscription' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                    >
                        {lang === 'az' ? 'Təsdiqlə' : (lang === 'ru' ? 'Подтвердить' : 'Confirm')}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Header and Back Button */}
      <div className="flex items-center justify-between mb-6">
        <button 
            onClick={onBack}
            className="flex items-center text-slate-500 hover:text-indigo-600 font-medium transition-colors"
        >
            <span className="mr-2 text-xl">‹</span> {t.backToDashboard}
        </button>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${soundEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
            >
                {soundEnabled ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        {t.soundOn}
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 1.414L10.414 12l3.293 3.293a1 1 0 01-1.414 1.414L9 13.414l-3.293 3.293a1 1 0 01-1.414-1.414L7.586 12 4.293 8.707a1 1 0 011.414-1.414L9 10.586l3.293-3.293z" clipRule="evenodd" /></svg>
                        {t.soundOff}
                    </>
                )}
            </button>
            <div className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                Admin Mode
            </div>
        </div>
      </div>

      {/* Owner Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-8 flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shrink-0">
              <img src={court.image} alt={court.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-indigo-500 tracking-wider mb-1">{t.partnerAccess}</div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">{court.name}</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-400 text-sm">{court.address}</span>
                <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-xs font-bold">{court.pricePerHour} ₼/hr</span>
            </div>
          </div>
      </div>

      {/* TABS */}
      <div className="flex p-1 bg-slate-100 rounded-2xl mb-8 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('hourly')}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'hourly' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
              {t.tabHourly}
          </button>
          <button 
            onClick={() => setActiveTab('subscription')}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'subscription' ? 'bg-white shadow-md text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
              {t.tabSubscriptions}
          </button>
          <button 
            onClick={() => setActiveTab('sections')}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'sections' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
              {t.tabSections}
          </button>
          <button 
            onClick={() => setActiveTab('announcements')}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'announcements' ? 'bg-white shadow-md text-pink-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
              {t.tabAnnouncements}
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-bold text-sm transition-all duration-300 ${activeTab === 'settings' ? 'bg-white shadow-md text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
              {t.tabSettings}
          </button>
      </div>

      {activeTab === 'settings' ? (
          <div className="bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 animate-in fade-in slide-in-from-right-4">
              <div className="max-w-md mx-auto">
                  <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{t.priceSettings}</h3>
                  </div>

                  <div className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {t.pricePerHourLabel}
                          </label>
                          <div className="flex gap-2 mb-4">
                            <input 
                                type="number"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {t.subscriptionPriceLabel}
                          </label>
                          <div className="flex gap-2">
                             <input 
                                type="number"
                                value={subPriceInput}
                                onChange={(e) => setSubPriceInput(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <button onClick={handlePriceSave} className="w-full mt-4 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                                {t.saveChanges}
                          </button>
                      </div>

                      <div className="border-t border-slate-100 pt-6">
                          <h3 className="text-xl font-bold text-slate-900 text-center mb-4">{t.securitySettings}</h3>
                          <p className="text-slate-500 text-sm text-center mb-4">{t.changePin}</p>
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.currentPin}</label>
                              <input type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} maxLength={6} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-400 text-center text-lg" placeholder="••••••" />
                          </div>
                          <div className="mt-4">
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.newPin}</label>
                              <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} maxLength={6} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-400 text-center text-lg" placeholder="••••••" />
                          </div>
                          <button onClick={handlePinChange} disabled={oldPin.length < 6 || newPin.length < 6} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 mt-4 disabled:opacity-50">{t.saveChanges}</button>
                      </div>
                      {saveMessage.text && <div className={`p-3 rounded-xl text-sm font-bold text-center animate-in fade-in slide-in-from-bottom-2 ${saveMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{saveMessage.text}</div>}
                      <div className="pt-8 mt-8 border-t border-slate-100">
                          <h3 className="text-lg font-bold text-slate-900 text-center mb-4">{t.venueQr}</h3>
                          <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 flex flex-col items-center">
                              <img src={qrCodeUrl} alt="Venue QR Code" className="w-48 h-48 mb-4 rounded-lg mix-blend-multiply" />
                              <button onClick={() => window.open(qrCodeUrl, '_blank')} className="text-indigo-600 text-sm font-bold hover:underline">{t.printQr}</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      ) : activeTab === 'sections' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              {/* Add New Section Card */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-6">{t.createSection}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.sectionName}</label>
                          <input 
                              type="text" 
                              value={newSectionName}
                              onChange={(e) => setNewSectionName(e.target.value)}
                              placeholder="e.g. Junior Team U-12"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.selectDays}</label>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                              {[1, 2, 3, 4, 5, 6, 0].map(day => (
                                  <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shrink-0 ${
                                        newSectionDays.includes(day) ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                      {t.weekDays[day as keyof typeof t.weekDays]}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.selectTime}</label>
                              <select 
                                value={newSectionStart} 
                                onChange={(e) => setNewSectionStart(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold"
                              >
                                  {Array.from({length: 14}, (_, i) => i + 9).map(h => (
                                      <option key={h} value={h}>{h}:00</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.duration}</label>
                              <select 
                                value={newSectionDuration} 
                                onChange={(e) => setNewSectionDuration(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold"
                              >
                                  <option value={1}>1 hr</option>
                                  <option value={2}>2 hrs</option>
                                  <option value={3}>3 hrs</option>
                              </select>
                          </div>
                      </div>
                      <button 
                        onClick={handleAddSection}
                        disabled={!newSectionName || newSectionDays.length === 0}
                        className="w-full py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200 disabled:opacity-50"
                      >
                          {t.addSection}
                      </button>
                  </div>
              </div>

              {/* Sections List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sections.map(section => (
                      <div key={section.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full -mr-8 -mt-8"></div>
                          <h4 className="font-bold text-slate-900 text-lg mb-2 relative z-10">{section.name}</h4>
                          <div className="flex gap-1 mb-3 relative z-10">
                              {section.days.map(d => (
                                  <span key={d} className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                                      {t.weekDays[d as keyof typeof t.weekDays]}
                                  </span>
                              ))}
                          </div>
                          <div className="flex justify-between items-center relative z-10">
                              <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                                  {section.startHour}:00 - {section.startHour + section.duration}:00
                              </span>
                              <button 
                                onClick={() => handleDeleteSection(section.id)}
                                className="text-slate-400 hover:text-red-500 text-xs font-bold"
                              >
                                  {t.deleteSection}
                              </button>
                          </div>
                      </div>
                  ))}
                  {sections.length === 0 && (
                      <div className="col-span-full text-center py-8 text-slate-400 text-sm">
                          No sections created yet.
                      </div>
                  )}
              </div>
          </div>
      ) : activeTab === 'announcements' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
               <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-200">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">{t.postAnnouncement}</h3>
                  
                  {/* Target Audience Selector */}
                  <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t.targetAudience}</label>
                      <select 
                        value={targetSectionId}
                        onChange={(e) => setTargetSectionId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-500"
                      >
                          <option value="all">{t.allParents}</option>
                          {sections.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                  </div>

                  <textarea 
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder={t.typeAnnouncement}
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none mb-4"
                  />
                  <button 
                    onClick={handlePostAnnouncement}
                    disabled={!announcementText.trim()}
                    className="w-full py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200 disabled:opacity-50"
                  >
                      {t.chatSend}
                  </button>
               </div>
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                   ℹ️ {lang === 'az' ? 'Burada yazılan mesajlar dərhal bütün valideynlərin telefonunda görünəcək.' : (lang === 'ru' ? 'Сообщения, написанные здесь, мгновенно появятся у всех родителей.' : 'Messages posted here will instantly appear for all parents.')}
               </div>
          </div>
      ) : (
        <>
            {/* Stats Cards - Always visible in management tabs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {stats.map((stat, idx) => (
                <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-[4rem] -mr-4 -mt-4 z-0"></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider">{stat.title}</h3>
                        <div className="text-2xl">{stat.icon}</div>
                        </div>
                        <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{stat.change}</span>
                        </div>
                    </div>
                </div>
                ))}
            </div>

            {/* Schedule Management Section - Visible for both, but context changes */}
            <div className="mb-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 text-lg">
                        {activeTab === 'hourly' ? t.scheduleManagement : t.tabSubscriptions}
                    </h3>
                    <span className={`text-xs text-white font-bold px-3 py-1 rounded-full hidden sm:inline-block shadow-sm ${activeTab === 'subscription' ? 'bg-purple-500' : 'bg-indigo-500'}`}>
                        {activeTab === 'subscription' ? t.subscription : t.manualBooking}
                    </span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    <div className="lg:col-span-5">
                    <Calendar
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        lang={lang}
                        bookedDates={bookedDatesSet}
                    />
                    </div>
                    <div className="lg:col-span-7">
                    <TimeGrid
                        selectedHour={selectedHour}
                        onHourSelect={handleHourToggle}
                        lang={lang}
                        dayBookings={dayBookings.map(b => ({ hour: b.hour, type: b.type || 'hourly' }))}
                    />
                    </div>
                </div>
            </div>

            {/* Bookings Table - Filtered by Tab */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden min-h-[300px]">
                <div className="px-6 py-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-lg">
                    {activeTab === 'hourly' ? t.hourlyBookings : t.subscriptionBookings}
                </h3>
                <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold">{tableBookings.length} total</span>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-50/50">
                    <tr>
                        <th className="px-6 py-4 font-bold">{t.customer}</th>
                        <th className="px-6 py-4 font-bold">{t.date}</th>
                        <th className="px-6 py-4 font-bold">{t.time}</th>
                        <th className="px-6 py-4 font-bold">{t.amount}</th>
                        <th className="px-6 py-4 font-bold">{t.status}</th>
                        <th className="px-6 py-4 font-bold text-right">{t.actions}</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                    {tableBookings.length > 0 ? tableBookings.sort((a,b) => b.id - a.id).map((booking) => (
                        <tr key={booking.id} className="hover:bg-slate-50 transition-colors animate-in fade-in slide-in-from-left-2">
                        <td className="px-6 py-4 font-bold text-slate-900">
                            <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
                                    booking.type === 'subscription' ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {booking.type === 'subscription' ? 'S' : booking.customer.charAt(0)}
                                </div>
                                <div>
                                    <div>{booking.customer}</div>
                                    {booking.type === 'subscription' && (
                                        <div className="text-[10px] text-purple-600 font-bold uppercase">{t.subscription}</div>
                                    )}
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium whitespace-nowrap">
                            {booking.dateStr}
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium bg-slate-50/50 rounded-lg whitespace-nowrap">{booking.time}</td>
                        <td className="px-6 py-4 font-black text-slate-900">{booking.amount} ₼</td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            booking.status === 'paid' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${booking.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            {booking.status === 'paid' ? t.statusPaid : t.statusPending}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                            {booking.status === 'pending' && (
                                <button 
                                    onClick={() => handleApprove(booking.id)}
                                    className="text-white bg-emerald-500 hover:bg-emerald-600 font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm shadow-emerald-200 transition-all active:scale-95"
                                >
                                    {t.approve}
                                </button>
                            )}
                            <button 
                                onClick={() => handleReject(booking.id)}
                                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                title={t.reject}
                            >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            </button>
                        </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                                {lang === 'az' ? 'Məlumat tapılmadı.' : (lang === 'ru' ? 'Нет данных для отображения.' : 'No data to display.')}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;