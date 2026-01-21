// VoiceSelector.tsx ✅ 전체 교체본 (요구사항 반영: 상단=정보(폰트↑), 하단=입력+재생)
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VoiceName } from '../types';
import { Mic2, PlayCircle, StopCircle } from 'lucide-react';
import BgmSelector from './BgmSelector';
import { pitchShiftAudioBuffer } from '../audio/pitchShift';
import { convertToKoreanSpeech } from '../services/geminiService';


interface VoiceSelectorProps {
  selectedVoice: VoiceName;
  onSelect: (voice: VoiceName) => void;

  voiceSpeed: number;
  onSpeedChange: (speed: number) => void;

  // 호환용
  voicePitch: number;
  onPitchChange: (pitch: number) => void;

  disabled: boolean;

  selectedBgm: string | null;
  onSelectBgm: (url: string | null) => void;
  bgmVolume: number;
  onBgmVolumeChange: (vol: number) => void;
}

type VoiceItem = {
  id: string;
  label: string;
  gender: '남성' | '여성';
  modelName: string;
};

const VOICES: VoiceItem[] = [
  // 여성
  { id: 'Achernar', label: '아케르나르', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Achernar' },
  { id: 'Aoede', label: '아오이데', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Aoede' },
  { id: 'Autonoe', label: '아우토노에', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Autonoe' },
  { id: 'Callirrhoe', label: '칼리로에', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Callirrhoe' },
  { id: 'Despina', label: '데스피나', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Despina' },
  { id: 'Erinome', label: '에리노메', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Erinome' },
  { id: 'Gacrux', label: '가크룩스', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Gacrux' },
  { id: 'Kore', label: '코레', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Kore' },
  { id: 'Laomedeia', label: '라오메데이아', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Laomedeia' },
  { id: 'Leda', label: '레다', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Leda' },
  { id: 'Pulcherrima', label: '풀케리마', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Pulcherrima' },
  { id: 'Sulafat', label: '술라파트', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Sulafat' },
  { id: 'Vindemiatrix', label: '빈데미아트릭스', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Vindemiatrix' },
  { id: 'Zephyr', label: '제피르', gender: '여성', modelName: 'ko-KR-Chirp3-HD-Zephyr' },

  // 남성
  { id: 'Achird', label: '아키르드', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Achird' },
  { id: 'Algenib', label: '알제니브', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Algenib' },
  { id: 'Algieba', label: '알기에바', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Algieba' },
  { id: 'Alnilam', label: '알닐람', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Alnilam' },
  { id: 'Charon', label: '카론', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Charon' },
  { id: 'Enceladus', label: '엔켈라두스', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Enceladus' },
  { id: 'Fenrir', label: '펜릴', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Fenrir' },
  { id: 'Iapetus', label: '이아페투스', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Iapetus' },
  { id: 'Orus', label: '오러스', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Orus' },
  { id: 'Puck', label: '퍽', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Puck' },
  { id: 'Rasalgethi', label: '라살게티', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Rasalgethi' },
  { id: 'Sadachbia', label: '사다크비아', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Sadachbia' },
  { id: 'Sadaltager', label: '사달타게르', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Sadaltager' },
  { id: 'Schedar', label: '셰다르', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Schedar' },
  { id: 'Umbriel', label: '엄브리엘', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Umbriel' },
  { id: 'Zubenelgenubi', label: '주베넬게누비', gender: '남성', modelName: 'ko-KR-Chirp3-HD-Zubenelgenubi' },
];

const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onSelect,
  voiceSpeed,
  onSpeedChange,
  voicePitch,
  onPitchChange,
  disabled,
  selectedBgm,
  onSelectBgm,
  bgmVolume,
  onBgmVolumeChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollLeftRef = useRef<number>(0);

  const [previewText, setPreviewText] = useState<string>('안녕하세요. 미리듣기 테스트입니다.');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  

  const maleVoices = useMemo(() => VOICES.filter(v => v.gender === '남성'), []);
  const femaleVoices = useMemo(() => VOICES.filter(v => v.gender === '여성'), []);

  const selected = useMemo(() => {
    const id = String(selectedVoice);
    return VOICES.find(v => v.id === id) || VOICES.find(v => v.id === 'Charon')!;
  }, [selectedVoice]);

  const stopPreview = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    lastScrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = lastScrollLeftRef.current;
  }, [selectedVoice, isPreviewPlaying, previewText, voiceSpeed]);

  useEffect(() => {
    stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVoice, voiceSpeed]);

const synthesizePreviewMp3 = async () => {
  const API_KEY = localStorage.getItem("GEMINI_API_KEY");
  if (!API_KEY) throw new Error('API 키가 설정되어 있지 않습니다.');


    const text = convertToKoreanSpeech(previewText || '');
    if (!text) throw new Error('미리듣기 텍스트가 비어 있습니다.');
const speakingRate = Math.max(0.5, Math.min(2.0, Number(voiceSpeed) || 1.0));

    const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'ko-KR', name: selected.modelName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
        },
      }),
    });

    if (!res.ok) {
      let msg = `TTS 요청 실패 (${res.status})`;
      try {
        const err = await res.json();
        msg = err?.error?.message || msg;
      } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    const b64 = data?.audioContent as string | undefined;
    if (!b64) throw new Error('TTS 응답에 audioContent가 없습니다.');
    return `data:audio/mp3;base64,${b64}`;
  };

  const handlePlayPreview = async () => {
    if (disabled) return;

    if (isPreviewPlaying) {
      stopPreview();
      return;
    }

    setPreviewError(null);

    try {
      if (scrollRef.current) lastScrollLeftRef.current = scrollRef.current.scrollLeft;

      const url = await synthesizePreviewMp3();

      stopPreview();

      const audio = new Audio(url);
      audioRef.current = audio;

      setIsPreviewPlaying(true);
      audio.onended = () => setIsPreviewPlaying(false);
      audio.onerror = () => {
        setIsPreviewPlaying(false);
        setPreviewError('미리듣기 재생 중 오류가 발생했습니다.');
      };

      await audio.play();
    } catch (e: any) {
      setIsPreviewPlaying(false);
      setPreviewError(e?.message || '미리듣기 생성 중 오류가 발생했습니다.');
    }
  };

  const VoiceButton = ({ voice }: { voice: VoiceItem }) => {
    const isSelected = String(selectedVoice) === voice.id;

    return (
      <button
        type="button"
        onClick={() => !disabled && onSelect(voice.id as unknown as VoiceName)}
        className={`
          flex-shrink-0 text-left rounded-lg border transition-all duration-200
          ${isSelected
            ? 'bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-400/10'
            : 'bg-[#141414] border-zinc-800 text-zinc-400 hover:border-zinc-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
        `}
        style={{
          width: 130,
          height: 54,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <div className="flex flex-col min-w-0">
          <span
            className={`text-[13px] font-black leading-tight truncate ${isSelected ? 'text-black' : 'text-zinc-100'}`}
            title={voice.label}
          >
            {voice.label}
          </span>
          <span className={`text-[10px] font-bold ${isSelected ? 'text-black/60' : 'text-zinc-600'}`}>
            {voice.gender}
          </span>
        </div>
      </button>
    );
  };

  return (
   <div className="bg-[#0a0a0a] pt-8 pb-6 px-6 rounded-[1.5rem] border border-zinc-800/50 space-y-6">

      {/* 헤더 + 속도 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Mic2 className="w-6 h-6 text-yellow-400" />
          <label className="text-[18px] font-black text-zinc-300 uppercase tracking-tighter">
            성우 선택
          </label>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border border-emerald-500/30 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            </span>
            <span className="text-[11px] font-black text-zinc-400 tracking-tighter uppercase">속도</span>
          </div>

          <span className="text-[11px] font-mono font-black text-emerald-500 w-[52px] text-right">
            {Number(voiceSpeed).toFixed(2)}x
          </span>

         <input
  type="range"
  min="0.5"
  max="2.0"
  step="0.1"
  value={voiceSpeed}
  onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
  className="w-[220px] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
  disabled={disabled}
/>

        </div>
      </div>

      {/* 성우 버튼 */}
<div
  ref={scrollRef}
  onScroll={handleScroll}
  className="overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]"
  style={{
    scrollbarWidth: 'thin',
    scrollbarColor: '#3f3f46 transparent'
  }}
>
        <div className="min-w-max space-y-3 pr-2">
          <div className="flex gap-2">
            {maleVoices.map(v => <VoiceButton key={v.id} voice={v} />)}
          </div>
          <div className="flex gap-2">
            {femaleVoices.map(v => <VoiceButton key={v.id} voice={v} />)}
          </div>
        </div>
      </div>

      {/* ✅ 실시간 미리듣기: 좌(BGM) / 우(미리듣기) 동일 높이, 우는 "상단=정보 / 하단=입력+재생" */}
      <div className="flex gap-3 items-stretch">
        {/* 높이 고정: 둘이 무조건 동일 */}
        <div className="h-[120px] flex-shrink-0">
          <BgmSelector
            variant="side"
            selectedBgm={selectedBgm}
            onSelect={onSelectBgm}
            volume={bgmVolume}
            onVolumeChange={onBgmVolumeChange}
            disabled={disabled}
          />
        </div>

        <div className="h-[120px] flex-1 bg-[#141414] rounded-xl border border-zinc-800/50 pt-4 pb-3 px-3 flex flex-col">

          {/* ✅ 상단: 실시간 미리듣기 정보 (폰트 살짝 키움) */}
        <div className="min-w-0 flex items-center gap-3 flex-wrap">
  <div className="text-[15px] font-black text-zinc-300 tracking-tighter uppercase">
    실시간 미리듣기
  </div>

  <div className="text-[12px] font-bold text-zinc-500 truncate">
    선택 성우: <span className="text-zinc-200">{selected.label}</span>
    <span className="text-zinc-700"> · </span>
    속도: <span className="text-emerald-400">{Number(voiceSpeed).toFixed(2)}x</span>
  </div>
</div>


          {/* ✅ 하단으로 밀기: 입력+재생이 박스 하단에 붙음 */}
         {/* ✅ 하단: 입력+재생 (박스 하단 고정, 정보랑 간격 확보) */}
<div className="mt-2 shrink-0">
  <div className="flex items-center gap-3">
    <input
      value={previewText}
      onChange={(e) => setPreviewText(e.target.value)}
      placeholder="미리듣기 문장을 입력하세요."
      disabled={disabled}
     className="
  flex-1 min-w-0 h-14 px-3 rounded-xl
  bg-[#0a0a0a] border border-zinc-800
  text-zinc-100 placeholder:text-zinc-600
  outline-none focus:border-zinc-700
"
    />

    <button
      type="button"
      onClick={handlePlayPreview}
      disabled={disabled}
      className={`
        flex-shrink-0 h-11 px-4 rounded-xl font-black text-sm flex items-center gap-2 transition-all
        ${isPreviewPlaying
          ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
          : 'bg-yellow-400 text-black'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}
      `}
      title={isPreviewPlaying ? '정지' : '재생'}
    >
      {isPreviewPlaying ? <StopCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
      <span>{isPreviewPlaying ? '정지' : '재생'}</span>
    </button>
  </div>

  {/* 에러(한 줄만, 높이 튐 방지) */}
  <div className="h-[14px] mt-1">
    {previewError && (
      <div className="text-[11px] font-bold text-red-400 truncate" title={previewError}>
        {previewError}
      </div>
    )}
  </div>
</div>

        </div>
      </div>

    </div>
  );
};

export default VoiceSelector;
