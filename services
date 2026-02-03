
import { GoogleGenAI, Type, Chat, Modality } from "@google/genai";
import { Medication, DiaryEntry, SafetyAnalysis, FlareForecast, DietPlan, Symptom, Injection } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

let activeChatSession: Chat | null = null;

export const startChat = (meds: Medication[], conditions: string[]) => {
  const ai = getAIClient();
  const medContext = meds.map(m => `${m.n} (${m.d})`).join(', ');
  const conditionContext = conditions.length > 0 ? `The patient has the following medical conditions: ${conditions.join(', ')}.` : "No specific conditions listed yet.";
  
  activeChatSession = ai.chats.create({
    model: 'gemini-flash-lite-latest',
    config: {
      systemInstruction: `You are Doctor B, a world-class Senior Consultant Physician and Clinical Specialist. 
      ${conditionContext}
      The patient's current regimen: ${medContext}. 
      Your persona is gentle, hyper-realistic, professional, and deeply empathetic. 
      Tailor all advice specifically to their medical conditions.`,
    },
  });
  return activeChatSession;
};

export const sendChatMessage = async (message: string) => {
  if (!activeChatSession) throw new Error("Chat not initialized");
  const response = await activeChatSession.sendMessage({ message });
  return response.text;
};

export const runClinicalAnalysis = async (meds: Medication[], diary: DiaryEntry[], symptoms: Symptom[], conditions: string[]): Promise<SafetyAnalysis> => {
  const ai = getAIClient();
  const medHistory = meds.filter(m => m.status === 'taken').map(m => m.n).join(', ');
  const recentDiary = diary.slice(0, 10).map(d => `${d.time}: ${d.text}`).join('\n');
  const symptomList = symptoms.slice(0, 10).map(s => `${s.name} (Severity: ${s.severity}/10)`).join(', ');
  const conditionText = conditions.join(', ');
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Clinical Profile: ${conditionText}. Meds taken: ${medHistory}. Symptoms reported: ${symptomList}. Diary logs: ${recentDiary}.`,
    config: {
      systemInstruction: "Identify drug-drug interactions or side effects based on patient conditions.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          interactions: { type: Type.ARRAY, items: { type: Type.STRING } },
          correlations: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING }
        },
        required: ["interactions", "correlations", "summary"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateReminderAudio = async (text: string): Promise<string | undefined> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text: `Say this in a gentle medical voice: ${text}` }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

export const analyzePrescription = async (base64Image: string): Promise<{ meds: Medication[], injections: Injection[] }> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { text: "Extract all medications. Identify if it's a pill or injection (e.g. Humira, MTX are injections). For injections, provide site and frequency." },
        { inlineData: { mimeType: "image/png", data: base64Image } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['pill', 'injection'] },
                name: { type: Type.STRING },
                dosage: { type: Type.STRING },
                time: { type: Type.STRING },
                frequency: { type: Type.STRING },
                site: { type: Type.STRING }
              },
              required: ["type", "name", "dosage", "time"]
            }
          }
        }
      }
    }
  });

  const parsed = JSON.parse(response.text || '{"items":[]}');
  const meds: Medication[] = [];
  const injections: Injection[] = [];

  parsed.items.forEach((item: any) => {
    if (item.type === 'injection') {
      injections.push({
        id: Math.floor(Math.random() * 1000000),
        name: item.name,
        dosage: item.dosage,
        site: item.site || 'Rotate Sites',
        time: item.time,
        status: 'pending',
        frequency: item.frequency || 'Weekly',
        schedule: ['Fri'] // Default for common weekly meds like MTX/Humira if not specified
      });
    } else {
      meds.push({
        id: Math.floor(Math.random() * 1000000),
        n: item.name,
        d: item.dosage,
        block: 'am',
        status: 'pending',
        time: item.time,
        schedule: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        count: 30
      });
    }
  });

  return { meds, injections };
};

export const generateDietPlan = async (meds: Medication[], conditions: string[]): Promise<DietPlan> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Patient conditions: ${conditions.join(', ')}. Create anti-inflammatory diet plan.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          preferredFoods: { type: Type.ARRAY, items: { type: Type.STRING } },
          meals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, desc: { type: Type.STRING } } } },
          hydrationGoal: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const identifyPill = async (base64Image: string): Promise<Partial<Medication>> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: {
      parts: [
        { text: "Identify this pill." },
        { inlineData: { mimeType: "image/png", data: base64Image } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: { n: { type: Type.STRING }, d: { type: Type.STRING }, block: { type: Type.STRING, enum: ['am', 'pm'] } },
        required: ["n", "d", "block"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};
