import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getSmartRecommendation = async (userPreferences: string, lang: 'az' | 'ru') => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User asks: ${userPreferences}. Recommend the best football court and booking type (hourly vs subscription) from ArenaSync in ${lang === 'az' ? 'Azerbaijani' : 'Russian'}. Be professional and encouraging. Keep it very short (max 2 sentences).`,
      config: {
        systemInstruction: `You are a helpful sports facility manager for ArenaSync. We specialize EXCLUSIVELY in Football in Sumqayıt. We offer three locations: Sumqayıt Paralimpiya Kompleksi (Address: 47-ci məhəllə), Sumqayıt Olimpiya İdman Kompleksi (Address: 17-ci mikrorayon), and Azfar Futbol Meydançası (Address: Sumqayıt Bulvarı). All are priced at 30₼ per hour. We have Starter (5h), Pro (15h), and Elite (40h) subscriptions. ALWAYS respond in the language requested: ${lang === 'az' ? 'Azerbaijani (Azərbaycan dili)' : 'Russian (Русский язык)'}.`,
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    return lang === 'az' 
      ? "Məkanımız Sumqayıtın ən yaxşı futbol meydançalarını təklif edir. Mükəmməl məşq üçün arenalarımızı yoxlayın!"
      : "Наш комплекс предлагает лучшие футбольные площадки в Сумгаите. Попробуйте наши арены для отличной тренировки!";
  }
};