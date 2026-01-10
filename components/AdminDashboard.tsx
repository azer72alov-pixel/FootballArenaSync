import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TRANSLATIONS } from '../translations';
import { COURTS, SUBSCRIPTIONS } from '../constants';
import { Court } from '../types';
import Calendar from './Calendar';
import TimeGrid from './TimeGrid';
import { supabase } from '../lib/supabase';
import { formatDateLocal } from '../App'; // Import the new helper

interface AdminDashboardProps {
  lang: 'az' | 'ru' | 'en';
  managedCourtId: string;
  allCourts: Court[];
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang, managedCourtId, allCourts, onBack }) => {
  const t = TRANSLATIONS[lang];
  const court = allCourts.find(c => c.id === managedCourtId);

  // Tab State
  const [activeTab, setActiveTab] = useState<'hourly' | 'subscription' | 'settings'>('hourly');

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
  const [saveMessage, setSaveMessage] = useState({ text: '', type: '' });
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Store bookings from DB
  const [localBookings, setLocalBookings] = useState<any[]>([]);

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
    
    // Subscribe to realtime changes for this court
    const channel = supabase
      .channel('admin:bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
        fetchAllBookings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [managedCourtId]);

  // 1. Calculate which dates have ANY bookings (for Calendar dots)
  const bookedDatesSet = useMemo(() => {
    const dates = new Set<string>();
    localBookings.forEach(b => dates.add(b.dateStr));
    return dates;
  }, [localBookings]);

  // 2. Calculate bookings for the CURRENTLY selected date (for TimeGrid colors)
  const dayBookings = useMemo(() => {
    // FIX: Use local format to match DB strings correctly
    const dateKey = formatDateLocal(selectedDate);
    return localBookings.filter(b => b.dateStr === dateKey);
  }, [selectedDate, localBookings]);

  // 3. Filter bookings for the Bottom Table based on Active Tab
  const tableBookings = useMemo(() => {
      // If we are in Settings tab, tableBookings isn't used, but prevents error
      if (activeTab === 'settings') return [];
      return localBookings.filter(b => b.type === activeTab);
  }, [localBookings, activeTab]);

  // Focus input when modal opens
  useEffect(() => {
    if (isModalOpen && inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isModalOpen]);

  const handleApprove = async (id: number) => {
    const { error } = await supabase
        .from('bookings')
        .update({ status: 'paid' })
        .eq('id', id);
    // State updates via realtime subscription or manual refetch automatically, but optimistic update is nice
    if (!error) {
        setLocalBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'paid' } : b));
    }
  };

  const handleReject = async (id: number) => {
    const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

    if (!error) {
        setLocalBookings(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleHourToggle = (hour: number) => {
      // Check if hour is already taken in the current day view
      const isTaken = dayBookings.some(b => b.hour === hour);

      if (!isTaken) {
          setSelectedHour(hour); 
          setCustomerNameInput('');
          // Automatically set the booking type based on the active tab
          setBookingType(activeTab === 'subscription' ? 'subscription' : 'hourly'); 
          if (SUBSCRIPTIONS.length > 0) setSelectedPlanId(SUBSCRIPTIONS[0].id);
          setIsModalOpen(true);
      }
  };

  const handleModalConfirm = async () => {
    if (selectedHour !== null && customerNameInput.trim()) {
        const basePrice = court?.pricePerHour || 30;
        const newRows = [];

        if (bookingType === 'hourly') {
            // SINGLE BOOKING
            // FIX: Use local format
            const dateStr = formatDateLocal(selectedDate);
            newRows.push({
                court_id: managedCourtId,
                date: dateStr,
                hour: selectedHour,
                customer_name: customerNameInput,
                status: 'paid', // Admin bookings are auto-paid
                type: 'hourly',
                amount: basePrice
            });
        } else {
            // SUBSCRIPTION BOOKING
            const plan = SUBSCRIPTIONS.find(s => s.id === selectedPlanId);
            const iterations = plan ? plan.hours : 4; 
            const planPrice = plan ? plan.price : (basePrice * 4); 

            for (let i = 0; i < iterations; i++) {
                const nextDate = new Date(selectedDate);
                nextDate.setDate(selectedDate.getDate() + (i * 7)); // +7 days for each week
                // FIX: Use local format for future dates too
                const dateStr = formatDateLocal(nextDate);
                
                newRows.push({
                    court_id: managedCourtId,
                    date: dateStr,
                    hour: selectedHour,
                    customer_name: `${customerNameInput} (${t.subscription} ${i+1}/${iterations})`,
                    status: 'paid',
                    type: 'subscription',
                    amount: i === 0 ? planPrice : 0
                });
            }
        }

        const { data, error } = await supabase.from('bookings').insert(newRows).select();

        if (error) {
            console.error(error);
            alert("Error saving booking");
            return;
        }

        // Realtime will handle update, but we can do optimistic update if needed
        closeModal();
    }
  };

  const closeModal = () => {
      setIsModalOpen(false);
      setSelectedHour(null); 
  };
  
  const handlePinChange = () => {
      if(!court) return;
      
      const storedPin = localStorage.getItem(`court_pin_${court.id}`);
      const actualCurrentPin = storedPin || court.pin;

      if (oldPin !== actualCurrentPin) {
          setSaveMessage({ text: t.pinError, type: 'error' });
          return;
      }

      if (newPin.length !== 4) {
          setSaveMessage({ text: "PIN must be 4 digits", type: 'error' });
          return;
      }

      localStorage.setItem(`court_pin_${court.id}`, newPin);
      setSaveMessage({ text: t.pinUpdated, type: 'success' });
      setOldPin('');
      setNewPin('');
      setTimeout(() => setSaveMessage({ text: '', type: '' }), 3000);
  };

  // Calculate dynamic stats
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
                                        {sub.name} ({sub.hours} {t.gamesCount}) - {sub.price}₼
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
                            : `${SUBSCRIPTIONS.find(s => s.id === selectedPlanId)?.price || 0} ₼`
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
        <div className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
            Admin Mode
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
            <p className="text-slate-400 text-sm mt-1">{court.address}</p>
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
                    <h3 className="text-xl font-bold text-slate-900">{t.securitySettings}</h3>
                    <p className="text-slate-500 text-sm">{t.changePin}</p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {t.currentPin}
                          </label>
                          <input 
                              type="password"
                              value={oldPin}
                              onChange={(e) => setOldPin(e.target.value)}
                              maxLength={4}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-400"
                              placeholder="••••"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {t.newPin}
                          </label>
                          <input 
                              type="password"
                              value={newPin}
                              onChange={(e) => setNewPin(e.target.value)}
                              maxLength={4}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-400"
                              placeholder="••••"
                          />
                      </div>

                      {saveMessage.text && (
                          <div className={`p-3 rounded-xl text-sm font-bold text-center ${saveMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {saveMessage.text}
                          </div>
                      )}

                      <button 
                          onClick={handlePinChange}
                          disabled={oldPin.length < 4 || newPin.length < 4}
                          className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 mt-4 disabled:opacity-50"
                      >
                          {t.saveChanges}
                      </button>
                  </div>
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
                        bookedDates={bookedDatesSet} // Pass the Set of booked dates strings
                    />
                    </div>
                    <div className="lg:col-span-7">
                    <TimeGrid
                        selectedHour={selectedHour}
                        onHourSelect={handleHourToggle}
                        lang={lang}
                        // Pass detailed bookings for this day
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