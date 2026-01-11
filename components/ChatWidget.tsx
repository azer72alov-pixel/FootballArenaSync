import React, { useState, useRef, useEffect } from 'react';
import { TRANSLATIONS } from '../translations';

interface ChatWidgetProps {
  lang: 'az' | 'ru' | 'en';
}

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type: 'text' | 'audio';
  audioUrl?: string;
  duration?: number;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1); // Start with 1 unread (Welcome msg)
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen); // Ref to track open state inside timeouts
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Media Recorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  // Sync ref with state
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
        setUnreadCount(0);
    }
  }, [isOpen]);

  // Initialize Audio
  useEffect(() => {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Gentle chime
      audioRef.current.volume = 0.5;
  }, []);

  const playSound = () => {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(e => console.log("Audio play blocked", e));
      }
  };

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 1,
          text: t.chatWelcome,
          sender: 'bot',
          timestamp: new Date(),
          type: 'text'
        }
      ]);
    }
  }, [lang, t.chatWelcome]);

  // DEMO: Simulate incoming message after 10 seconds to show notification
  useEffect(() => {
      const timer = setTimeout(() => {
          const promoMsg: Message = {
              id: 999,
              text: lang === 'az' ? '💡 Bu gün üçün hələ boş yerlərimiz var!' : (lang === 'ru' ? '💡 На сегодня еще есть свободные слоты!' : '💡 We still have free slots for today!'),
              sender: 'bot',
              timestamp: new Date(),
              type: 'text'
          };

          setMessages(prev => {
              if (prev.some(m => m.id === 999)) return prev;
              
              // Only notify if chat is closed
              if (!isOpenRef.current) {
                  setUnreadCount(prevCount => prevCount + 1);
                  playSound();
              }
              return [...prev, promoMsg];
          });
      }, 10000); // 10 seconds delay

      return () => clearTimeout(timer);
  }, [lang]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    simulateBotResponse(inputValue);
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const audioUrl = URL.createObjectURL(audioBlob);
              const duration = recordingTime; // capture current time

              // Send Audio Message
              const newAudioMsg: Message = {
                  id: Date.now(),
                  text: t.voiceMessage || 'Voice Message',
                  sender: 'user',
                  timestamp: new Date(),
                  type: 'audio',
                  audioUrl: audioUrl,
                  duration: duration
              };
              
              setMessages(prev => [...prev, newAudioMsg]);
              setIsTyping(true);
              simulateBotResponse("audio");
          };

          mediaRecorder.start();
          setIsRecording(true);
          setRecordingTime(0);

          recordingIntervalRef.current = window.setInterval(() => {
              setRecordingTime(prev => prev + 1);
          }, 1000);

      } catch (err) {
          console.error("Error accessing microphone:", err);
          alert(lang === 'az' ? 'Mikrofona icazə yoxdur' : (lang === 'ru' ? 'Нет доступа к микрофону' : 'Microphone access denied'));
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); // Turn off mic
          
          if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
          }
          setIsRecording(false);
      }
  };

  const simulateBotResponse = (input: string) => {
      // Simulate bot response
      setTimeout(() => {
        let botText = "";
        const lowerInput = input.toLowerCase();
        
        if (input === "audio") {
             botText = lang === 'az' ? '🎤 Səsli mesajınızı aldım! Qısa müddətdə dinləyib cavab verəcəyik.' : (lang === 'ru' ? '🎤 Голосовое получено! Мы прослушаем и ответим в ближайшее время.' : '🎤 Voice message received! We will listen and reply shortly.');
        } else if (lowerInput.includes('qiymət') || lowerInput.includes('цена') || lowerInput.includes('price')) {
          botText = lang === 'az' ? 'Qiymətlər saatlıq 30-50 AZN arasında dəyişir. Abunəliklər daha sərfəlidir!' : (lang === 'ru' ? 'Цены варьируются от 30 до 50 AZN в час. Абонементы выгоднее!' : 'Prices range from 30-50 AZN per hour. Subscriptions are cheaper!');
        } else if (lowerInput.includes('ünvan') || lowerInput.includes('адрес') || lowerInput.includes('address')) {
          botText = lang === 'az' ? 'Bütün meydançalarımız Sumqayıtda yerləşir. Xəritə düyməsinə klikləyərək dəqiq yeri görə bilərsiniz.' : (lang === 'ru' ? 'Все наши поля находятся в Сумгаите. Нажмите кнопку карты для точной локации.' : 'All our courts are in Sumqayit. Click the map button for exact location.');
        } else {
          botText = lang === 'az' ? 'Təşəkkürlər! Operatorumuz tezliklə sizinlə əlaqə saxlayacaq.' : (lang === 'ru' ? 'Спасибо! Наш оператор скоро свяжется с вами.' : 'Thanks! An operator will be with you shortly.');
        }

        const newBotMsg: Message = {
          id: Date.now() + 1,
          text: botText,
          sender: 'bot',
          timestamp: new Date(),
          type: 'text'
        };

        setMessages(prev => [...prev, newBotMsg]);
        setIsTyping(false);
        
        // Notify if user closed chat while waiting
        if (!isOpenRef.current) {
            setUnreadCount(prev => prev + 1);
            playSound();
        }

      }, 1500);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed bottom-6 right-4 z-[60] flex flex-col items-end pointer-events-none">
      {/* Chat Window - Enable pointer events only for window */}
      {isOpen && (
        <div className="mb-4 w-[85vw] max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-auto">
          
          {/* Header */}
          <div className="bg-slate-900 p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  A
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"></div>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">{t.chatTitle}</h3>
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span> {t.online}
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 bg-slate-50 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                    msg.sender === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-sm' 
                      : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-sm'
                  }`}
                >
                  {msg.type === 'audio' && msg.audioUrl ? (
                      <div className="flex items-center gap-2 min-w-[120px]">
                          <button 
                            className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
                            onClick={() => {
                                const audio = new Audio(msg.audioUrl);
                                audio.play();
                            }}
                          >
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                             </svg>
                          </button>
                          <div className="flex flex-col">
                              <span className="text-xs font-bold opacity-90">{t.voiceMessage}</span>
                              <span className="text-[10px] opacity-70">{formatTime(msg.duration || 0)}</span>
                          </div>
                      </div>
                  ) : (
                      msg.text
                  )}
                  <div className={`text-[10px] mt-1 text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                 <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-100 shrink-0">
             {isRecording ? (
                 <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-2 border border-red-100">
                     <div className="flex items-center gap-2">
                         <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="text-red-600 font-bold text-sm">{t.recording} {formatTime(recordingTime)}</span>
                     </div>
                     <button 
                        onClick={stopRecording}
                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-md shadow-red-200 transition-all transform active:scale-95"
                     >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                         </svg>
                     </button>
                 </div>
             ) : (
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-100 transition-all">
                <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.chatPlaceholder}
                    className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none text-slate-900 placeholder:text-slate-400"
                />
                
                {inputValue.trim() ? (
                    <button 
                        onClick={handleSend}
                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                ) : (
                    <button 
                        onClick={startRecording}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
                </div>
             )}
          </div>
        </div>
      )}

      {/* Floating Button - Enable pointer events */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-700 hover:scale-110 transition-all duration-300 group relative pointer-events-auto"
        >
           <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
           </svg>
           
           {/* Notification Badge */}
           {unreadCount > 0 && (
             <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-slate-50 flex items-center justify-center animate-in zoom-in duration-300">
               {unreadCount}
             </span>
           )}
        </button>
      )}
    </div>
  );
};

export default ChatWidget;