import { createRoot } from 'react-dom/client';
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, onChildAdded, remove, update, off, onDisconnect } from "firebase/database";
import { Send, SkipForward, User, MapPin, Coffee, Zap, MessageCircle, Loader2, ShieldAlert, Eye, Ban, Trash2 } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyBrNE-drpo6cMFctOEP9TuK-CEOpQnOJeE",
  authDomain: "random-chat-589e3.firebaseapp.com",
  projectId: "random-chat-589e3",
  databaseURL: "https://random-chat-589e3-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  storageBucket: "random-chat-589e3.firebasestorage.app",
  messagingSenderId: "407481576988",
  appId: "1:407481576988:web:bdad1f39b91466fd7c39d9",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const LOCATION_DATA = {
  "马来西亚 (Malaysia)": ["柔佛 (Johor)", "雪隆区 (Klang Valley)", "槟城 (Penang)", "马六甲 (Melaka)", "霹雳 (Perak)", "其他州属"],
  "新加坡 (Singapore)": ["全岛 (All)", "中部 (Central)", "东部 (East)", "西部 (West)", "北部 (North)"],
  "其他国家 (Others)": ["亚洲其他", "美洲", "欧洲", "大洋洲"]
};

export default function App() {
  const [appState, setAppState] = useState('login');
  const [profile, setProfile] = useState({ alias: '', gender: 'female', country: '', region: '', id: Math.random().toString(36).substring(7) });
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [allRooms, setAllRooms] = useState({}); 
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (appState === 'admin') {
      const roomsRef = ref(db, 'rooms');
      onValue(roomsRef, (snapshot) => { setAllRooms(snapshot.val() || {}); });
      return () => off(roomsRef);
    }
  }, [appState]);

  useEffect(() => {
    if (room && appState === 'chat') {
      const msgRef = ref(db, `rooms/${room.id}/messages`);
      onChildAdded(msgRef, (snapshot) => {
        setMessages(prev => [...prev, { ...snapshot.val(), id: snapshot.key }]);
      });
      const statusRef = ref(db, `rooms/${room.id}`);
      onValue(statusRef, (snapshot) => {
        if (!snapshot.exists()) {
          setAppState('login');
          setRoom(null);
          setMessages([]);
        }
      });
      return () => { off(msgRef); off(statusRef); };
    }
  }, [room, appState]);

  const startMatching = async () => {
    if (!profile.alias.trim() || !profile.country || !profile.region) return;
    if (profile.alias === 'AdminMaster123') { setAppState('admin'); return; }
    setAppState('matching');
    const waitingRef = ref(db, 'waiting');
    onValue(waitingRef, async (snapshot) => {
      const data = snapshot.val();
      off(waitingRef);
      if (data) {
        const waitingRoomId = Object.keys(data)[0];
        const roomInfo = data[waitingRoomId];
        await update(ref(db, `rooms/${waitingRoomId}`), { userB: profile, status: 'active' });
        await remove(ref(db, `waiting/${waitingRoomId}`));
        setRoom({ id: waitingRoomId, partner: roomInfo.userA });
        setAppState('chat');
      } else {
        const newRoomId = push(ref(db, 'rooms')).key;
        await set(ref(db, `rooms/${newRoomId}`), { id: newRoomId, userA: profile, status: 'waiting' });
        await set(ref(db, `waiting/${newRoomId}`), { userA: profile });
        onDisconnect(ref(db, `rooms/${newRoomId}`)).remove();
        onDisconnect(ref(db, `waiting/${newRoomId}`)).remove();
        const myRoomRef = ref(db, `rooms/${newRoomId}`);
        onValue(myRoomRef, (snapshot) => {
          const updatedRoom = snapshot.val();
          if (updatedRoom && updatedRoom.userB) {
            off(myRoomRef);
            setRoom({ id: newRoomId, partner: updatedRoom.userB });
            setAppState('chat');
          }
        });
      }
    });
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !room) return;
    await push(ref(db, `rooms/${room.id}/messages`), { text: inputText, senderId: profile.id, senderAlias: profile.alias, time: Date.now() });
    setInputText('');
  };

  const handleNext = async () => {
    if (room) { await remove(ref(db, `rooms/${room.id}`)); }
    startMatching();
  };

  if (appState === 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 p-8">
        <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-500"><ShieldAlert /> 后台监控</h1>
        <div className="grid gap-4">
          {Object.entries(allRooms).map(([id, data]) => (
            <div key={id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex justify-between items-center">
              <div>
                <p className="font-bold text-white text-sm">{data.userA?.alias} ↔ {data.userB?.alias || '...'}</p>
                <div className="mt-2 text-xs text-blue-300 italic">最新: {data.messages ? Object.values(data.messages).pop().text : '无'}</div>
              </div>
              <button onClick={() => remove(ref(db, `rooms/${id}`))} className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <button onClick={() => window.location.reload()} className="mt-10 block mx-auto text-slate-600 text-xs underline">退出</button>
      </div>
    );
  }

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm p-10 relative overflow-hidden border border-white">
          <div className="relative z-10 text-center mb-10">
            <div className="w-14 h-14 bg-gradient-to-tr from-pink-400 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 transform rotate-3"><Coffee className="text-white" /></div>
            <h1 className="text-2xl font-black text-slate-800">聊点废话</h1>
          </div>
          <div className="space-y-4 relative z-10">
            <input placeholder="代号" className="w-full bg-slate-50 p-4 rounded-3xl border-none shadow-inner font-bold text-sm" value={profile.alias} onChange={e => setProfile({...profile, alias: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setProfile({...profile, gender: 'male'})} className={`p-4 rounded-3xl text-xs font-black transition-all ${profile.gender === 'male' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-300'}`}>男生 ♂</button>
              <button onClick={() => setProfile({...profile, gender: 'female'})} className={`p-4 rounded-3xl text-xs font-black transition-all ${profile.gender === 'female' ? 'bg-pink-500 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-300'}`}>女生 ♀</button>
            </div>
            <select className="w-full bg-slate-50 p-4 rounded-[24px] border-none shadow-inner text-xs font-bold text-slate-600 outline-none" value={profile.country} onChange={e => setProfile({...profile, country: e.target.value, region: ''})}>
              <option value="">国家</option>
              {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {profile.country && (
              <select className="w-full bg-slate-50 p-4 rounded-[24px] border-none shadow-inner text-xs font-bold text-slate-600 outline-none" value={profile.region} onChange={e => setProfile({...profile, region: e.target.value})}>
                <option value="">地区</option>
                {LOCATION_DATA[profile.country].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <button onClick={startMatching} className="w-full bg-slate-900 text-white font-black py-5 rounded-[30px] shadow-2xl hover:bg-black transition-all mt-4 active:scale-95">随便抓个人</button>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'matching') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-10 text-center relative overflow-hidden">
        <div className="w-40 h-40 bg-pink-200 rounded-full animate-ping absolute opacity-40"></div>
        <Zap className="text-pink-500 animate-bounce relative z-10" size={60} />
        <h2 className="text-xl font-black mt-10 text-slate-800 relative z-10 tracking-tight">拉人中...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      <div className="bg-white/80 backdrop-blur-md p-4 shadow-sm flex justify-between items-center sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-[18px] flex items-center justify-center text-white font-black shadow-lg ${room.partner?.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`}>
            {room.partner?.alias.charAt(0)}
          </div>
          <div>
            <p className="font-black text-slate-800 leading-none">{room.partner?.alias}</p>
            <p className="text-[9px] text-slate-400 mt-1 font-bold uppercase tracking-wider">{room.partner?.region}</p>
          </div>
        </div>
        <button onClick={handleNext} className="bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-full text-[10px] font-black flex items-center gap-2 transition-all active:scale-95">换人 <SkipForward size={14}/></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.senderId === profile.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 text-[13px] font-bold shadow-sm transition-all ${msg.senderId === profile.id ? 'bg-blue-500 text-white rounded-[24px] rounded-tr-none shadow-blue-200 shadow-xl' : 'bg-white text-slate-800 rounded-[24px] rounded-tl-none border border-slate-100 shadow-md'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-slate-100">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-2xl mx-auto items-center">
          <input className="flex-1 bg-slate-100 rounded-[22px] px-6 py-4 outline-none focus:ring-2 focus:ring-pink-200 transition-all text-sm font-bold" placeholder="打句废话..." value={inputText} onChange={e => setInputText(e.target.value)} />
          <button type="submit" className="bg-pink-500 hover:bg-pink-600 text-white w-12 h-12 rounded-[18px] flex items-center justify-center shadow-lg active:scale-90 transition-all shadow-pink-200"><Send size={18} /></button>
        </form>
      </div>
    </div>
  );
}
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
