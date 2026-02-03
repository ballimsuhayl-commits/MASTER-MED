
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  HeartPulse, Siren, Sun, MessageCircle, FolderOpen, Settings,
  AlertCircle, Check, Syringe, FileText, Mic, Send,
  Camera, Loader2, AlertTriangle, Phone, Stethoscope, Moon, History,
  Activity, Thermometer, Trash2, Clock, Volume2, VolumeX, Bell, Plus,
  MicOff, Waves, X, Smile, Meh, Frown, Sparkle, 
  Stethoscope as DoctorIcon, Utensils, Share2, UserPlus, PhoneForwarded, Lock, ShieldCheck,
  ChevronRight, MapPin
} from 'lucide-react';
import { Medication, Injection, VaultItem, DiaryEntry, Stats, EmergencyContact, Pharmacy, SafetyAnalysis, FlareForecast, DietPlan, Symptom } from './types';
import { VIVID_THEME, LIFESTYLE_TAGS, QUADRANTS, DAYS_OF_WEEK } from './constants';
import * as gemini from './services/geminiService';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

// --- Audio Helpers ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
}

// --- Components ---
const DashboardCard: React.FC<{ 
  children: React.ReactNode; 
  colorClass: string; 
  title: string; 
  icon: any; 
  badge?: string;
  noPadding?: boolean;
}> = ({ children, colorClass, title, icon: Icon, badge, noPadding }) => (
  <div className={`rounded-[2.5rem] border-2 border-black/10 shadow-[8px_8px_0px_rgba(0,0,0,0.05)] ${colorClass} mb-8 overflow-hidden`}>
    <div className="p-6 pb-4 flex justify-between items-center">
      <div className="flex items-center gap-4 w-full">
        <div className="w-12 h-12 rounded-[1rem] bg-white shadow-sm flex items-center justify-center shrink-0">
          <Icon size={24} className="text-black" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-black text-lg md:text-xl uppercase tracking-tight leading-tight truncate">{title}</h3>
          {badge && <span className="text-[9px] font-black px-2 py-0.5 bg-[#212121] text-white rounded-full mt-1 inline-block uppercase">{badge}</span>}
        </div>
      </div>
    </div>
    <div className={noPadding ? "" : "p-6 pt-0"}>{children}</div>
  </div>
);

const MedItem: React.FC<{ med: Medication; onAction: (id: number, action: 'take' | 'skip') => void }> = ({ med, onAction }) => (
  <div className={`flex items-center justify-between p-4 mb-2 rounded-[1.5rem] bg-white border-2 border-black/5 shadow-sm transition-all ${med.status !== 'pending' ? 'opacity-50' : 'hover:border-teal-200'}`}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h4 className="font-black text-sm truncate">{med.n}</h4>
        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{med.d}</span>
      </div>
      <div className="flex items-center gap-1 text-[9px] uppercase font-bold text-gray-400 mt-1">
        <Clock size={10}/> {med.time} • {med.count} left
      </div>
    </div>
    <div className="flex gap-2">
      {med.status === 'pending' ? (
        <>
          <button onClick={() => onAction(med.id, 'take')} className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90"><Check size={20}/></button>
          <button onClick={() => onAction(med.id, 'skip')} className="w-10 h-10 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center active:scale-90"><Trash2 size={16}/></button>
        </>
      ) : (
        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${med.status === 'taken' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
          {med.status}
        </div>
      )}
    </div>
  </div>
);

const InjectionItem: React.FC<{ inj: Injection; onAction: (id: number, action: 'take' | 'skip') => void }> = ({ inj, onAction }) => (
  <div className={`flex items-center justify-between p-4 mb-2 rounded-[1.5rem] bg-white border-2 border-black/5 shadow-sm transition-all ${inj.status !== 'pending' ? 'opacity-50' : 'hover:border-purple-200'}`}>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h4 className="font-black text-sm truncate">{inj.name}</h4>
        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">{inj.dosage}</span>
      </div>
      <div className="flex items-center gap-2 text-[9px] uppercase font-bold text-gray-400 mt-1">
        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded flex items-center gap-1"><MapPin size={8}/> {inj.site}</span>
        <span>{inj.time} • {inj.frequency} ({inj.schedule.join(', ')})</span>
      </div>
    </div>
    <div className="flex gap-2">
      {inj.status === 'pending' ? (
        <>
          <button onClick={() => onAction(inj.id, 'take')} className="w-10 h-10 bg-purple-500 text-white rounded-xl flex items-center justify-center shadow-md active:scale-90"><Check size={20}/></button>
          <button onClick={() => onAction(inj.id, 'skip')} className="w-10 h-10 bg-gray-100 text-gray-400 rounded-xl flex items-center justify-center active:scale-90"><Trash2 size={16}/></button>
        </>
      ) : (
        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${inj.status === 'taken' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
          {inj.status}
        </div>
      )}
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  // Revision and Production Locking
  const REVISION = "1.1.0-GOLD";
  const PRODUCTION_DATE = "2024-05-24";
  const STORAGE_KEY = `master_meds_pro_production_rev_${REVISION}`;

  // App State
  const [meds, setMeds] = useState<Medication[]>([
    { id: 1, n: "Cozaar", d: "100mg", block: 'am', status: 'pending', time: '08:00', schedule: DAYS_OF_WEEK, count: 12 },
    { id: 2, n: "Vitamin D", d: "1000IU", block: 'am', status: 'pending', time: '09:00', schedule: DAYS_OF_WEEK, count: 15 }, 
    { id: 3, n: "Lyrica", d: "100mg", block: 'pm', status: 'pending', time: '20:00', schedule: DAYS_OF_WEEK, count: 5 },
    { id: 4, n: "Magnesium", d: "500mg", block: 'pm', status: 'pending', time: '21:00', schedule: DAYS_OF_WEEK, count: 15 }
  ]);
  const [injections, setInjections] = useState<Injection[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [vault, setVault] = useState<VaultItem[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [stats, setStats] = useState<Stats>({ streak: 12, level: 3, xp: 2450, wellness: 88 });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [pharmacy, setPharmacy] = useState<Pharmacy>({ name: '', phone: '', email: '' });
  const [alarmsEnabled, setAlarmsEnabled] = useState(true);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  
  // UI / Interaction State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [liveTranscription, setLiveTranscription] = useState("");
  const [activeAlarmItem, setActiveAlarmItem] = useState<{ type: 'med' | 'inj'; data: any } | null>(null);
  const [remindedItems, setRemindedItems] = useState<Set<string>>(new Set());
  const [morningTab, setMorningTab] = useState<'pending' | 'taken'>('pending');
  const [eveningTab, setEveningTab] = useState<'pending' | 'taken'>('pending');
  const [injectionTab, setInjectionTab] = useState<'pending' | 'taken'>('pending');
  const [diaryInput, setDiaryInput] = useState("");
  const [dayQuality, setDayQuality] = useState<'good' | 'neutral' | 'bad'>('neutral');
  const [safetyAnalysis, setSafetyAnalysis] = useState<SafetyAnalysis | null>(null);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [newConditionInput, setNewConditionInput] = useState("");
  const [newContact, setNewContact] = useState({ name: '', phone: '' });
  const [symptomLog, setSymptomLog] = useState({ name: '', severity: 5 });
  const [newInjection, setNewInjection] = useState({ name: 'Humira', dosage: '40mg', site: 'Left Abdomen', time: '09:00', frequency: 'Weekly', schedule: ['Fri'] });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scriptInputRef = useRef<HTMLInputElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef(0);

  // Persistence Load
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d.meds) setMeds(d.meds);
        if (d.injections) setInjections(d.injections);
        if (d.conditions) setConditions(d.conditions);
        if (d.stats) setStats(d.stats);
        if (d.vault) setVault(d.vault);
        if (d.diary) setDiary(d.diary);
        if (d.symptoms) setSymptoms(d.symptoms);
        if (d.dietPlan) setDietPlan(d.dietPlan);
        if (d.emergencyContacts) setEmergencyContacts(d.emergencyContacts);
        if (d.pharmacy) setPharmacy(d.pharmacy);
        if (d.alarmsEnabled !== undefined) setAlarmsEnabled(d.alarmsEnabled);
      } catch (e) { console.error("Load Error", e); }
    }
    const ticker = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    gemini.startChat(meds, conditions);
  }, [meds, conditions]);

  // Persistence Save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      meds, injections, conditions, stats, vault, diary, symptoms, dietPlan, emergencyContacts, pharmacy, alarmsEnabled
    }));
  }, [meds, injections, conditions, stats, vault, diary, symptoms, dietPlan, emergencyContacts, pharmacy, alarmsEnabled]);

  // Derived Filters
  const filteredMeds = (block: 'am' | 'pm', status: 'pending' | 'taken') => 
    meds.filter(m => m.block === block && (status === 'taken' ? m.status !== 'pending' : m.status === 'pending'));

  const filteredInjections = (status: 'pending' | 'taken') => 
    injections.filter(i => (status === 'taken' ? i.status !== 'pending' : i.status === 'pending'));

  // --- Real-time Voice Logic (Doctor B) ---
  const startLiveSession = async () => {
    if (isLiveActive) return;
    setIsLiveActive(true);
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setLoading(false);
            const source = inputAudioCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioCtx.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.outputTranscription) setLiveTranscription(p => p + m.serverContent!.outputTranscription!.text);
            const b64 = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (b64) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
              const buf = await decodeAudioData(decode(b64), outputAudioCtx, 24000, 1);
              const s = outputAudioCtx.createBufferSource();
              s.buffer = buf; s.connect(outputAudioCtx.destination);
              s.addEventListener('ended', () => audioSourcesRef.current.delete(s));
              s.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              audioSourcesRef.current.add(s);
            }
            if (m.serverContent?.interrupted) {
              for (const s of audioSourcesRef.current.values()) { try { s.stop(); } catch(e) {} audioSourcesRef.current.delete(s); }
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => setIsLiveActive(false),
          onerror: () => setIsLiveActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
          systemInstruction: `You are Doctor B, a gentle clinical specialist. Speak naturally and concisely. Conditions: ${conditions.join(', ')}.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {}
        }
      });
      liveSessionRef.current = { sessionPromise, stream, inputAudioCtx, outputAudioCtx };
    } catch (e) { setIsLiveActive(false); setLoading(false); }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.stream.getTracks().forEach((t:any) => t.stop());
      liveSessionRef.current.inputAudioCtx.close();
      liveSessionRef.current.outputAudioCtx.close();
      liveSessionRef.current.sessionPromise.then((s:any) => s.close());
    }
    setIsLiveActive(false);
  };

  // --- Core Actions ---
  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput; setChatInput("");
    setChatHistory(p => [...p, { role: 'user', text: msg }]);
    setLoading(true);
    try {
      const res = await gemini.sendChatMessage(msg);
      setChatHistory(p => [...p, { role: 'model', text: res || "Doctor B is temporarily unavailable." }]);
    } catch(e) { setChatHistory(p => [...p, { role: 'model', text: "Consultation error." }]); }
    finally { setLoading(false); }
  };

  const updateXP = useCallback((amt: number) => {
    setStats(p => ({ ...p, xp: p.xp + amt, level: Math.floor((p.xp + amt) / 1000) + 1, wellness: Math.min(100, p.wellness + 2) }));
  }, []);

  const handleMedAction = (id: number, action: 'take' | 'skip') => {
    setMeds(p => p.map(m => m.id === id ? { ...m, status: action === 'take' ? 'taken' : 'skipped', count: action === 'take' ? m.count - 1 : m.count } : m));
    if (action === 'take') updateXP(50);
    if (activeAlarmItem?.data?.id === id) setActiveAlarmItem(null);
  };

  const handleInjectionAction = (id: number, action: 'take' | 'skip') => {
    setInjections(p => p.map(i => i.id === id ? { ...i, status: action === 'take' ? 'taken' : 'skipped' } : i));
    if (action === 'take') updateXP(100);
    if (activeAlarmItem?.data?.id === id) setActiveAlarmItem(null);
  };

  const saveSymptomLog = () => {
    if (!symptomLog.name) return;
    const s: Symptom = { id: Date.now(), ...symptomLog, time: new Date().toLocaleTimeString(), date: new Date().toLocaleDateString() };
    setSymptoms(p => [s, ...p]);
    setSymptomLog({ name: '', severity: 5 });
    updateXP(40);
  };

  const contactPharmacy = () => {
    if (!pharmacy.phone) return;
    const cleanPhone = pharmacy.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=Hello, this is a refill request from Master Meds Pro.`, '_blank');
  };

  const triggerVoiceAlert = async (text: string) => {
    const audioB64 = await gemini.generateReminderAudio(text);
    if (audioB64) {
      const ctx = new AudioContext();
      const buf = await decodeAudioData(decode(audioB64), ctx, 24000, 1);
      const s = ctx.createBufferSource();
      s.buffer = buf; s.connect(ctx.destination); s.start();
    }
  };

  useEffect(() => {
    if (!alarmsEnabled) return;
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const currentDay = DAYS_OF_WEEK[now.getDay()];
    
    // Med Reminders
    meds.filter(m => m.status === 'pending').forEach(m => {
      const key = `med-${m.id}-${time}`;
      if (m.time === time && m.schedule.includes(currentDay) && !remindedItems.has(key)) {
        setRemindedItems(p => new Set(p).add(key));
        setActiveAlarmItem({ type: 'med', data: m });
        triggerVoiceAlert(`Clinical Reminder: Take your ${m.n}.`);
      }
    });

    // Injection Reminders
    injections.filter(i => i.status === 'pending').forEach(i => {
      const key = `inj-${i.id}-${time}`;
      if (i.time === time && i.schedule.includes(currentDay) && !remindedItems.has(key)) {
        setRemindedItems(p => new Set(p).add(key));
        setActiveAlarmItem({ type: 'inj', data: i });
        triggerVoiceAlert(`Clinical Reminder: It's time for your ${i.name} injection.`);
      }
    });

  }, [now, meds, injections, alarmsEnabled]);

  return (
    <div className={`max-w-md mx-auto min-h-screen transition-all duration-300 pb-32 ${activeAlarmItem ? 'animate-clinical-flash' : 'bg-[#F8FAFC]'}`}>
      <header className="pt-8 pb-6 px-6 bg-white border-b-8 border-teal-50 sticky top-0 z-[100] flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center border-4 border-teal-100 relative shadow-inner overflow-hidden">
            <HeartPulse size={36} className="text-teal-600" />
            <div className="absolute top-0 right-0 bg-black text-white px-1 py-0.5 rounded-bl-lg text-[6px] font-black uppercase flex items-center gap-0.5 shadow-sm">
              <Lock size={5} className="fill-white"/> {REVISION}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#1E293B] uppercase tracking-tighter leading-none">Master<br/><span className="text-teal-600">Meds Pro</span></h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[8px] font-black text-white bg-teal-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Revision {REVISION}</span>
              <span className="text-[8px] font-bold text-teal-300 uppercase tracking-tighter">Production Build</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setAlarmsEnabled(!alarmsEnabled)} className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-all ${alarmsEnabled ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
              {alarmsEnabled ? <Volume2 size={24}/> : <VolumeX size={24}/>}
           </button>
           <button onClick={() => setShowSOSModal(true)} className="w-14 h-14 bg-red-600 rounded-2xl shadow-lg flex items-center justify-center animate-flash-red text-white">
            <Siren size={28} />
          </button>
        </div>
      </header>

      <main className="p-6">
        {loading && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-[999] flex flex-col items-center justify-center">
            <Loader2 size={64} className="text-teal-600 animate-spin" />
            <p className="font-black text-xl uppercase tracking-widest text-teal-600 animate-pulse mt-4">Consulting Doctor B...</p>
          </div>
        )}

        {activeTab === 'home' && (
          <>
            <div className="mb-6 p-6 bg-teal-600 rounded-[2.5rem] text-white flex items-center justify-between shadow-xl border-b-4 border-teal-800">
               <div className="flex items-center gap-4">
                  <Activity size={32} className="animate-pulse" />
                  <div><p className="text-[10px] font-black uppercase opacity-60">Regimen Adherence</p><p className="text-2xl font-black">{stats.streak} Days</p></div>
               </div>
               <button onClick={async () => { setLoading(true); const res = await gemini.runClinicalAnalysis(meds, diary, symptoms, conditions); setSafetyAnalysis(res); setShowSafetyModal(true); setLoading(false); }} className="bg-white/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-white/30 active:scale-95 transition-all">Audit Regimen</button>
            </div>

            <DashboardCard colorClass={VIVID_THEME.yellow} title="Morning Regimen" icon={Sun} noPadding>
              <div className="flex bg-white/30">
                <button onClick={() => setMorningTab('pending')} className={`flex-1 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${morningTab === 'pending' ? 'border-amber-600 text-amber-900' : 'border-transparent text-amber-900/40'}`}>Remaining</button>
                <button onClick={() => setMorningTab('taken')} className={`flex-1 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${morningTab === 'taken' ? 'border-amber-600 text-amber-900' : 'border-transparent text-amber-900/40'}`}>Logged</button>
              </div>
              <div className="p-6">{filteredMeds('am', morningTab).map(m => <MedItem key={m.id} med={m} onAction={handleMedAction} />)}</div>
            </DashboardCard>

            <DashboardCard colorClass={VIVID_THEME.purple} title="Injection Hub" icon={Syringe} noPadding>
              <div className="flex bg-white/30">
                <button onClick={() => setInjectionTab('pending')} className={`flex-1 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${injectionTab === 'pending' ? 'border-purple-600 text-purple-900' : 'border-transparent text-purple-900/40'}`}>Upcoming</button>
                <button onClick={() => setInjectionTab('taken')} className={`flex-1 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${injectionTab === 'taken' ? 'border-purple-600 text-purple-900' : 'border-transparent text-purple-900/40'}`}>History</button>
              </div>
              <div className="p-6">
                {filteredInjections(injectionTab).length > 0 ? (
                  filteredInjections(injectionTab).map(i => <InjectionItem key={i.id} inj={i} onAction={handleInjectionAction} />)
                ) : (
                  <div className="text-center py-4 text-[10px] font-bold text-gray-400 uppercase italic">No {injectionTab} injections</div>
                )}
                
                {injectionTab === 'pending' && (
                  <div className="mt-4 p-4 bg-white/50 rounded-2xl border-2 border-dashed border-purple-200">
                    <h4 className="text-[9px] font-black uppercase text-purple-400 mb-3 flex items-center gap-2"><Plus size={12}/> Register Specialty Injection</h4>
                    <div className="space-y-2">
                      <input value={newInjection.name} onChange={e=>setNewInjection({...newInjection, name: e.target.value})} placeholder="Med Name (Humira, MTX...)" className="w-full p-2 rounded-xl border-2 text-[10px] font-bold" />
                      <div className="flex gap-2">
                        <input value={newInjection.dosage} onChange={e=>setNewInjection({...newInjection, dosage: e.target.value})} placeholder="Dose" className="flex-1 p-2 rounded-xl border-2 text-[10px] font-bold" />
                        <input type="time" value={newInjection.time} onChange={e=>setNewInjection({...newInjection, time: e.target.value})} className="flex-1 p-2 rounded-xl border-2 text-[10px] font-bold" />
                      </div>
                      <div className="flex flex-wrap gap-1 py-1">
                        {DAYS_OF_WEEK.map(d => (
                          <button 
                            key={d} 
                            onClick={() => setNewInjection(p => ({ ...p, schedule: p.schedule.includes(d) ? p.schedule.filter(x => x !== d) : [...p.schedule, d] }))} 
                            className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${newInjection.schedule.includes(d) ? 'bg-purple-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      <select value={newInjection.site} onChange={e=>setNewInjection({...newInjection, site: e.target.value})} className="w-full p-2 rounded-xl border-2 text-[10px] font-bold bg-white">
                        <option>Left Abdomen</option>
                        <option>Right Abdomen</option>
                        <option>Left Thigh</option>
                        <option>Right Thigh</option>
                        <option>Upper Arm</option>
                      </select>
                    </div>
                    <button onClick={() => { if(!newInjection.name) return; setInjections([...injections, { id: Date.now(), ...newInjection, status: 'pending' }]); updateXP(100); }} className="w-full mt-3 py-3 bg-purple-600 text-white rounded-xl font-black uppercase text-[10px] shadow-sm active:scale-95 transition-all">Schedule In Routine</button>
                  </div>
                )}
              </div>
            </DashboardCard>

            <DashboardCard colorClass={VIVID_THEME.black} title="Night Regimen" icon={Moon} noPadding>
               <div className="flex bg-white/5">
                <button onClick={() => setEveningTab('pending')} className={`flex-1 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${eveningTab === 'pending' ? 'border-teal-500 text-white' : 'border-transparent text-white/30'}`}>Remaining</button>
                <button onClick={() => setEveningTab('taken')} className={`flex-1 py-4 font-black text-[10px] uppercase border-b-4 transition-all ${eveningTab === 'taken' ? 'border-teal-500 text-white' : 'border-transparent text-white/30'}`}>Logged</button>
              </div>
              <div className="p-6">{filteredMeds('pm', eveningTab).map(m => <MedItem key={m.id} med={m} onAction={handleMedAction} />)}</div>
            </DashboardCard>
          </>
        )}

        {activeTab === 'diet' && (
          <DashboardCard colorClass={VIVID_THEME.green} title="Clinical Nutrition" icon={Utensils}>
             {!dietPlan ? (
               <div className="text-center py-12 px-6">
                 <Sparkle className="text-green-600 mx-auto mb-6" size={48} />
                 <p className="text-green-800 font-bold mb-8 text-sm">Doctor B can generate a specific diet compatible with: {conditions.join(', ') || 'Global Profile'}.</p>
                 <button onClick={async () => { setLoading(true); const p = await gemini.generateDietPlan(meds, conditions); setDietPlan(p); setLoading(false); }} className="w-full py-5 bg-white text-green-700 font-black rounded-3xl border-4 border-green-200 shadow-xl uppercase text-sm active:scale-95 hover:border-green-300 transition-all">Calculate AI Menu</button>
               </div>
             ) : (
               <div className="space-y-4">
                  {dietPlan.meals.map((m, i) => (
                    <div key={i} className="bg-white p-5 rounded-[2rem] border-2 border-green-50 shadow-sm transition-transform hover:scale-[1.02]">
                       <h4 className="font-black text-green-900 text-sm uppercase mb-1">{m.name}</h4>
                       <p className="text-xs text-green-700 font-bold leading-relaxed">{m.desc}</p>
                    </div>
                  ))}
                  <button onClick={() => setDietPlan(null)} className="w-full py-4 text-green-600 font-black uppercase text-[10px] flex items-center justify-center gap-2 active:scale-95"><History size={14}/> Recalculate AI Plan</button>
               </div>
             )}
          </DashboardCard>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[70vh]">
             {isLiveActive && (
              <div className="absolute inset-0 z-[500] bg-[#002B24] p-8 flex flex-col items-center justify-center text-center">
                 <button onClick={stopLiveSession} className="absolute top-8 right-8 text-white/50 hover:text-white"><X size={32}/></button>
                 <Waves size={80} className="text-teal-300 animate-pulse mb-8" />
                 <h2 className="text-3xl font-black text-white uppercase mb-2">Doctor B Voice</h2>
                 <p className="text-white font-bold text-xl leading-tight">{liveTranscription || "Listening attentively..."}</p>
                 <button onClick={stopLiveSession} className="mt-12 py-6 px-16 bg-red-600 text-white font-black rounded-full uppercase border-b-4 border-red-800 shadow-xl active:scale-95 transition-all"><MicOff size={24}/></button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 no-scrollbar mb-4">
               {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-5 rounded-[2.2rem] max-w-[85%] font-bold text-sm shadow-sm transition-all hover:shadow-md ${m.role === 'user' ? 'bg-teal-600 text-white' : 'bg-white border-2 border-teal-50 text-teal-900'}`}>{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-3 bg-white p-3 rounded-full border-2 border-teal-100 shadow-xl items-center">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Ask Doctor B..." className="flex-1 p-4 bg-transparent font-bold outline-none text-sm" />
              <button onClick={handleSendMessage} className="w-14 h-14 bg-teal-600 text-white rounded-full flex items-center justify-center active:scale-95 shadow-lg"><Send size={24}/></button>
              <button onClick={startLiveSession} className="w-12 h-12 flex items-center justify-center text-teal-600 bg-teal-50 rounded-full active:scale-95 shadow-inner"><Mic size={20}/></button>
            </div>
          </div>
        )}

        {activeTab === 'vault' && (
          <DashboardCard colorClass={VIVID_THEME.mint} title="Clinical Vault" icon={FolderOpen}>
             <div className="grid grid-cols-2 gap-4">
                <div onClick={() => fileInputRef.current?.click()} className="bg-white p-8 rounded-[2.5rem] border-4 border-dashed border-teal-200 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-all hover:bg-teal-50">
                  <Camera size={40} className="text-teal-500 mb-3" />
                  <span className="text-[10px] font-black uppercase text-teal-700 leading-tight">Identify<br/>Pill</span>
                </div>
                <div onClick={() => scriptInputRef.current?.click()} className="bg-white p-8 rounded-[2.5rem] border-4 border-dashed border-blue-200 flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-all hover:bg-blue-50">
                  <FileText size={40} className="text-blue-500 mb-3" />
                  <span className="text-[10px] font-black uppercase text-blue-700 leading-tight">Scan New<br/>Script</span>
                </div>
                {pharmacy.phone && (
                  <div onClick={contactPharmacy} className="bg-green-600 p-8 rounded-[2.5rem] flex flex-col items-center justify-center text-center text-white col-span-2 cursor-pointer active:scale-95 shadow-lg border-b-4 border-green-800 hover:bg-green-700 transition-all">
                    <MessageCircle size={40} className="mb-3" />
                    <span className="text-[10px] font-black uppercase">Refill via WhatsApp</span>
                  </div>
                )}
                {vault.map(v => (
                   <div key={v.id} className="bg-white p-3 rounded-3xl border-2 border-gray-100 shadow-sm overflow-hidden transition-all hover:scale-[1.05]">
                      <img src={v.data} className="w-full h-32 object-cover rounded-2xl mb-2" />
                      <h4 className="font-black text-[10px] truncate px-1">{v.name}</h4>
                   </div>
                ))}
             </div>
          </DashboardCard>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
             <div className="p-6 bg-black text-white rounded-[2rem] flex flex-col gap-3 shadow-2xl border-b-4 border-teal-600">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <ShieldCheck size={20} className="text-teal-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest">System Status: OK</span>
                 </div>
                 <span className="px-3 py-1 bg-teal-600 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-sm">{REVISION} GOLD</span>
               </div>
               <div className="h-[1px] bg-white/10 w-full" />
               <div className="flex justify-between items-center text-[8px] font-bold text-gray-400">
                 <span>PRODUCTION DEPLOYED: {PRODUCTION_DATE}</span>
                 <span>LOCKED BY DEV</span>
               </div>
             </div>

             <DashboardCard colorClass={VIVID_THEME.blue} title="SOS Contacts" icon={UserPlus}>
                <div className="space-y-4">
                   <div className="grid grid-cols-1 gap-2">
                      <input value={newContact.name} onChange={e=>setNewContact({...newContact, name: e.target.value})} placeholder="Contact Name" className="w-full p-3 border-2 rounded-xl text-xs font-bold bg-white focus:border-blue-500 outline-none transition-colors" />
                      <input value={newContact.phone} onChange={e=>setNewContact({...newContact, phone: e.target.value})} placeholder="Phone (+ country code)" className="w-full p-3 border-2 rounded-xl text-xs font-bold bg-white focus:border-blue-500 outline-none transition-colors" />
                      <button onClick={() => { if(!newContact.name || !newContact.phone) return; setEmergencyContacts([...emergencyContacts, { id: Date.now().toString(), ...newContact }]); setNewContact({name:'', phone:''}); }} className="w-full py-3 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black uppercase text-[10px] gap-2 active:scale-95 hover:bg-blue-700 transition-all shadow-md"><Plus size={16}/> Add Emergency Contact</button>
                   </div>
                   <div className="space-y-2">
                      {emergencyContacts.map(c => (
                        <div key={c.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border-2 border-blue-50 shadow-sm transition-all hover:border-blue-200">
                           <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase text-blue-900">{c.name}</span>
                             <span className="text-[10px] font-bold text-blue-300">{c.phone}</span>
                           </div>
                           <button onClick={() => setEmergencyContacts(emergencyContacts.filter(x => x.id !== c.id))} className="text-red-400 p-2 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                        </div>
                      ))}
                   </div>
                </div>
             </DashboardCard>

             <DashboardCard colorClass={VIVID_THEME.green} title="Pharmacy WhatsApp" icon={Share2}>
                <div className="space-y-4">
                   <div className="flex flex-col gap-2">
                     <p className="text-[9px] font-black uppercase text-green-700 ml-1">Connect your preferred pharmacy</p>
                     <input value={pharmacy.name} onChange={e=>setPharmacy({...pharmacy, name: e.target.value})} placeholder="Pharmacy Name" className="w-full p-3 border-2 rounded-xl text-xs font-bold bg-white outline-none focus:border-green-500 transition-colors" />
                     <input value={pharmacy.phone} onChange={e=>setPharmacy({...pharmacy, phone: e.target.value})} placeholder="Phone (+ country code)" className="w-full p-3 border-2 rounded-xl text-xs font-bold bg-white outline-none focus:border-green-500 transition-colors" />
                   </div>
                </div>
             </DashboardCard>

             <DashboardCard colorClass={VIVID_THEME.black} title="Clinical Profile" icon={DoctorIcon}>
                <div className="space-y-4">
                   <div className="flex flex-wrap gap-2">
                      {conditions.map((c, i) => (
                        <div key={i} className="px-3 py-2 bg-white/10 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 border border-white/20">
                           {c} <X size={12} className="text-red-400 cursor-pointer hover:text-red-300" onClick={() => setConditions(conditions.filter(x => x !== c))} />
                        </div>
                      ))}
                   </div>
                   <input value={newConditionInput} onChange={e=>setNewConditionInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && (setConditions([...conditions, newConditionInput]), setNewConditionInput(""))} placeholder="Add diagnosis..." className="w-full bg-transparent p-4 border-b border-white/10 text-white font-bold text-sm outline-none placeholder:text-white/30 focus:border-teal-500 transition-all" />
                </div>
             </DashboardCard>
             <button onClick={() => { if(confirm("This will permanently erase all clinical data. Continue?")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-5 bg-red-900/40 text-red-700 font-black rounded-3xl uppercase text-xs active:scale-95 transition-all border border-red-900/20">Reset Profile Database</button>
          </div>
        )}
      </main>

      {/* SOS Modal */}
      {showSOSModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-red-950/90 backdrop-blur-xl">
           <div className="bg-white w-full max-sm rounded-[3rem] p-10 text-center shadow-2xl border-t-8 border-red-600">
              <AlertCircle size={64} className="text-red-600 mx-auto mb-6 animate-swing" />
              <h2 className="text-3xl font-black uppercase text-red-700 mb-6 tracking-tighter leading-tight">Emergency SOS</h2>
              <div className="space-y-4">
                 <button onClick={() => window.open('tel:911')} className="w-full py-6 bg-red-600 text-white rounded-3xl font-black uppercase flex items-center justify-center gap-4 text-xl shadow-xl active:scale-95 transition-transform"><Phone size={32}/> CALL 911</button>
                 <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                    {emergencyContacts.map(c => (
                      <button key={c.id} onClick={() => window.open(`tel:${c.phone}`)} className="p-5 bg-red-50 text-red-700 rounded-2xl font-black uppercase text-xs flex justify-between items-center border-2 border-red-100 active:scale-95 hover:bg-red-100 transition-all">
                        <span className="truncate flex-1 text-left">{c.name}</span>
                        <PhoneForwarded size={18} className="ml-2 shrink-0"/>
                      </button>
                    ))}
                 </div>
                 <button onClick={() => setShowSOSModal(false)} className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-all">Close</button>
              </div>
           </div>
        </div>
      )}

      {/* Alarm Overlay */}
      {activeAlarmItem && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-amber-950/90 backdrop-blur-xl">
            <div className="bg-white w-full max-w-sm rounded-[4rem] p-12 shadow-2xl text-center border-b-[16px] border-amber-500">
              <Bell size={64} className="text-amber-600 mx-auto mb-8 animate-swing" />
              <h2 className="text-4xl font-black uppercase text-amber-950 mb-4 tracking-tighter">Clinical Alert</h2>
              <div className="bg-amber-50 p-8 rounded-[3rem] mb-10 border-2 border-amber-200">
                <h4 className="text-3xl font-black text-amber-900 truncate mb-1">{activeAlarmItem.data.n || activeAlarmItem.data.name}</h4>
                <p className="font-black text-amber-600 uppercase text-sm">{activeAlarmItem.data.d || activeAlarmItem.data.dosage}</p>
                {activeAlarmItem.type === 'inj' && <p className="text-[10px] font-black text-purple-600 uppercase mt-2">Injection Site: {activeAlarmItem.data.site}</p>}
              </div>
              <button onClick={() => activeAlarmItem.type === 'med' ? handleMedAction(activeAlarmItem.data.id, 'take') : handleInjectionAction(activeAlarmItem.data.id, 'take')} className="w-full py-6 bg-green-500 text-white font-black text-2xl rounded-3xl uppercase shadow-xl transition-transform active:scale-95">Acknowledge</button>
            </div>
          </div>
      )}

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-8 border-teal-50 px-8 py-5 pb-10 flex justify-between items-center z-[800] shadow-2xl">
        <button onClick={()=>setActiveTab('home')} className={`p-2 transition-all ${activeTab==='home'?'text-teal-600 scale-125':'text-gray-300'}`}><Sun size={28}/></button>
        <button onClick={()=>setActiveTab('diet')} className={`p-2 transition-all ${activeTab==='diet'?'text-teal-600 scale-125':'text-gray-300'}`}><Utensils size={28}/></button>
        <button onClick={()=>setActiveTab('chat')} className="w-16 h-16 bg-teal-600 rounded-3xl flex items-center justify-center text-white shadow-xl -mt-10 border-4 border-white transition-transform active:scale-90 hover:scale-110 active:shadow-inner"><MessageCircle size={32}/></button>
        <button onClick={()=>setActiveTab('vault')} className={`p-2 transition-all ${activeTab==='vault'?'text-teal-600 scale-125':'text-gray-300'}`}><FolderOpen size={28}/></button>
        <button onClick={()=>setActiveTab('settings')} className={`p-2 transition-all ${activeTab==='settings'?'text-teal-600 scale-125':'text-gray-300'}`}><Settings size={28}/></button>
      </nav>

      {/* Invisible inputs */}
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={(e) => {
        const f = e.target.files?.[0]; if(!f) return; setLoading(true); const r = new FileReader(); r.onloadend = async () => {
          const b64 = (r.result as string).split(',')[1];
          try {
            const res = await gemini.identifyPill(b64);
            setMeds([...meds, { id: Date.now(), n: res.n||'Unidentified', d: res.d||'N/A', block: (res.block as any)||'am', status: 'pending', time: '08:00', schedule: DAYS_OF_WEEK, count: 30 }]);
            setVault([{ id: Date.now(), name: `Pill Scan: ${res.n||'Unidentified'}`, date: new Date().toLocaleDateString(), data: r.result as string, type: 'image' }, ...vault]);
            updateXP(150);
          } catch(e) { alert("Pill analysis failed."); } finally { setLoading(false); }
        }; r.readAsDataURL(f);
      }} />
      <input type="file" ref={scriptInputRef} hidden accept="image/*" onChange={(e) => {
        const f = e.target.files?.[0]; if(!f) return; setLoading(true); const r = new FileReader(); r.onloadend = async () => {
          const b64 = (r.result as string).split(',')[1];
          try {
            const res = await gemini.analyzePrescription(b64);
            // Smart routing: update both states
            setMeds(p => [...p, ...res.meds]);
            setInjections(p => [...p, ...res.injections]);
            setVault([{ id: Date.now(), name: `Clinical Script Extract`, date: new Date().toLocaleDateString(), data: r.result as string, type: 'image' }, ...vault]);
            updateXP(250);
          } catch(e) { alert("Scan failed."); } finally { setLoading(false); }
        }; r.readAsDataURL(f);
      }} />
    </div>
  );
}

export default App;
