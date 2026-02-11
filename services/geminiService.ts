
import { GoogleGenAI, Type } from "@google/genai";
import { ProductInfo, BoycottNews, Alternative } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const PRODUCT_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "اسم المنتج الدقيق" },
    brand: { type: Type.STRING, description: "اسم العلامة التجارية" },
    category: { type: Type.STRING, description: "فئة المنتج (مثلاً: منظفات، أغذية، تكنولوجيا)" },
    isBoycotted: { type: Type.BOOLEAN, description: "هل المنتج مقاطع؟" },
    reason: { type: Type.STRING, description: "سبب المقاطعة بالتفصيل" },
    imageUrl: { type: Type.STRING, description: "رابط صورة مباشرة للمنتج" },
    parentCompany: { type: Type.STRING, description: "الشركة الأم" },
    originCountry: { type: Type.STRING, description: "بلد المنشأ" },
    detailedImpact: { type: Type.STRING, description: "الأثر الاقتصادي أو السياسي للمنتج" },
    availabilityLocations: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING }, 
      description: "أماكن توافر المنتج (أسماء متاجر، سوبر ماركت، أو مناطق)" 
    },
    alternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "اسم المنتج البديل" },
          origin: { type: Type.STRING, description: "بلد منشأ البديل" },
          manufacturer: { type: Type.STRING, description: "الشركة المصنعة للبديل" },
          description: { type: Type.STRING, description: "وصف البديل" },
          imageUrl: { type: Type.STRING, description: "رابط صورة للبديل" },
          detailedBenefits: { type: Type.STRING, description: "مميزات البديل" },
          certificates: { type: Type.ARRAY, items: { type: Type.STRING } },
          priceRange: { type: Type.STRING, description: "الفئة السعرية" },
          availabilityLocations: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }, 
            description: "أين نجد هذا البديل؟ (مثال: كارفور، المتاجر المحلية، الصيدليات)" 
          },
          websiteUrl: { type: Type.STRING, description: "رابط الموقع الرسمي للمنتج البديل أو صفحته على متجر إلكتروني" },
          mapsUrl: { type: Type.STRING, description: "رابط خرائط جوجل للمنتج إذا كان مطعماً أو مكاناً مادياً (يفضل أقرب فرع للمستخدم)" }
        },
        required: ["name", "origin", "manufacturer", "description", "imageUrl", "availabilityLocations"]
      }
    }
  },
  required: ["name", "brand", "category", "isBoycotted", "reason", "imageUrl", "alternatives", "availabilityLocations"]
};

const SEARCH_RESULTS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    products: {
      type: Type.ARRAY,
      items: PRODUCT_ITEM_SCHEMA,
      description: "قائمة المنتجات المطابقة للبحث"
    }
  },
  required: ["products"]
};

const ALTERNATIVES_LIST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    alternatives: {
      type: Type.ARRAY,
      items: PRODUCT_ITEM_SCHEMA.properties.alternatives.items,
      description: "قائمة ببدائل إضافية للمنتج"
    }
  },
  required: ["alternatives"]
};

const NEWS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    hasSignificantChanges: { type: Type.BOOLEAN },
    summary: { type: Type.STRING },
    recentAdditions: { type: Type.ARRAY, items: { type: Type.STRING } },
    lastUpdatedDate: { type: Type.STRING }
  },
  required: ["hasSignificantChanges", "summary", "recentAdditions", "lastUpdatedDate"]
};

const SYSTEM_INSTRUCTION = `
أنت "خبير تسوق أخلاقي". عند البحث عن منتج، يجب أن تعيد قائمة (Array) بالمنتجات التي قد تحمل نفس الاسم أو تندرج تحت نفس البحث.
لأقصى قدر من الفائدة:
1. ابحث عن روابط صور حقيقية ومباشرة للمنتجات المقاطعة والبديلة.
2. استخدم ميزة البحث (Google Search) للعثور على المواقع الرسمية (websiteUrl) للبدائل والروابط المكانية (mapsUrl).
3. إذا تم توفير إحداثيات المستخدم، فاستخدمها للعثور على أقرب الفروع المكانية للبدائل على خرائط جوجل.
4. حدد بدقة أين يمكن للمستخدم شراء المنتج الآمن أو البديل.
5. كن دقيقاً جداً في سبب المقاطعة بناءً على حركة BDS.
الإجابة دائماً باللغة العربية.
`;

export async function identifyAndCheckProduct(
  productNameOrImage: string | { base64: string, mimeType: string },
  location?: { lat: number, lng: number }
): Promise<ProductInfo[]> {
  const isImage = typeof productNameOrImage !== 'string';
  const locationContext = location ? `موقعي الحالي هو (خط العرض: ${location.lat}, خط الطول: ${location.lng}). ابحث عن أقرب الفروع المتاحة لي للبدائل.` : "";
  
  const contents = isImage ? 
    {
      parts: [
        { inlineData: { data: productNameOrImage.base64, mimeType: productNameOrImage.mimeType } },
        { text: `تعرف على هذا المنتج. ${locationContext} هل هي مقاطعة؟ اعطني قائمة مفصلة بالمنتجات والبدائل وروابطها وأماكن تواجدها.` }
      ]
    } : 
    `ابحث عن: ${productNameOrImage}. ${locationContext} اعرض لي كل المنتجات التي تحمل هذا الاسم، موضحاً حالتها وبدائلها مع روابط المواقع والخرائط (الأقرب لي إن وجد).`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: SEARCH_RESULTS_SCHEMA,
      tools: [{ googleSearch: {} }]
    }
  });

  const parsed = JSON.parse(response.text);
  return parsed.products || [];
}

export async function fetchMoreProducts(query: string, existingCount: number, location?: { lat: number, lng: number }): Promise<ProductInfo[]> {
  const locationContext = location ? `موقعي الحالي هو (${location.lat}, ${location.lng}).` : "";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `أريد المزيد من الماركات المقاطعة لـ "${query}". ${locationContext} لقد عرضت لي بالفعل ${existingCount} منتجات، أعطني مجموعة جديدة ومختلفة مع التركيز على البدائل وروابطها القريبة مني.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: SEARCH_RESULTS_SCHEMA,
      tools: [{ googleSearch: {} }]
    }
  });
  const parsed = JSON.parse(response.text);
  return parsed.products || [];
}

export async function fetchMoreAlternatives(brandName: string, location?: { lat: number, lng: number }): Promise<Alternative[]> {
  const locationContext = location ? `موقعي الحالي هو (${location.lat}, ${location.lng}).` : "";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `ابحث عن المزيد من البدائل للماركة "${brandName}". ${locationContext} أريد بدائل بجودة عالية، روابط مواقعها، وروابط خرائط جوجل للأفرع القريبة مني.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: ALTERNATIVES_LIST_SCHEMA,
      tools: [{ googleSearch: {} }]
    }
  });
  const parsed = JSON.parse(response.text);
  return parsed.alternatives || [];
}

export async function checkLatestBoycottNews(): Promise<BoycottNews> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "أحدث أخبار المقاطعة لشهر فبراير 2025 والشركات الجديدة.",
    config: {
      systemInstruction: "مراقب حركة BDS.",
      responseMimeType: "application/json",
      responseSchema: NEWS_SCHEMA,
      tools: [{ googleSearch: {} }]
    }
  });
  return JSON.parse(response.text);
}
