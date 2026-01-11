import { Court, Subscription } from './types';

// =================================================================
// 🔐 SECURITY CONFIGURATION
// =================================================================
export const SUPER_ADMIN_PIN = '999999'; // <-- ВАШ КОД СУПЕР-АДМИНА (Меняйте здесь)

// =================================================================
// 🤖 BOT CONFIGURATION
// Ссылка на ваше Mini App. Замените на реальную ссылку вашего бота!
// Например: https://t.me/MyArenaBot/app
// =================================================================
export const PLATFORM_BOT_LINK = 'https://t.me/ArenaSyncBot/app';

// =================================================================
// 🔔 TELEGRAM CONFIGURATION
// 1. BOT_TOKEN: Используйте токен того самого бота, в котором работает ваше приложение.
//    (Не нужно создавать нового, возьмите токен из @BotFather для текущего бота).
// 2. telegramChatId (ниже): ID конкретного админа для каждой площадки.
//    ВАЖНО: Каждый админ должен нажать /start в вашем боте, чтобы получать сообщения!
// =================================================================
export const NOTIFICATION_CONFIG = {
    // Вставьте сюда токен вашего существующего бота
    BOT_TOKEN: '' 
};

export const COURTS: Court[] = [
  {
    id: 's1',
    name: 'Sumqayıt Paralimpiya Kompleksi',
    type: 'Football',
    pricePerHour: 30,
    subscriptionPrice: 100, // Default Sub Price
    image: 'https://lh3.googleusercontent.com/gps-cs-s/AG0ilSxomvgXE1NoYDab2YJRCf6x4IVVUCcZsXWqqqQOdFGgS9r_JbPMy37k5obf9pmPPWqELvdpDasU7LyDChDJ7ciwzBda22IM0tSx0J_TFfmkHu8IK2YR_bBovoaD3aicl3wC31Xd=s715-w715-h572-n-k-no', 
    gallery: [
      'https://lh3.googleusercontent.com/gps-cs-s/AG0ilSxomvgXE1NoYDab2YJRCf6x4IVVUCcZsXWqqqQOdFGgS9r_JbPMy37k5obf9pmPPWqELvdpDasU7LyDChDJ7ciwzBda22IM0tSx0J_TFfmkHu8IK2YR_bBovoaD3aicl3wC31Xd=s715-w715-h572-n-k-no',
      'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1624880357913-a8539238245b?auto=format&fit=crop&q=80&w=1200'
    ],
    address: '47-ci məhəllə, Sumqayıt',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=40.561896,49.696804',
    description: '47-ci məhəllədə yaşayış binalarının əhatəsində yerləşən professional süni örtüklü futbol meydançası.',
    pin: '100001',
    status: 'active',
    // 👇 ID Админа Paralimpiya (узнать через @userinfobot)
    telegramChatId: '' 
  },
  {
    id: 's2',
    name: 'Sumqayıt Olimpiya İdman Kompleksi',
    type: 'Football',
    pricePerHour: 30,
    subscriptionPrice: 100, // Default Sub Price
    image: 'https://azertag.az/files/galleryphoto/2022/1/1200x630/16500978061016219673_1200x630.jpg', 
    gallery: [
      'https://azertag.az/files/galleryphoto/2022/1/1200x630/16500978061016219673_1200x630.jpg',
      'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&q=80&w=1200'
    ],
    address: '17-ci mikrorayon, Sumqayıt',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Sumqayıt+Olimpiya+İdman+Kompleksi',
    description: 'Şəkildə gördüyünüz müasir arxitekturaya malik əsas bina və geniş idman arenaları.',
    pin: '100002',
    status: 'active',
    // 👇 ID Админа Olimpiya
    telegramChatId: '' 
  },
  {
    id: 's3',
    name: 'Azfar Futbol Meydançası (Bulvar)',
    type: 'Football',
    pricePerHour: 30,
    subscriptionPrice: 100, // Default Sub Price
    image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSWM8XQIHLG_aGaIUnOnh8PB-uP63yKtAtDje3VidaI4w&s=10',
    gallery: [
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSWM8XQIHLG_aGaIUnOnh8PB-uP63yKtAtDje3VidaI4w&s=10',
      'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1510051640316-5456af07f865?auto=format&fit=crop&q=80&w=1200'
    ],
    address: 'Sumqayıt Bulvarı',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=40.5961192,49.6826310',
    description: 'Xəzər dənizinin sahilində, təmiz hava və dəniz mənzərəsi ilə əhatə olunmuş unikal futbol meydançası.',
    pin: '100003',
    status: 'active',
    // 👇 ID Админа Azfar
    telegramChatId: '' 
  }
];

export const SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'weekly_fixed',
    name: 'Sabit Paket',
    price: 100,
    hours: 4,
    features: [
        'Həftədə 1 oyun (Sizin vaxtınız)', 
        'Seçilmiş gün və saat (məs: Cümə 20:00)', 
        'Ayda 4 zəmanətli oyun', 
        'Komanda inventarı (Top, jilet)',
        'Ləğv olunmayan daimi bron'
    ],
    color: 'bg-gradient-to-br from-indigo-900 to-slate-800'
  }
];

// Full day schedule: 09:00 to 23:00 (15 hours)
export const BUSINESS_HOURS = Array.from({ length: 15 }, (_, i) => i + 9);