import React, { useState, useRef, useEffect } from 'react';
import { TRANSLATIONS } from '../translations';
import { supabase } from '../supabase';
import { Court, Announcement, Section } from '../types';

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'az' | 'ru' | 'en';
  courts: Court[]; 
}

// Helper to get all sections from local storage across all courts
const getAllSections = (courts: Court[]): Section[] => {
    let all: Section[] = [];
    courts.forEach(c => {
        const stored = localStorage.getItem(`court_sections_${c.id}`);
        if (stored) {
            const sections = JSON.parse(stored);
            all = [...all, ...sections];
        }
    });
    return all;
};

const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose, lang, courts }) => {
  const t = TRANSLATIONS[lang];
  const [messages, setMessages] = useState<Announcement[]>([]);
  const [mySectionId, setMySectionId] = useState<string | null>(localStorage.getItem('user_section_id'));
  const [availableSections, setAvailableSections] = useState<Section[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      setAvailableSections(getAllSections(courts));
  }, [courts, isOpen]);

  const fetchAnnouncements = async () => {
      // Fetch public (null) OR specific section messages
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: true });
      if (data) {
          // Client side filtering for Mock DB limitations or simplicity
          const filtered = data.filter((msg: Announcement) => 
              !msg.section_id || (mySectionId && msg.section_id === mySectionId)
          );
          setMessages(filtered);
      }
  };

  useEffect(() => {
    if (isOpen) {
        fetchAnnouncements();
    }
  }, [isOpen, mySectionId]);

  // Subscribe to updates
  useEffect(() => {
    if (!isOpen) return;
    const channel = supabase
      .channel('public:announcements')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
         const newMsg = payload.new as Announcement;
         // Only add if relevant to me
         if (!newMsg.section_id || (mySectionId && newMsg.section_id === mySectionId)) {
             setMessages(prev => [...prev, newMsg]);
             if (window.Telegram?.WebApp) {
                 window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
             }
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, mySectionId]);

  const handleSectionSelect = (id: string) => {
      setMySectionId(id);
      localStorage.setItem('user_section_id', id);
  };

  const handleResetSection = () => {
      setMySectionId(null);
      localStorage.removeItem('user_section_id');
      setMessages([]);
  }

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const formatTime = (isoString: string) => {
      try {
          const d = new Date(isoString);
          return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      } catch (e) { return ''; }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 pointer-events-auto">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-slate-100 w-full sm:max-w-md h-[80vh] sm:h-[600px] sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl flex flex-col overflow-hidden relative z-10 animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="bg-white p-4 flex items-center justify-between shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-lg">{t.chatTitle}</h3>
                {mySectionId && (
                    <button onClick={handleResetSection} className="text-xs text-indigo-600 font-bold underline">
                        {availableSections.find(s => s.id === mySectionId)?.name || t.changeTeam}
                    </button>
                )}
              </div>
          </div>
          <button onClick={onClose} className="bg-slate-100 p-2 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {!mySectionId ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t.selectYourTeam}</h3>
                <p className="text-slate-500 mb-8">{t.selectTeamDesc}</p>
                
                <div className="w-full space-y-3 overflow-y-auto max-h-[300px] px-2">
                    {availableSections.length > 0 ? availableSections.map(s => (
                        <button 
                            key={s.id} 
                            onClick={() => handleSectionSelect(s.id)}
                            className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all font-bold text-slate-700 flex justify-between items-center"
                        >
                            <span>{s.name}</span>
                            <span className="text-slate-300">›</span>
                        </button>
                    )) : (
                        <div className="text-slate-400 text-sm">No sections active.</div>
                    )}
                </div>
            </div>
        ) : (
            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-4">
                 {messages.length > 0 ? messages.map((msg, idx) => (
                     <div key={msg.id || idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-50">
                            <span className="text-xs font-black text-indigo-600 uppercase tracking-wide">
                                {msg.sender_name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                {formatTime(msg.created_at)}
                            </span>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.message}
                        </p>
                     </div>
                 )) : (
                     <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                         <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                             </svg>
                         </div>
                         <p>{t.noAnnouncements}</p>
                     </div>
                 )}
                 <div ref={messagesEndRef} />
            </div>
        )}
      </div>
    </div>
  );
};

export default NewsModal;