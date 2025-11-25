import { GoogleGenAI, Type } from "@google/genai";
import { Ingredient, Recipe } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to remove the data URL prefix for Gemini
const cleanBase64 = (base64: string) => {
  return base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
};

/**
 * Analyzes the fridge image to find ingredients.
 */
export const analyzeFridgeImage = async (base64Image: string): Promise<string[]> => {
  try {
    const cleanData = cleanBase64(base64Image);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanData,
            },
          },
          {
            text: "Bu resimdeki yiyecek ve içecek malzemelerini tespit et. Sadece malzeme isimlerini içeren basit bir liste döndür. Mutfak gereçlerini veya yiyecek olmayan nesneleri yoksay. Çıktı Türkçe olmalı.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ingredients: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Tespit edilen yiyecek malzemelerinin listesi",
            },
          },
          required: ["ingredients"],
        },
      },
    });

    const json = JSON.parse(response.text || "{\"ingredients\": []}");
    return json.ingredients || [];
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Görüntü analiz edilemedi. Lütfen tekrar deneyin.");
  }
};

/**
 * Generates recipes based on ingredients, preferences, and expiring items.
 */
export const generateRecipesFromIngredients = async (
  ingredients: Ingredient[],
  dietaryPreference: string,
  allergies: string
): Promise<Recipe[]> => {
  try {
    // Identify expiring items (within 3 days)
    const today = new Date();
    const expiringSoon = ingredients.filter(i => {
      if (!i.expiryDate) return false;
      const date = new Date(i.expiryDate);
      const diffTime = date.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 3 && diffDays >= -1; // -1 to handle just expired
    }).map(i => i.name);

    const ingredientList = ingredients.map(i => i.name).join(", ");
    
    const prompt = `
      Elimdeki malzemeler: ${ingredientList}.
      ${expiringSoon.length > 0 ? `ÖNCELİKLİ TÜKETİLMESİ GEREKENLER (SKT Yakın): ${expiringSoon.join(", ")}.` : ''}
      
      Kullanıcı Tercihleri:
      - Beslenme Şekli: ${dietaryPreference}
      - Alerjiler/Yasaklılar: ${allergies || 'Yok'}

      Bu malzemeleri kullanarak atıksız mutfak prensibine uygun 3 farklı yemek tarifi oluştur.
      
      Kurallar:
      1. Tarifleri çeşitlendir (örn: kahvaltı, ana yemek, atıştırmalık).
      2. Mümkün olduğunca elimdeki malzemeleri kullan.
      3. Acil tüketilmesi gereken malzemeleri (varsa) tariflerde önceliklendir ve açıklamada belirt.
      4. Eğer kritik bir eksik malzeme varsa (örn: baharat, yağ hariç ana malzeme), bunu 'missingIngredients' alanına ekle.
      5. Belirtilen beslenme şekline ve alerjilere KESİNLİKLE uy. Eğer eldeki malzemelerle bu kısıtlamalara uygun tarif çıkmıyorsa, eksik malzemelerle tamamlayarak uygun tarif öner.
      6. Zorluk seviyesi (Kolay, Orta, Zor) ve Hazırlama süresi ekle.
      7. Dil Türkçe olmalı.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              usedIngredients: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              missingIngredients: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              instructions: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING } 
              },
              prepTime: { type: Type.STRING },
              difficulty: { 
                type: Type.STRING, 
                enum: ["Kolay", "Orta", "Zor"] 
              },
              calories: { type: Type.NUMBER }
            },
            required: ["id", "title", "description", "usedIngredients", "instructions", "prepTime", "difficulty"]
          }
        }
      }
    });

    const recipes = JSON.parse(response.text || "[]");
    // Sanitize response to ensure arrays exist
    return recipes.map((r: any, idx: number) => ({ 
      ...r, 
      id: r.id || `recipe-${idx}`,
      usedIngredients: r.usedIngredients || [],
      missingIngredients: r.missingIngredients || [],
      instructions: r.instructions || []
    }));

  } catch (error) {
    console.error("Gemini Recipe Error:", error);
    throw new Error("Tarifler oluşturulamadı. Lütfen tekrar deneyin.");
  }
};