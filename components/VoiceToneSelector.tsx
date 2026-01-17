import React, { useState, useEffect, useRef } from 'react';
import { Mic2, MessageSquare, Timer } from 'lucide-react';

interface VoiceToneSelectorProps {
  voiceStylePrompt: string;
  onVoiceStylePromptChange: (prompt: string) => void;
  disabled: boolean;
}

const VOICE_PRESETS = [
  { id: 'professional', label: '전문 성우', prompt: '전문적이고 신뢰감 있는 뉴스 앵커나 다큐멘터리 성우 톤으로 가장 정확하고 깔끔하게 낭독' },
  { id: 'friendly', label: '밝고 친근', prompt: '활기차고 다정한 이웃 같은 친근한 일상 톤' },
  { id: 'calm', label: '차분한 낭독', prompt: '평온하고 부드러운 오디오북이나 명상 가이드 톤' },
  { id: 'urgent', label: '긴박한 뉴스', prompt: '긴박하고 빠른 호흡의 긴급 속보 및 재난 알림 톤' },
  { id: 'emotional', label: '감성 라디오', prompt: '따뜻하고 여운이 남는 심야 라디오 DJ의 감성적인 톤' },
  { id: 'narrative', label: '구연 동화', prompt: '아이들에게 책을 읽어주듯 흥미진진한 구연 동화 톤' },
  { id: 'power', label: '강력 홍보', prompt: '홈쇼핑이나 영화 예고편처럼 웅장하고 강력한 전달 톤' },
  { id: 'uninterested', label: '귀찮은 듯', prompt: '매우 의욕이 없고 귀찮은 듯이, 성의 없게 툭툭 내뱉는 시니컬한 말투' },
  { id: 'playful', label: '촐싹촐싹', prompt: '매우 까불거리고 촐싹대며, 장난기 가득하고 높은 톤의 익살스러운 말투' },
];

const VoiceToneSelector: React.FC<VoiceToneSelectorProps> = ({
  voiceStylePrompt,
  onVoiceStylePromptChange,
  disabled
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('professional');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [speed, setSpeed] = useState<number>(1.0);

  const isCustomActive = customPrompt.trim().length > 0;

  const onChangeRef = useRef(onVoiceStylePromptChange);
useEffect(() => {
  onChangeRef.current = onVoiceStylePromptChange;
}, [onVoiceStylePromptChange]);

 useEffect(() => {
  const speedInstruction = `[낭독 속도: ${speed}배속으로 읽어주세요. ${
    speed > 1.0 ? '평소보다 더 빠르게 읽으세요.' : speed < 1.0 ? '평소보다 더 느리게 읽으세요.' : '일반적인 속도로 읽으세요.'
  }]`;

  let nextPrompt = '';
  if (isCustomActive) {
    nextPrompt = `${customPrompt} ${speedInstruction}`;
  } else {
    const preset = VOICE_PRESETS.find(p => p.id === selectedPreset);
    if (preset) nextPrompt = `${preset.prompt} ${speedInstruction}`;
  }

  // ✅ “값이 달라질 때만” 부모 setState 호출 → 무한 업데이트 방지
  if (nextPrompt && nextPrompt !== voiceStylePrompt) {
    onChangeRef.current(nextPrompt);
  }
}, [selectedPreset, customPrompt, isCustomActive, speed, voiceStylePrompt]);


  return (
    <div className={`
      bg-zinc-950 p-5 rounded-3xl border transition-all duration-300 h-full flex flex-col
      ${disabled ? 'border-zinc-900 opacity-60' : 'border-zinc-800 hover:border-zinc-700 focus-within:border-yellow-400/50'}
    `}>
      <div className="flex items-center gap-2 mb-4">
        <Mic2 className="w-5 h-5 text-emerald-400" />
        <label className="text-base text-zinc-400 font-black uppercase tracking-widest select-none">
            성우 프롬프트 (말투/톤 지정)
        </label>
      </div>
      
     <div className={`w-full flex flex-nowrap gap-2 mb-5 overflow-x-auto transition-all duration-300 ${isCustomActive ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>

       {VOICE_PRESETS.map((preset) => (
  <button
    key={preset.id}
    onClick={() => setSelectedPreset(preset.id)}
    disabled={disabled || isCustomActive}
    className={`
      flex-none px-2 py-2 rounded-xl text-base font-black transition-all border-2 text-center whitespace-nowrap
      ${selectedPreset === preset.id 
        ? 'bg-zinc-100 border-zinc-100 text-black shadow-lg shadow-white/5' 
        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-300'}
    `}
  >
    {preset.label}
  </button>
))}

      </div>

      <div className="flex items-stretch gap-4">
        <div className="relative group flex-grow">
          <div className="absolute left-4 top-5 text-zinc-600 group-focus-within:text-yellow-400 transition-colors">
            <MessageSquare className="w-5 h-5" />
          </div>
          <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={disabled}
              placeholder="직접 입력 시 상단 버튼 무시..."
              className={`
                w-full h-24 bg-zinc-900 border-2 rounded-xl pl-12 pr-4 py-4 text-base text-zinc-100 placeholder:text-zinc-700 transition-all resize-none outline-none leading-relaxed
                ${isCustomActive ? 'border-yellow-400 ring-2 ring-yellow-400/10 bg-zinc-900' : 'border-zinc-800 focus:border-zinc-600'}
              `}
          />
        </div>

        <div className="flex flex-col items-center justify-center gap-3 bg-zinc-900/80 p-5 rounded-2xl border border-zinc-700 min-w-[200px] flex-shrink-0 shadow-xl">
          <label className="text-base text-zinc-400 font-black uppercase flex items-center gap-2 select-none">
            <Timer className="w-5 h-5 text-emerald-400" />
            속도 조절
          </label>
          <div className="flex items-center gap-3 w-full">
            <input 
              type="range" min="0.5" max="1.5" step="0.05" 
              value={speed} 
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="flex-grow h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-sm font-black text-emerald-400 w-10 font-mono text-right tracking-tighter">{speed.toFixed(1)}x</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceToneSelector;
