import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, onChildAdded, remove, update, off, onDisconnect } from "firebase/database";
import { Send, SkipForward, Coffee, Zap, ShieldAlert, Trash2 } from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = {
  apiKey: "AIzaSyBrNE-drpo6cMFctOEP9TuK-CEOpQnOJeE",
  authDomain: "random-chat-589e3.firebaseapp.com",
  projectId: "random-chat-589e3",
  databaseURL: "https://random-chat-589e3-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  storageBucket: "random-chat-589e3.firebasestorage.app",
  messagingSenderId: "407481576988",
  appId: "1:407481576988:web:bdad1f39b91466fd7c39d9",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const LOCATION_DATA = {
  "马来西亚 (Malaysia)": ["柔佛 (Johor)", "雪隆区 (Klang Valley)", "槟城 (Penang)", "马六甲 (Melaka)", "霹雳 (Perak)", "其他州属"],
  "新加坡 (Singapore)": ["全岛 (All)", "中部 (Central)", "东部 (East)", "西部 (West)", "北部 (North)"],
  "其他国家 (Others)": ["亚洲其他", "美洲", "欧洲", "大洋洲"]
};

// --- 顶部状态进度条组件 ---
const StatusBar = ({ maleRatio, femaleRatio }) => (
  <div className="w-full bg-white shadow-sm z-10 relative">
    <div className="flex h-1.5 w-full transition-all duration-1000">
      <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${maleRatio}%` }}></div>
      <div className="h-full bg-pink-400 transition-all duration-1000" style={{ width: `${femaleRatio}%` }}></div>
    </div>
    <div className="px-4 py-2 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
        <span>已连线至全球废话服务器</span>
      </div>
      <div className="flex gap-3">
        <span className="text-blue-500 transition-all">♂ {maleRatio}%</span>
        <span className="text-pink-500 transition-all">♀ {femaleRatio}%</span>
      </div>
    </div>
  </div>
);

export default function App() {
  const [appState, setAppState] = useState('login');
  const [profile, setProfile] = useState({ 
    alias: '', 
    gender: 'female', 
    country: '', 
    region: '', 
    id: Math.random().toString(36).substring(7) 
  });
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [allRooms, setAllRooms] = useState({}); 
  const [genderRatio, setGenderRatio] = useState({ m: 50, f: 50 });
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 全局男女比例实时计算
  useEffect(() => {
    const roomsRef = ref(db, 'rooms');
    const unsub = onValue(roomsRef, (snap) => {
      let mCount = 0;
      let fCount = 0;
      if (snap.exists()) {
        Object.values(snap.val()).forEach(room => {
          if (room.userA?.gender === 'male') mCount++;
          if (room.userA?.gender === 'female') fCount++;
          if (room.userB?.gender === 'male') mCount++;
          if (room.userB?.gender === 'female') fCount++;
        });
      }
      const total = mCount + fCount;
      if (total > 0) {
        setGenderRatio({
          m: Math.round((mCount / total) * 100),
          f: Math.round((fCount / total) * 100)
        });
      } else {
        setGenderRatio({ m: 50, f: 50 });
      }
    });
    return () => unsub();
  }, []);

  // 上帝视角监听
  useEffect(() => {
    if (appState === 'admin') {
      const roomsRef = ref(db, 'rooms');
      const unsubscribe = onValue(roomsRef, (snapshot) => {
        setAllRooms(snapshot.val() || {});
      });
      return () => unsubscribe();
    }
  }, [appState]);

  // 聊天室核心逻辑
  useEffect(() => {
    if (room && appState === 'chat') {
      const msgRef = ref(db, `rooms/${room.id}/messages`);
      const unsubscribeMsg = onChildAdded(msgRef, (snapshot) => {
        setMessages(prev => {
          if (prev.find(m => m.id === snapshot.key)) return prev;
          return [...prev, { ...snapshot.val(), id: snapshot.key }];
        });
      });
      
      const statusRef = ref(db, `rooms/${room.id}`);
      const unsubscribeStatus = onValue(statusRef, (snapshot) => {
        if (!snapshot.exists()) {
          setAppState('login');
          setRoom(null);
          setMessages([]);
        }
      });

      return () => {
        off(msgRef);
        off(statusRef);
      };
    }
  }, [room, appState]);

  const startMatching = async () => {
    if (!profile.alias.trim() || !profile.country || !profile.region) return;
    if (profile.alias === 'AdminMaster123') {
      setAppState('admin');
      return;
    }
    
    setAppState('matching');
    const waitingRef = ref(db, 'waiting');
    
    onValue(waitingRef, async (snapshot) => {
      const data = snapshot.val();
      off(waitingRef);

      if (data) {
        const waitingRoomId = Object.keys(data)[0];
        const roomInfo = data[waitingRoomId];
        await update(ref(db, `rooms/${waitingRoomId}`), { 
          userB: profile, 
          status: 'active' 
        });
        await remove(ref(db, `waiting/${waitingRoomId}`));
        setRoom({ id: waitingRoomId, partner: roomInfo.userA });
        setAppState('chat');
      } else {
        const newRoomId = push(ref(db, 'rooms')).key;
        await set(ref(db, `rooms/${newRoomId}`), { 
          id: newRoomId, 
          userA: profile, 
          status: 'waiting' 
        });
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
    await push(ref(db, `rooms/${room.id}/messages`), { 
      text: inputText, 
      senderId: profile.id, 
      senderAlias: profile.alias, 
      time: Date.now() 
    });
    setInputText('');
  };

  const handleNext = async () => {
    if (room) {
      await remove(ref(db, `rooms/${room.id}`));
    }
    startMatching();
  };

  // --- 渲染逻辑 ---

  if (appState === 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 p-8 font-sans">
        <h1 className="text-xl font-bold mb-6 flex items-center gap-2 text-red-500"><ShieldAlert /> 上帝视角</h1>
        <div className="grid gap-6">
          {Object.entries(allRooms).map(([id, data]) => (
            <div key={id} className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <p className="font-bold text-white text-base">{data.userA?.alias} ↔ {data.userB?.alias || '等待中...'}</p>
                <button onClick={() => remove(ref(db, `rooms/${id}`))} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90">
                  <Trash2 size={20} />
                </button>
              </div>
              
              {/* 这里就是新增的：完整聊天记录展示区 */}
              <div className="bg-slate-900 p-4 rounded-2xl max-h-48 overflow-y-auto space-y-2 border border-slate-800 shadow-inner">
                {data.messages ? (
                  Object.values(data.messages).map((msg, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-bold text-slate-400">[{msg.senderAlias}]: </span>
                      <span className="text-slate-200">{msg.text}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic text-center py-2">还没开始讲废话...</div>
                )}
              </div>

            </div>
          ))}
        </div>
        <button onClick={() => window.location.reload()} className="mt-12 block mx-auto text-slate-500 text-xs underline font-bold uppercase tracking-widest">退出监控</button>
      </div>
    );
  }

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <StatusBar maleRatio={genderRatio.m} femaleRatio={genderRatio.f} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-[48px] shadow-2xl w-full max-w-sm p-10 relative border border-white">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-tr from-pink-400 to-blue-400 rounded-[24px] flex items-center justify-center mx-auto mb-4 transform rotate-6 shadow-xl">
                <Coffee className="text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">聊点废话</h1>
              <p className="text-slate-400 text-[10px] mt-2 uppercase tracking-widest font-black opacity-30 italic">Just nonsense, no record.</p>
            </div>
            <div className="space-y-4">
              <input 
                placeholder="你的代号" 
                className="w-full bg-slate-50 p-5 rounded-[24px] border-none shadow-inner font-bold text-sm outline-none focus:ring-2 focus:ring-pink-100 transition-all" 
                value={profile.alias} 
                onChange={e => setProfile({...profile, alias: e.target.value})} 
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setProfile({...profile, gender: 'male'})} className={`p-5 rounded-[24px] text-xs font-black transition-all ${profile.gender === 'male' ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-300'}`}>男生 ♂</button>
                <button onClick={() => setProfile({...profile, gender: 'female'})} className={`p-5 rounded-[24px] text-xs font-black transition-all ${profile.gender === 'female' ? 'bg-pink-500 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-300'}`}>女生 ♀</button>
              </div>
              <select className="w-full bg-slate-50 p-5 rounded-[24px] border-none shadow-inner text-xs font-bold text-slate-600 outline-none" value={profile.country} onChange={e => setProfile({...profile, country: e.target.value, region: ''})}>
                <option value="">选择国家</option>
                {Object.keys(LOCATION_DATA).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {profile.country && (
                <select className="w-full bg-slate-50 p-5 rounded-[24px] border-none shadow-inner text-xs font-bold text-slate-600 outline-none animate-in fade-in slide-in-from-top-1" value={profile.region} onChange={e => setProfile({...profile, region: e.target.value})}>
                  <option value="">选择地区</option>
                  {LOCATION_DATA[profile.country].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              )}
              <button onClick={startMatching} className="w-full bg-slate-900 text-white font-black py-5 rounded-[28px] shadow-2xl hover:bg-black transition-all mt-6 active:scale-95 shadow-slate-300">随便抓个人</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'matching') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-10 text-center font-sans">
        <div className="w-48 h-48 bg-pink-200 rounded-full animate-ping absolute opacity-30"></div>
        <Zap className="text-pink-500 animate-bounce relative z-10" size={64} />
        <h2 className="text-2xl font-black mt-12 text-slate-800 relative z-10 tracking-tight">正在拉人...</h2>
        <p className="text-xs text-slate-400 mt-2 uppercase tracking-[0.3em] font-bold">Searching partner</p>
      </div>
    );
  }

  // 聊天主界面
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden font-sans">
      <StatusBar maleRatio={genderRatio.m} femaleRatio={genderRatio.f} />
      <div className="bg-white/90 backdrop-blur-md p-4 shadow-sm flex justify-between items-center sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-[20px] flex items-center justify-center text-white font-black shadow-lg ${room.partner?.gender === 'female' ? 'bg-pink-400 shadow-pink-100' : 'bg-blue-400 shadow-blue-100'}`}>
            {room.partner?.alias.charAt(0)}
          </div>
          <div>
            <p className="font-black text-slate-800 text-lg leading-none">{room.partner?.alias}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">{room.partner?.region}</p>
          </div>
        </div>
        <button onClick={handleNext} className="bg-slate-100 hover:bg-slate-200 px-6 py-3 rounded-full text-[11px] font-black flex items-center gap-2 transition-all active:scale-95 shadow-sm">换人 <SkipForward size={14}/></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.senderId === profile.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 text-sm font-bold shadow-sm transition-all ${msg.senderId === profile.id ? 'bg-blue-600 text-white rounded-[28px] rounded-tr-none shadow-blue-200 shadow-xl' : 'bg-white text-slate-800 rounded-[28px] rounded-tl-none border border-slate-100 shadow-md'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-5 bg-white/90 backdrop-blur-md border-t border-slate-100">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-3xl mx-auto items-center">
          <input 
            className="flex-1 bg-slate-100 rounded-[22px] px-6 py-4 outline-none focus:ring-2 focus:ring-pink-200 transition-all text-sm font-bold shadow-inner" 
            placeholder="打句废话..." 
            value={inputText} 
            onChange={e => setInputText(e.target.value)} 
          />
          <button type="submit" className="bg-pink-500 hover:bg-pink-600 text-white w-14 h-14 rounded-[20px] flex items-center justify-center shadow-lg active:scale-90 transition-all shadow-pink-200">
            <Send size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

// --- 安全的挂载代码 ---
if (typeof window !== 'undefined') {
  const container = document.getElementById('root');
  if (container && !window.__HAS_MOUNTED__) {
    window.__HAS_MOUNTED__ = true;
    const root = createRoot(container);
    root.render(<App />);
  }
}
