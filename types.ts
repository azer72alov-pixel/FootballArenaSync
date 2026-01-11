
export type CourtType = 'Football';

export interface Court {
  id: string;
  name: string;
  type: CourtType;
  pricePerHour: number;
  subscriptionPrice: number; // Custom price for subscriptions per court
  image: string;
  gallery: string[]; 
  description: string;
  address: string;
  mapUrl: string;
  pin: string; 
  status?: 'active' | 'suspended'; 
  telegramChatId?: string; 
}

export interface Booking {
  id: string;
  courtId: string;
  date: string; // ISO string
  startTime: number; // 0-23
  duration: number; // in hours
  userName: string;
  type: 'hourly' | 'subscription' | 'section'; // Added 'section'
  amount: number;
  status: 'pending' | 'paid' | 'cancelled';
}

export interface Subscription {
  id: string;
  name: string;
  price: number; // Base price (fallback)
  hours: number;
  features: string[];
  color: string;
}

export interface Section {
  id: string;
  name: string;
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
  startHour: number;
  duration: number;
  pricePerStudent?: number;
  color?: string;
}

export interface Announcement {
  id: number;
  court_id: string;
  section_id?: string | null; // Added: Target specific section or null for all
  message: string;
  created_at: string;
  sender_name: string;
}

// PWA Install Prompt Event
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Minimal Telegram WebApp types
export interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  showPopup: (params: {
    title?: string;
    message: string;
    buttons?: Array<{
        id?: string;
        type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
        text?: string;
    }>;
  }, callback?: (buttonId: string) => void) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    showProgress: (leaveActive: boolean) => void;
    hideProgress: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
  };
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
