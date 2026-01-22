import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import ScriptInput from './components/ScriptInput';
import StyleSelector from './components/StyleSelector';
import VoiceSelector from './components/VoiceSelector';
import BgmSelector from './components/BgmSelector';
import SceneCard from './components/SceneCard';
import VideoSettingsPanel from './components/VideoSettingsPanel';
import VideoExporter from './components/VideoExporter';
import AdvancedSettings from './components/AdvancedSettings';
import AssetLibrary from './components/AssetLibrary';
import { AppState, ArtStyle, Scene, SubtitleSize, SceneTimelineEntry, UserAsset, VoiceName } from './types';
import { analyzeScriptToScenes, generateSceneImage, generateSingleAudio, generateAudioBatch } from './services/geminiService';
import { Loader2, Sparkles, ChevronLeft, PlayCircle, StopCircle, CheckCircle2, Music, X, Monitor, Mic2, ImageIcon, Plus, Type, Wand2 } from 'lucide-react';
import JSZip from 'jszip';
import { Undo2, Redo2 } from 'lucide-react';
const API_KEY =
  typeof window !== "undefined"
    ? localStorage.getItem("GEMINI_API_KEY") || ""
    : "";

  const VOICE_LABEL_MAP: Record<string, string> = {
  // 여성
  Achernar: '아케르나르',
  Aoede: '아오이데',
  Autonoe: '아우토노에',
  Callirrhoe: '칼리로에',
  Despina: '데스피나',
  Erinome: '에리노메',
  Gacrux: '가크룩스',
  Kore: '코레',
  Laomedeia: '라오메데이아',
  Leda: '레다',
  Pulcherrima: '풀케리마',
  Sulafat: '술라파트',
  Vindemiatrix: '빈데미아트릭스',
  Zephyr: '제피르',

  // 남성
  Achird: '아키르드',
  Algenib: '알제니브',
  Algieba: '알기에바',
  Alnilam: '알닐람',
  Charon: '카론',
  Enceladus: '엔켈라두스',
  Fenrir: '펜릴',
  Iapetus: '이아페투스',
  Orus: '오러스',
  Puck: '퍽',
  Rasalgethi: '라살게티',
  Sadachbia: '사다크비아',
  Sadaltager: '사달타게르',
  Schedar: '셰다르',
  Umbriel: '엄브리엘',
  Zubenelgenubi: '주베넬게누비',
};


const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatSrtTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${hrs}:${mins}:${secs},${ms}`;
};




const formatAssetSubtitle = (
  text: string,
  subtitleSize: SubtitleSize
): string => {
  // 에셋 저장용: 줄바꿈 → 공백
  const normalized = text.replace(/\r?\n+/g, ' ').trim();

  // S 사이즈만 문장 단위 줄바꿈
  if (subtitleSize !== 'S') return normalized;

  // 10자 미만은 줄바꿈 금지
  if (normalized.length < 10) return normalized;

  return normalized
    .split(/(?<=[.!?])/)
    .map(s => s.trim())
    .filter(Boolean)
    .join('\n');
};


const SUBTITLE_RATIOS = {
  '16:9': { S: 0.03, M: 0.045, L: 0.055 },
  '9:16': { S: 0.05, M: 0.075, L: 0.09 }
};

const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  let pos = 0;
  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16);
  setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - pos - 4);
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numOfChan; channel++) {
      let sample = buffer.getChannelData(channel)[i];
      sample = Math.max(-1, Math.min(1, sample));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, sample, true); pos += 2;
    }
  }
  return bufferArray;
};

export const getBalancedLines = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  subtitleSize: SubtitleSize
): string[] => {

  if (!text) return [];

  const t = String(text)
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!t) return [];

const fullW = ctx.measureText(t).width;

const ONE_LINE_RATIO =
  subtitleSize === 'S' ? 0.85 :
  subtitleSize === 'M' ? 0.92 :
  0.98;

if (fullW <= maxWidth * ONE_LINE_RATIO) {
  return [t];
}


  // --- 무조건 2줄 ---
  const breaks: number[] = [];
 for (let i = 1; i < t.length; i++) {
  const prev = t[i - 1];
  const after = t.slice(i).trim();

  // ✅ 쉼표 뒤가 "명사 나열"이면 줄바꿈 금지
  const isListComma =
    prev === ',' &&
    (
      // 쉼표 뒤가 한 단어 명사 + 또 다른 쉼표가 남아있음
      /^[가-힣]+/.test(after) && after.includes(',')
    );

  if (
    (
      prev === ',' && !isListComma
    ) ||
    (
      prev === ' ' ||
      /[.!?…)\\]]/.test(prev)
    ) &&
    !/^[일이삼사오육칠팔구십]+$/.test(t.slice(0, i).trim()) &&
    !/(은|는|이|가|을|를|에|로|와|과|의)$/.test(t.slice(0, i).trim())
  ) {
    breaks.push(i);
  }
}


  // 끊을 데 없으면 가운데
  if (breaks.length === 0) {
    const mid = Math.floor(t.length / 2);
    return [
      t.slice(0, mid).trim(),
      t.slice(mid).trim()
    ];
  }

  // 가장 폭 차이가 적은 지점 선택 (Worker와 동일)
  let best: { a: string; b: string; diff: number } | null = null;

  for (const idx of breaks) {
    const a = t.slice(0, idx).trim();
    const b = t.slice(idx).trim();
    if (!a || !b) continue;

    const diff = Math.abs(
      ctx.measureText(a).width - ctx.measureText(b).width
    );
    if (!best || diff < best.diff) best = { a, b, diff };
  }

  if (best) return [best.a, best.b];

  const cut = breaks[Math.floor(breaks.length / 2)];
  return [
    t.slice(0, cut).trim(),
    t.slice(cut).trim()
  ];
};





/** ============================
 * ✅ 틱(클릭) 완화용 후처리 유틸
 * - 시작/끝 클릭: 5~10ms 페이드로 완화
 * - DC offset: 아주 미세한 틱/팝 완화
 * ============================ */
const removeDcOffsetInPlace = (buf: AudioBuffer) => {
  if (!buf || buf.numberOfChannels < 1) return;
  const ch0 = buf.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < ch0.length; i++) sum += ch0[i];
  const mean = sum / Math.max(1, ch0.length);
  if (!isFinite(mean) || Math.abs(mean) < 1e-6) return;
  for (let i = 0; i < ch0.length; i++) ch0[i] = ch0[i] - mean;
};

const applyFadeInOutInPlace = (buf: AudioBuffer, fadeMs = 8) => {
  if (!buf || buf.numberOfChannels < 1) return;
  const sr = buf.sampleRate;
  const n = buf.length;
  const fade = Math.min(Math.floor((fadeMs / 1000) * sr), Math.floor(n / 2));
  if (fade <= 1) return;

  const ch0 = buf.getChannelData(0);

  // fade-in
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    ch0[i] *= g;
  }

  // fade-out
  for (let i = 0; i < fade; i++) {
    const g = (fade - i) / fade;
    ch0[n - 1 - i] *= g;
  }
};

const postProcessSceneAudioInPlace = (buf: AudioBuffer | null | undefined) => {
  if (!buf) return;
  try {
    removeDcOffsetInPlace(buf);
    // ❌ 씬 단위 페이드 완전 제거 (crossfade 깨짐 원인)
  } catch {}
};


const trimSilenceInPlace = (
  buf: AudioBuffer,
  threshold = 0.0025,
  minSilenceMs = 0
) => {
  const ch = buf.getChannelData(0);
  const sr = buf.sampleRate;

  let start = 0;
  while (start < ch.length && Math.abs(ch[start]) < threshold) start++;

  let end = ch.length - 1;
  while (end > start && Math.abs(ch[end]) < threshold) end--;

  if (start >= end) return buf;

  const newLen = end - start + 1;
  const trimmed = new AudioContext({ sampleRate: sr }).createBuffer(1, newLen, sr);
  trimmed.getChannelData(0).set(ch.slice(start, end + 1));

  return trimmed;
};





// ✅ 타임라인에서 이미 0.3초 gap을 쓰고 있으므로, fullSpeechAudioBuffer에도 동일하게 넣어 싱크/클릭 문제 완화
const AUDIO_SR = 24000;
const SCENE_GAP_SECONDS = 0;
const SCENE_GAP_SAMPLES = Math.round(SCENE_GAP_SECONDS * AUDIO_SR);

const App: React.FC = () => {
    const API_KEY = useMemo(() => {
    return localStorage.getItem("GEMINI_API_KEY") || "";
  }, []);
    const [viewMode, setViewMode] = useState<'setup' | 'workspace'>('setup');
  const sceneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [previewWidth, setPreviewWidth] = useState(0);
  


  const [state, setState] = useState<AppState>({
    script: '', scenes: [], metadata: null, selectedStyle: ArtStyle.REALISTIC, selectedVoice: 'Achird',
    voiceSpeed: 1.0, voicePitch: 0.0,
    voiceStylePrompt: '신뢰감 있는 전문가 스타일.',
    bgmUrl: null, bgmVolume: 0.05,
    referenceImage: undefined, userAssets: [], isAnalyzing: false, error: null, characterPrompt: '', atmospherePrompt: '',
    videoSettings: { aspectRatio: '16:9', subtitleSize: 'S', subtitlePosition: 5, subtitleColor: '#FFFFFF', showSubtitleBox: true },
    skipInitialImageGen: false
  });

 

  

  const [isGenerating, setIsGenerating] = useState(false);
  const [isImageBatchRunningState, setIsImageBatchRunningState] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
const [activeBreathKey, setActiveBreathKey] = useState<string | null>(null);
const [breathEditText, setBreathEditText] = useState<string>("");
const [isBreathEditing, setIsBreathEditing] = useState<boolean>(false);
const breathEditTextRef = useRef<string>("");
const [isExporting, setIsExporting] = useState(false);
const [currentTime, setCurrentTime] = useState(0);
const [isZipping, setIsZipping] = useState(false);
const [zipProgress, setZipProgress] = useState(0);
const [exportProgress, setExportProgress] = useState(0);
const [isConfirmOpen, setIsConfirmOpen] = useState(false);
const [isVideoLoading, setIsVideoLoading] = useState(false);
const [statusLog, setStatusLog] = useState<string>("");
const audioCtxRef = useRef<AudioContext | null>(null);
const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
const requestRef = useRef<number>(0);
const isBatchRunning = useRef(false);
const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
const lastBgmUrlRef = useRef<string | null>(null);
const videoARef = useRef<HTMLVideoElement | null>(null);
const videoBRef = useRef<HTMLVideoElement | null>(null);
const [activeVideo, setActiveVideo] = useState<'A' | 'B'>('A');
const freezeOnEndRef = useRef(false);
const didInitSubtitlePositionRef = useRef(false);
const previewTimeRef = useRef(0); // ✅ 미리보기 실제 시간 기준 (렌더링/비디오용)
const playTokenRef = useRef(0);
const currentTimeRef = useRef(0);

  // ============================
// ✅ Undo/Redo (초기 생성 보호 포함)
// ============================
type SceneSnapshot = { scenes: Scene[] };
const MAX_HISTORY = 30;

const historyRef = useRef<SceneSnapshot[]>([]);
const redoRef = useRef<SceneSnapshot[]>([]);
const baselineReadyRef = useRef(false);     // ✅ 초기 생성(분석) 끝난 뒤부터 Undo 허용
const isInitialAutoGenRef = useRef(false);  // ✅ 초기 자동 생성 중에는 기록 금지

const [historyCount, setHistoryCount] = useState(0);
const [redoCount, setRedoCount] = useState(0);





// setState가 비동기라, "현재 state"를 읽기 위한 ref
const stateRef = useRef<AppState>(state);
useEffect(() => { stateRef.current = state; }, [state]);



const cloneScenes = (scenes: Scene[]) => scenes.map(s => ({ ...s }));

const getSnapshot = (): SceneSnapshot => {
  const st = stateRef.current;
  return { scenes: cloneScenes(st.scenes || []) };
};

const resetHistory = () => {
  historyRef.current = [];
  redoRef.current = [];
  setHistoryCount(0);
  setRedoCount(0);
};

const pushToHistory = () => {
  // ✅ 초기 분석 완료 전에는 기록 안 함
  if (!baselineReadyRef.current) return;

  const snap = getSnapshot();
  if (!snap.scenes || snap.scenes.length === 0) return;

  historyRef.current = [...historyRef.current, snap];

  if (historyRef.current.length > MAX_HISTORY) {
    historyRef.current = historyRef.current.slice(-MAX_HISTORY);
  }

  redoRef.current = [];
  setHistoryCount(historyRef.current.length);
  setRedoCount(0);
};


const undo = () => {
  if (historyRef.current.length === 0) return;
  if (isPlaying) stopPreview();

  const current = getSnapshot();
  const prev = historyRef.current[historyRef.current.length - 1];

  historyRef.current = historyRef.current.slice(0, -1);
  redoRef.current = [current, ...redoRef.current];

  setHistoryCount(historyRef.current.length);
  setRedoCount(redoRef.current.length);

  setState(p => ({ ...p, scenes: cloneScenes(prev.scenes) }));
};

const redo = () => {
  if (redoRef.current.length === 0) return;
  if (isPlaying) stopPreview();

  const current = getSnapshot();
  const next = redoRef.current[0];

  redoRef.current = redoRef.current.slice(1);
  historyRef.current = [...historyRef.current, current];

  setHistoryCount(historyRef.current.length);
  setRedoCount(redoRef.current.length);

  setState(p => ({ ...p, scenes: cloneScenes(next.scenes) }));
};
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (viewMode !== 'workspace') return;

    const tag = (document.activeElement?.tagName || '').toUpperCase();
    const isTyping =
      tag === 'TEXTAREA' ||
      tag === 'INPUT' ||
      (document.activeElement as any)?.isContentEditable;
    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [viewMode]);




  /** ✅ fullSpeechAudioBuffer: 타임라인 gap(0.3s)을 실제 버퍼에도 삽입 */
  const fullSpeechAudioBuffer = useMemo(() => {
    const spoken = state.scenes.filter(s => !s.isHeader);
    const hasAny = spoken.some(s => !!s.audioBuffer);
    if (!hasAny && spoken.length === 0) return null;

    const ctx = new AudioContext({ sampleRate: AUDIO_SR });

    // 총 샘플: (각 scene audio/estimate) + (scene 사이 gap)
    const totalSamples = spoken.reduce((acc, s, idx) => {
      const sceneSamples = s.audioBuffer
        ? s.audioBuffer.length
        : Math.round((s.estimatedDurationSeconds || 5) * AUDIO_SR);

      const gap = (idx < spoken.length - 1) ? SCENE_GAP_SAMPLES : 0;
      return acc + sceneSamples + gap;
    }, 0);

    if (totalSamples <= 0) return null;

    const finalBuffer = ctx.createBuffer(1, totalSamples, AUDIO_SR);
    const out = finalBuffer.getChannelData(0);

    let offset = 0;
    spoken.forEach((s, idx) => {
      const isLast = idx === spoken.length - 1;

            if (s.audioBuffer) {
        // 복사
        const src = s.audioBuffer.getChannelData(0);

        const start = offset;

        // 1) 오디오 원본 그대로 복사 (추가 페이드/크로스페이드 제거)
        out.set(src, start);

        offset += src.length;

      } else {
        offset += Math.round((s.estimatedDurationSeconds || 5) * AUDIO_SR);
      }


      // ✅ gap 삽입 (기본값 0이라 out.set 필요 없음)
      if (!isLast) offset += SCENE_GAP_SAMPLES;
    });
applyFadeInOutInPlace(finalBuffer, 12);
return finalBuffer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scenes]);

  const sceneTimeline: SceneTimelineEntry[] = useMemo(() => {
    let cumV = 0; let cumA = 0;
    const spokenCount = state.scenes.filter(s => !s.isHeader).length;
    let spokenIdx = 0;

    return state.scenes.map((s) => {
      let dur = s.isHeader ? 0.001 : (s.audioBuffer?.duration ?? s.estimatedDurationSeconds ?? 5.0);

      // ✅ 영상/자막 타임라인에서도 gap을 준다
      if (!s.isHeader) {
        spokenIdx++;
        if (spokenIdx < spokenCount) {
          dur += SCENE_GAP_SECONDS;
        }
      }

      const entry: SceneTimelineEntry = {
        start: cumV,
        end: cumV + dur,
        scene: s,
        duration: dur,
        audioOffsetInFullBuffer: s.isHeader ? undefined : cumA
      };

      cumV += dur;
      if (!s.isHeader) cumA += dur;
      return entry;
    });
  }, [state.scenes]);

  const stats = useMemo(() => {
  const spoken = state.scenes.filter(s => !s.isHeader);

  const hasError = spoken.some(s => s.status === 'error');
  const hasMissingImage = spoken.some(
    s => !s.imageUrl || s.imageUrl.startsWith('data:image/svg')
  );

  const totalItems = spoken.length * 2;

  const completedItems = spoken.reduce((acc, s) => {
    let count = 0;
    if (s.audioBuffer) count++;

    // ❗ 실패한 이미지는 절대 완료로 치지 않음
    if (
      s.imageUrl &&
      !s.imageUrl.startsWith('data:image/svg') &&
      s.status !== 'error'
    ) {
      count++;
    }

    return acc + count;
  }, 0);

  const progress =
    totalItems === 0 ? 0 : Math.floor((completedItems / totalItems) * 100);

  const isAllReady =
    progress === 100 &&
    spoken.length > 0 &&
    !hasError &&
    !hasMissingImage;

  return {
    progress,
    isAllReady,
    readyAudio: spoken.filter(s => s.audioBuffer).length,
    failed: spoken.filter(s => s.status === 'error').length,
    hasMissingImage,
    hasError
  };
}, [state.scenes]);


  const totalDuration = useMemo(() => sceneTimeline.length ? sceneTimeline[sceneTimeline.length - 1].end : 0, [sceneTimeline]);
  const currentTimelineEntry = useMemo(() => {
  // 1️⃣ 정상 재생 중
  const active = sceneTimeline.find(e =>
    !e.scene.isHeader &&
    currentTime >= e.start &&
    currentTime < e.end
  );
  if (active) return active;

  // 2️⃣ 재생 끝에 도달한 경우 → 마지막 씬 유지
  if (currentTime >= totalDuration && sceneTimeline.length > 0) {
    return [...sceneTimeline]
      .reverse()
      .find(e => !e.scene.isHeader);
  }

  // 3️⃣ 그 외 (초기 상태 등)
  return sceneTimeline.find(e => !e.scene.isHeader);
}, [sceneTimeline, currentTime, totalDuration]);

  const currentScene = currentTimelineEntry?.scene;

const lastAutoScrollSceneIdRef = useRef<string | null>(null);

useEffect(() => {
  if (viewMode !== 'workspace') return;
  if (!currentScene?.id) return;

  if (lastAutoScrollSceneIdRef.current === currentScene.id) return;
  lastAutoScrollSceneIdRef.current = currentScene.id;

  const el = sceneRefs.current[currentScene.id];
  if (!el) return;

  el.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}, [viewMode, currentScene?.id]);


  const currentZoomScale = useMemo(() => {
  if (!currentTimelineEntry) return 1.0;

  const sceneStart = currentTimelineEntry.start;
  const sceneEnd = currentTimelineEntry.end;
  const sceneDuration = Math.max(0.001, sceneEnd - sceneStart);

  const elapsed = Math.max(0, Math.min(sceneDuration, currentTime - sceneStart));
  const p = elapsed / sceneDuration; // 0~1

  const entryIndex = sceneTimeline.indexOf(currentTimelineEntry);
  const isZoomOut = entryIndex % 2 !== 0;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  return isZoomOut
    ? lerp(1.2, 1.0, p)
    : lerp(1.0, 1.2, p);
}, [currentTimelineEntry, currentTime, sceneTimeline]);


  const currentHeader = useMemo(() => {
    let lastHeader = '';
    for (const entry of sceneTimeline) {
      if (entry.start <= currentTime) {
        if (entry.scene.isHeader) lastHeader = entry.scene.subtitle;
      } else break;
    }
    return lastHeader;
  }, [sceneTimeline, currentTime]);
useEffect(() => {
  if (viewMode !== 'workspace') return;

  const el = document.getElementById('preview-container');
  if (!el) return;

  const update = () => {
    const w = Math.floor(el.getBoundingClientRect().width);
    if (w > 0) setPreviewWidth(w);
  };

  update();

  const ro = new ResizeObserver(() => update());
  ro.observe(el);

  return () => ro.disconnect();
}, [viewMode, state.videoSettings.aspectRatio]);

const subtitleLines = useMemo(() => {
  if (!currentScene || currentScene.isHeader) return [];
  if (previewWidth <= 0) return [currentScene.subtitle];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const ratioConfig = SUBTITLE_RATIOS[state.videoSettings.aspectRatio as '16:9' | '9:16'];
  const M_ONLY_SCALE = 0.90;

  const base = previewWidth * ratioConfig[state.videoSettings.subtitleSize as SubtitleSize];
  const fontSize =
    state.videoSettings.subtitleSize === 'M'
      ? base * M_ONLY_SCALE
      : base;

  ctx.font = `900 ${fontSize}px "Noto Sans KR"`;

  const limitRatio = state.videoSettings.aspectRatio === '9:16' ? 0.90 : 0.95;
  const maxWidth = previewWidth * limitRatio;

  return getBalancedLines(ctx, currentScene.subtitle, maxWidth, state.videoSettings.subtitleSize);
}, [currentScene, previewWidth, state.videoSettings.subtitleSize, state.videoSettings.aspectRatio]);


useEffect(() => {
  const vid =
    activeVideo === 'A'
      ? videoARef.current
      : videoBRef.current;

  if (!vid) return;

  // 비디오 장면 아니면 멈추기
  if (currentScene?.userAssetType !== 'video') {
    try { vid.pause(); } catch {}
    return;
  }

  if (!currentTimelineEntry) return;

  const sceneDuration = currentTimelineEntry.end - currentTimelineEntry.start;
  if (sceneDuration <= 0) return;

  const applyRateAndMaybePlay = async () => {
    // 메타데이터/첫 프레임 로딩 전이면 duration이 NaN일 수 있으니 여기서 재확인
    if (isFinite(vid.duration) && vid.duration > 0) {
      const desired = vid.duration / sceneDuration;

      // ✅ 너무 느리게(0.25 같은 값) 늘리면 끊김이 심해짐 → 하한을 올림
      const rate = Math.max(0.5, Math.min(desired, 4.0));
      vid.playbackRate = rate;

      // ✅ “억지로 늘린 장면”(desired < 0.5)은 끝에서 멈춰 마지막 프레임 고정
      freezeOnEndRef.current = desired < 0.5;
    } else {
      // duration 아직 모르면 임시로 정상값
      vid.playbackRate = 1.0;
      freezeOnEndRef.current = false;
    }

    if (isPlaying) {
      try {
        await vid.play();
      } catch {}
    } else {
      try { vid.pause(); } catch {}
    }
  };

  // ✅ src가 바뀌면 readyState가 낮아질 수 있으므로 이벤트로 재시도
  const onLoadedMetadata = () => { applyRateAndMaybePlay(); };
  const onLoadedData = () => { applyRateAndMaybePlay(); };

  // ✅ 끝 프레임 고정 (desired < 0.5일 때만)
  const onTimeUpdate = () => {
    if (!freezeOnEndRef.current) return;
    if (!isFinite(vid.duration) || vid.duration <= 0) return;

    // 마지막 근처에서 정지 + 마지막 프레임 유지
    if (vid.currentTime >= vid.duration - 0.06) {
      try { vid.pause(); } catch {}
      try { vid.currentTime = Math.max(0, vid.duration - 0.04); } catch {}
    }
  };

  vid.addEventListener('loadedmetadata', onLoadedMetadata);
  vid.addEventListener('loadeddata', onLoadedData);
  vid.addEventListener('timeupdate', onTimeUpdate);

  // ✅ 즉시 한 번 시도 (이미 로드된 상태면 바로 적용)
  applyRateAndMaybePlay();

  return () => {
    vid.removeEventListener('loadedmetadata', onLoadedMetadata);
    vid.removeEventListener('loadeddata', onLoadedData);
    vid.removeEventListener('timeupdate', onTimeUpdate);
  };
}, [isPlaying, currentScene?.imageUrl, currentTimelineEntry, activeVideo]);

useEffect(() => {
  if (!currentScene) return;
  if (currentScene.userAssetType !== 'video') return;
  if (!currentScene.imageUrl) return;

  const nextVideo =
    activeVideo === 'A'
      ? videoBRef.current
      : videoARef.current;

  const currentVideo =
    activeVideo === 'A'
      ? videoARef.current
      : videoBRef.current;

  if (!nextVideo || !currentVideo) return;

  let cancelled = false;

  // 1️⃣ 다음 비디오 준비
  nextVideo.pause();
  nextVideo.src = currentScene.imageUrl;
  nextVideo.currentTime = 0;
  nextVideo.load();

  const onReady = async () => {
    if (cancelled) return;

    try {
      await nextVideo.play();
    } catch {}

    // 2️⃣ "첫 프레임이 실제로 그려질 때까지 대기"
    if ('requestVideoFrameCallback' in nextVideo) {
      (nextVideo as any).requestVideoFrameCallback(() => {
        if (cancelled) return;

        // 🔥 여기서만 스왑
        setActiveVideo(prev => (prev === 'A' ? 'B' : 'A'));

        try { currentVideo.pause(); } catch {}
      });
    } else {
      // fallback (구형 브라우저)
      requestAnimationFrame(() => {
        if (cancelled) return;
        setActiveVideo(prev => (prev === 'A' ? 'B' : 'A'));
        try { currentVideo.pause(); } catch {}
      });
    }
  };

  nextVideo.addEventListener('canplay', onReady, { once: true });

  return () => {
    cancelled = true;
    nextVideo.removeEventListener('canplay', onReady);
  };
}, [currentScene?.imageUrl]);





  useEffect(() => {
    if (state.bgmUrl) {
      if (state.bgmUrl !== lastBgmUrlRef.current) {
        if (bgmAudioRef.current) { bgmAudioRef.current.pause(); bgmAudioRef.current.src = ""; }
        bgmAudioRef.current = new Audio(state.bgmUrl);
        bgmAudioRef.current.loop = true;
        lastBgmUrlRef.current = state.bgmUrl;
      }
      if (bgmAudioRef.current) {
        bgmAudioRef.current.volume = state.bgmVolume;
        if (isPlaying && bgmAudioRef.current.paused) {
          const bgmDuration = bgmAudioRef.current.duration;
          if (bgmDuration > 0) bgmAudioRef.current.currentTime = currentTime % bgmDuration;
          bgmAudioRef.current.play().catch(() => {});
        } else if (!isPlaying && !bgmAudioRef.current.paused) {
          bgmAudioRef.current.pause();
        }
      }
    } else if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current = null;
      lastBgmUrlRef.current = null;
    }
  }, [state.bgmUrl, state.bgmVolume, isPlaying]);

  const updateSubtitle = (id: string, sub: string) => {
    setState(p => ({ ...p, scenes: p.scenes.map(sc => sc.id === id ? { ...sc, subtitle: sub } : sc) }));
  };
const updateBreathGroupSubtitle = (breathKey: string, text: string) => {
  const normalized = String(text ?? "")
    .replace(/\r/g, "")
    .trim();

  // 1) 편집창 텍스트 유지 (즉시 반영용 ref 포함)
  breathEditTextRef.current = normalized;
  setBreathEditText(normalized);

  // 2) 실제 화면 자막(Scene.subtitle)도 갱신
  setState(p => {
    const groupScenes = p.scenes.filter(
      s => !s.isHeader && String((s as any).breathId ?? "") === breathKey
    );

    if (groupScenes.length === 0) return p;

    const lines = normalized
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);

    // lines 수가 씬 수와 같으면 1:1로 배분, 아니면 전체를 동일하게 적용
    const usePerScene = lines.length === groupScenes.length;

    const idToText = new Map<string, string>();
    groupScenes.forEach((gs, idx) => {
      idToText.set(gs.id, usePerScene ? lines[idx] : normalized);
    });

    return {
      ...p,
      scenes: p.scenes.map(sc =>
        idToText.has(sc.id)
          ? { ...sc, subtitle: idToText.get(sc.id)! }
          : sc
      )
    };
  });
};



  const updateVisualPrompt = (id: string, vp: string) => {
    setState(p => ({ ...p, scenes: p.scenes.map(sc => sc.id === id ? { ...sc, visualPrompt: vp } : sc) }));
  };

  const processSingleAsset = async (sceneId: string, type: 'image' | 'audio') => {
  pushToHistory(); // ✅ 사용자 재생성 직전 기록
const audioCtx = new AudioContext({ sampleRate: AUDIO_SR });
try {

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  const targetScene = state.scenes.find(s => s.id === sceneId);
  if (!targetScene) return;

  setState(p => ({
    ...p,
    scenes: p.scenes.map(sc =>
      sc.id === sceneId ? { ...sc, status: 'generating' } : sc
    )
  }));

  if (type === 'audio') {
  if (!API_KEY) throw new Error("API 키 없음");

  let audioBuf = await generateSingleAudio(
    API_KEY,
    targetScene,
    state.selectedVoice,
    state.voiceSpeed,
    state.voicePitch,
    audioCtx
  );

audioBuf = trimSilenceInPlace(audioBuf);

  setState(p => ({
    ...p,
    scenes: p.scenes.map(sc =>
      sc.id === sceneId
        ? { ...sc, audioBuffer: audioBuf, status: 'completed' }
        : sc
    )
  }));
}

      
      
      
      else {

const imgUrl = await generateSceneImage(
  API_KEY!,
  targetScene.visualPrompt,
  state.selectedStyle,
  state.videoSettings.aspectRatio,
  state.referenceImage,
  state.characterPrompt,
  state.atmospherePrompt
);


        setState(p => ({
          ...p,
          scenes: p.scenes.map(sc => sc.id === sceneId ? {
            ...sc,
            imageUrl: imgUrl,
            status: 'completed',
            isUserAsset: false,
            userAssetType: 'image'
          } : sc)
        }));
      }
    } catch (e: any) {
      setState(p => ({ ...p, scenes: p.scenes.map(sc => sc.id === sceneId ? { ...sc, status: 'error', errorMessage: e.message } : sc) }));
    } finally {
      audioCtx.close();
    }
  };
const processBreathGroupAudio = async (breathKey: string) => {
  if (!API_KEY) return;

  const breathIdNum = Number(breathKey);
  if (!Number.isFinite(breathIdNum)) return;

  const targetScenes = stateRef.current.scenes.filter(
    s => !s.isHeader && String((s as any).breathId ?? "") === breathKey
  );

  if (targetScenes.length === 0) return;

  setState(p => ({
    ...p,
    scenes: p.scenes.map(sc =>
      targetScenes.some(t => t.id === sc.id)
        ? { ...sc, status: 'generating', errorMessage: undefined }
        : sc
    )
  }));

  const audioCtx = new AudioContext({ sampleRate: AUDIO_SR });

  try {
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (targetScenes.length === 0) return;

    const override = String(breathEditTextRef.current || "")
  .replace(/\r?\n+/g, " ")
  .replace(/\s+/g, " ")
  .trim();


    await generateAudioBatch(
      API_KEY!,
      targetScenes,
      stateRef.current.selectedVoice,
      stateRef.current.voiceSpeed,
      stateRef.current.voicePitch,
      audioCtx,
(id, buffer) => {
  setState(p => ({
          ...p,
          scenes: p.scenes.map(sc =>
            sc.id === id
              ? {
                  ...sc,
                  audioBuffer: buffer,
                  status: sc.imageUrl ? 'completed' : 'generating',
                  errorMessage: undefined
                }
              : sc
          )
        }));
      },
      (id, error) => {
        setState(p => ({
          ...p,
          scenes: p.scenes.map(sc =>
            sc.id === id ? { ...sc, status: 'error', errorMessage: error } : sc
          )
        }));
      },
      override
    );
  } finally {
    try { await audioCtx.close(); } catch {}
  }
};


const processFullBatch = async (type: 'image' | 'audio' | 'all' = 'all') => {
  
  if (isBatchRunning.current && type === 'all') return;
  if (isImageBatchRunningState && type === 'image') return;
  

  if (type === 'image') setIsImageBatchRunningState(true);

  isBatchRunning.current = true;
  setIsGenerating(true);
  setStatusLog(type === 'audio' ? "오디오 생성 중..." : "에셋 생성 중...");

  if (!API_KEY) throw new Error("API 키 없음");

  const audioCtx = new AudioContext({ sampleRate: AUDIO_SR });
  const processingImageIds = new Set<string>();

  try {
    const latestScenes = await new Promise<Scene[]>(r => setState(p => { r(p.scenes); return p; }));

   const audioPromise = (async () => {
  if (type === 'image') return;

  const pendingAudio = latestScenes.filter(s => !s.isHeader && !s.audioBuffer);
  if (pendingAudio.length === 0) return;

  // 🔴 핵심: 사용자 제스처 이후 AudioContext 강제 resume
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  await generateAudioBatch(
    API_KEY!,
    pendingAudio,
    state.selectedVoice,
    state.voiceSpeed,
    state.voicePitch,
    audioCtx,
    (id, buffer) => {
      postProcessSceneAudioInPlace(buffer);
      setState(p => ({
        ...p,
        scenes: p.scenes.map(sc => {
          if (sc.id !== id) return sc;
          return {
            ...sc,
            audioBuffer: buffer,
            status: sc.imageUrl ? 'completed' : 'generating',
            errorMessage: undefined
          };
        })
      }));
    },
    (id, error) => {
      setState(p => ({
        ...p,
        scenes: p.scenes.map(sc =>
          sc.id === id
            ? { ...sc, status: 'generating', errorMessage: error }
            : sc
        )
      }));
    }
  );
})();


    const imagePromise = Promise.all(Array(12).fill(null).map(async () => {
      if (type === 'audio') return;

      let safety = 0;

      while (true) {
        if (safety++ > 200) break;

        const currentScenes = await new Promise<Scene[]>(r => setState(p => { r(p.scenes); return p; }));
        const s = currentScenes.find(sc =>
          !sc.isHeader &&
          (!sc.imageUrl || sc.imageUrl.startsWith('data:image/svg')) &&
          !processingImageIds.has(sc.id)
        );

        if (!s) break;

        processingImageIds.add(s.id);
        
        setState(p => ({
  ...p,
  scenes: p.scenes.map(sc =>
    sc.id === s.id
      ? { ...sc, status: 'generating', errorMessage: undefined }
      : sc
  )
}));

try {
  const imgUrl = await generateSceneImage(
    API_KEY,
    s.visualPrompt,
    state.selectedStyle,
    state.videoSettings.aspectRatio,
    state.referenceImage,
    state.characterPrompt,
    state.atmospherePrompt
  );

  setState(p => ({
    ...p,
    scenes: p.scenes.map(sc => {
      if (sc.id !== s.id) return sc;
      return {
        ...sc,
        imageUrl: imgUrl,
        status: sc.audioBuffer ? 'completed' : 'generating',
        errorMessage: undefined
      };
    })
  }));
} catch (e: any) {
  // ❌ 즉시 error로 박지 않음
  setState(p => ({
    ...p,
    scenes: p.scenes.map(sc =>
      sc.id === s.id
        ? { ...sc, status: 'generating', errorMessage: e.message }
        : sc
    )
  }));
}

        finally {
          processingImageIds.delete(s.id);
        }
      }
    }));

    await Promise.all([audioPromise, imagePromise]);
  } finally {
    setIsGenerating(false);
    setIsImageBatchRunningState(false);
    isBatchRunning.current = false;
    setStatusLog("완료");
    audioCtx.close();
  }
};

const handleStartAnalysis = async () => {
  setIsConfirmOpen(false);
  setState(p => ({ ...p, isAnalyzing: true }));

  try {
    const res = await analyzeScriptToScenes(
      API_KEY!,
      state.script,
      `${state.characterPrompt}. ${state.atmospherePrompt}`,
      state.videoSettings.subtitleSize,
      state.videoSettings.aspectRatio
    );

    let expandedAssets: UserAsset[] = [];
    if (!state.skipInitialImageGen) {
      state.userAssets.forEach(asset => expandedAssets.push(asset));
    }
    expandedAssets.sort(() => Math.random() - 0.5);

    const processed = res.scenes.map(s => {
      if (s.isHeader) {
        return {
          ...s,
          status: 'completed' as const,
          visualPrompt: "소제목",
          imageUrl: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIi8+`
        };
      }
      return { ...s, status: 'pending' as const };
    });

    setState(p => ({
      ...p,
      scenes: processed,
      metadata: res.metadata,
      isAnalyzing: false
    }));

    setViewMode('workspace');
    window.scrollTo(0, 0);
// 🔥 미리보기 초기 상태 강제
previewTimeRef.current = 0;
currentTimeRef.current = 0; 
setCurrentTime(0);

// 🔥 첫 장면 선택 상태
requestAnimationFrame(() => {
  handleSeek(0);
});

    baselineReadyRef.current = true;
    resetHistory();

    isBatchRunning.current = false;
if (!state.skipInitialImageGen) {
  processFullBatch('image');
}

processFullBatch('audio');


  } catch (e: any) {
    setState(p => ({
      ...p,
      isAnalyzing: false,
      error: e?.message || "분석 실패"
    }));
  }
};






  const handleManualImageUpload = (
  id: string,
  base64: string,
  type: 'image' | 'video' = 'image'
) => {
  // ✅ 먼저 히스토리 기록
  pushToHistory();

  setState(p => ({
    ...p,
    scenes: p.scenes.map(s =>
      s.id === id
        ? {
            ...s,
            imageUrl: base64,
            status: 'completed',
            isUserAsset: true,
            userAssetType: type
          }
        : s
    )
  }));
};


const handleDownloadAllAssets = async () => {
  if (isZipping) return;
  setIsZipping(true);
  setZipProgress(0);

  const zip = new JSZip();
  const imagesFolder = zip.folder("images");
  const audioFolder = zip.folder("audio");
  const srtFolder = zip.folder("subtitles");
  const spokenScenes = state.scenes.filter(s => !s.isHeader);
  const total = spokenScenes.length;

  try {
    const srtEntries: string[] = [];
    let cursor = 0;

    for (let i = 0; i < total; i++) {
      const scene = spokenScenes[i];
      const sceneNum = (i + 1).toString().padStart(3, '0');

      if (!scene.audioBuffer) {
        setZipProgress(Math.round(((i + 1) / total) * 100));
        continue;
      }

      const duration = scene.audioBuffer.duration;
      const start = cursor;
      const end = cursor + duration;

      const assetSubtitle = formatAssetSubtitle(
        scene.subtitle,
        state.videoSettings.subtitleSize
      );

      // ✅ 전체 SRT용 엔트리만 누적 (씬별 SRT 저장은 하지 않음)
      srtEntries.push(
        `${i + 1}\n` +
        `${formatSrtTime(start)} --> ${formatSrtTime(end)}\n` +
        `${assetSubtitle}\n`
      );

      // ✅ 이미지/영상은 그대로 저장
      if (scene.imageUrl) {
        try {
          const res = await fetch(scene.imageUrl);
          const blob = await res.blob();
          const ext = scene.userAssetType === 'video' ? 'mp4' : 'png';
          imagesFolder?.file(`scene_${sceneNum}.${ext}`, blob);
        } catch {}
      }

      // ❌ 씬별 WAV 저장 제거 (통오디오만 저장할 것)
      // audioFolder?.file(
      //   `scene_${sceneNum}.wav`,
      //   audioBufferToWav(scene.audioBuffer)
      // );

      cursor = end;
      setZipProgress(Math.round(((i + 1) / total) * 100));
    }

    // ✅ 통 자막 1개만 저장
    srtFolder?.file(
      "full_subtitles.srt",
      srtEntries.join('\n')
    );

    // ✅ 통 오디오 1개만 저장 (fullSpeechAudioBuffer 사용)
    if (fullSpeechAudioBuffer) {
      audioFolder?.file(
        "full_audio.wav",
        audioBufferToWav(fullSpeechAudioBuffer)
      );
    }

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `${state.metadata?.title || 'assets'}_studio.zip`;
    a.click();
  } finally {
    setIsZipping(false);
    setZipProgress(0);
  }
};



 const stopPreview = () => {
  // ✅ 현재 재생 “세션” 무효화 (진짜 핵심)
  playTokenRef.current += 1;

  setIsPlaying(false);

  if (requestRef.current) {
    cancelAnimationFrame(requestRef.current);
    requestRef.current = 0;
  }

  // ✅ state(currentTime)는 한 프레임 늦을 수 있으니 ref 기준으로 고정
  previewTimeRef.current = currentTimeRef.current;

  if (audioSourceNodeRef.current) {
    try { audioSourceNodeRef.current.stop(); } catch {}
    audioSourceNodeRef.current = null;
  }

  if (bgmAudioRef.current) {
    try { bgmAudioRef.current.pause(); } catch {}
  }

  try {
    videoARef.current?.pause();
    videoBRef.current?.pause();
  } catch {}
};



  const startAudioAtTime = async (time: number) => {
    if (!fullSpeechAudioBuffer) return;

    if (audioSourceNodeRef.current) {
      try { audioSourceNodeRef.current.stop(); } catch {}
      audioSourceNodeRef.current = null;
    }

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: AUDIO_SR });
    }

if (audioCtxRef.current.state === 'suspended') {
  await audioCtxRef.current.resume();
}

    const currentEntry = sceneTimeline.find(e => time >= e.start && time < e.end);

    if (currentEntry && !currentEntry.scene.isHeader && currentEntry.audioOffsetInFullBuffer !== undefined) {
      const source = audioCtxRef.current.createBufferSource();
      source.buffer = fullSpeechAudioBuffer;

      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.value = 0.95;

      source.connect(gainNode);
      gainNode.connect(audioCtxRef.current.destination);

      const finalOffset = Math.max(0, currentEntry.audioOffsetInFullBuffer + (time - currentEntry.start));
      if (finalOffset < fullSpeechAudioBuffer.duration) {
        source.start(0, finalOffset);
        audioSourceNodeRef.current = source;
      }
    }

    if (bgmAudioRef.current && bgmAudioRef.current.readyState >= 2) {
      const bgmDuration = bgmAudioRef.current.duration;
      if (bgmDuration > 0) {
        bgmAudioRef.current.currentTime = time % bgmDuration;
        bgmAudioRef.current.play().catch(() => {});
      }
    }
  };
const togglePreview = async () => {
  if (stats.readyAudio === 0) return;

if (isPlaying) {
  stopPreview();

  // 🔥 오디오 편집 모드 강제 해제
  setIsBreathEditing(false);
  setActiveBreathKey(null);
  setBreathEditText("");
  breathEditTextRef.current = "";

  return;
}

  if (isBreathEditing) {
    setIsBreathEditing(false);
    setActiveBreathKey(null);
    setBreathEditText("");
    breathEditTextRef.current = "";
  }
 const startTime =
  currentTimeRef.current >= totalDuration - 0.1
    ? totalDuration
    : currentTimeRef.current;


  // ✅ 새 재생 세션 토큰 발급
  const myToken = (playTokenRef.current += 1);

  previewTimeRef.current = startTime;
  currentTimeRef.current = startTime;
  setCurrentTime(startTime);

  await startAudioAtTime(startTime);
  setIsPlaying(true);

  let last = performance.now();

  const frame = (now: number) => {
    // ✅ stopPreview()가 불리면 토큰이 바뀌므로 즉시 중단
    if (playTokenRef.current !== myToken) return;

    const dt = (now - last) / 1000;
    last = now;

    const nextTime = previewTimeRef.current + dt;
    previewTimeRef.current = nextTime;

    if (nextTime >= totalDuration) {
      previewTimeRef.current = totalDuration;
      currentTimeRef.current = totalDuration;
      setCurrentTime(totalDuration);
      stopPreview();
      return;
    }

    currentTimeRef.current = nextTime;
    setCurrentTime(nextTime);
    requestRef.current = requestAnimationFrame(frame);
  };

  requestRef.current = requestAnimationFrame(frame);
};

const deleteScene = (id: string) => {
  pushToHistory();

  const scenes = stateRef.current.scenes;
  const idx = scenes.findIndex(s => s.id === id);
  if (idx === -1) return;

  const nextScenes = scenes.filter(s => s.id !== id);

  setState(p => ({ ...p, scenes: nextScenes }));

  // 🔥 삭제 후 선택할 씬 계산 (바로 위, 없으면 아래)
  let nextIndex = idx - 1;
  if (nextIndex < 0) nextIndex = 0;
  if (nextIndex >= nextScenes.length) nextIndex = nextScenes.length - 1;

  const nextScene = nextScenes[nextIndex];

  if (nextScene) {
    const entry = sceneTimeline.find(e => e.scene.id === nextScene.id);
    if (entry) {
      previewTimeRef.current = entry.start;
      currentTimeRef.current = entry.start;
      setCurrentTime(entry.start);
    }
  }

  setIsBreathEditing(false);
  setActiveBreathKey(null);
  setBreathEditText("");
  breathEditTextRef.current = "";
};

const handleAddScene = () => {
  pushToHistory();

  const targetScene = currentScene || state.scenes[state.scenes.length - 1];
  if (!targetScene) return;

  const index = state.scenes.findIndex(s => s.id === targetScene.id);
  if (index === -1) return;

  const newScene: Scene = {
    id: `s-man-${Date.now()}`,
    visualGroupId: targetScene.visualGroupId || 'man',
    visualPrompt: '',
    subtitle: '새 장면 내용을 입력하세요.',
    status: 'pending',
    isHeader: false,
    estimatedDurationSeconds: 5
  };

  const newScenes = [...state.scenes];
  newScenes.splice(index + 1, 0, newScene);

  setState(p => ({ ...p, scenes: newScenes }));

  // 🔥 새로 만든 씬을 즉시 선택
  requestAnimationFrame(() => {
    const newIndex = index + 1;
    const t = sceneTimeline[newIndex]?.start ?? 0;
    handleSeek(t);
  });
};


const handleSeek = async (time: number) => {
  // 🔥 묶음 편집 강제 해제
  if (isBreathEditing) {
    setIsBreathEditing(false);
    setActiveBreathKey(null);
    setBreathEditText("");
    breathEditTextRef.current = "";
  }

  previewTimeRef.current = time;
  setIsBreathEditing(false);
setActiveBreathKey(null);
setBreathEditText("");
breathEditTextRef.current = "";
  currentTimeRef.current = time;
  setCurrentTime(time);
  setIsBreathEditing(false);

  if (isPlaying) {
    await startAudioAtTime(time);
  }
};






  const handleAddHeader = () => {
     pushToHistory(); 
    const targetScene = currentScene || state.scenes[state.scenes.length - 1];
    if (!targetScene) return;

    const index = state.scenes.findIndex(s => s.id === targetScene.id);
    if (index === -1) return;

    const newHeader: Scene = {
      id: `h-man-${Date.now()}`,
      visualGroupId: 'header',
      visualPrompt: '소제목',
      subtitle: '[새 소제목 입력]',
      status: 'completed',
      isHeader: true,
      imageUrl: `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+`
    };

    const newScenes = [...state.scenes];
    newScenes.splice(index + 1, 0, newHeader);
    setState(p => ({ ...p, scenes: newScenes }));
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col overflow-hidden">
      {viewMode === 'setup' ? (
        <>
          <Header />
          <div className="h-10 flex-shrink-0" />
       <main className="w-full mx-auto px-24 py-6 flex flex-col gap-4">




         {/* 🎛️ 영상 / 음성 설정 */}
<section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
  <VideoSettingsPanel
    settings={state.videoSettings}
    onChange={(u) => setState(p => ({ ...p, videoSettings: { ...p.videoSettings, ...u } }))}
    disabled={state.isAnalyzing}
  />

  <VoiceSelector
    selectedVoice={state.selectedVoice}
    onSelect={v => setState(p => ({ ...p, selectedVoice: v }))}
    voiceSpeed={state.voiceSpeed}
    onSpeedChange={s => setState(p => ({ ...p, voiceSpeed: s }))}
    voicePitch={state.voicePitch}
    onPitchChange={v => setState(p => ({ ...p, voicePitch: v }))}
    selectedBgm={state.bgmUrl}
    onSelectBgm={u => setState(p => ({ ...p, bgmUrl: u }))}
    bgmVolume={state.bgmVolume}
    onBgmVolumeChange={v => setState(p => ({ ...p, bgmVolume: v }))}
    disabled={state.isAnalyzing}
  />
</section>

{/* 🎨 스타일 / 참조 이미지 */}
<section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
  <StyleSelector
    selectedStyle={state.selectedStyle}
    onSelect={s => setState(p => ({ ...p, selectedStyle: s }))}
    referenceImage={state.referenceImage}
    onReferenceImageChange={img => setState(p => ({ ...p, referenceImage: img }))}
    disabled={state.isAnalyzing}
  />

  <AdvancedSettings
    characterPrompt={state.characterPrompt}
    onCharacterPromptChange={v => setState(p => ({ ...p, characterPrompt: v }))}
    atmospherePrompt={state.atmospherePrompt}
    onAtmospherePromptChange={v => setState(p => ({ ...p, atmospherePrompt: v }))}
    disabled={state.isAnalyzing}
  />
</section>

{/* 📦 사용자 에셋 */}
<section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-6">
  <AssetLibrary
    assets={state.userAssets}
    onAssetsChange={a => setState(p => ({ ...p, userAssets: a }))}
    skipInitialImageGen={state.skipInitialImageGen}
    onSkipInitialImageGenChange={v => setState(p => ({ ...p, skipInitialImageGen: v }))}
    disabled={state.isAnalyzing}
  />
</section>

           <section className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 pointer-events-auto">

<ScriptInput
  value={state.script}
  onChange={(t) => setState(p => ({ ...p, script: t }))}
  disabled={state.isAnalyzing}
  mode="script"
  onModeChange={() => {}}
  speed={state.voiceSpeed}
/>

         <button
  type="button"
  disabled={state.isAnalyzing}
  onClick={() => setIsConfirmOpen(true)}
  className={`w-full mt-6 h-16 rounded-xl font-black text-2xl flex items-center justify-center gap-3 shadow-xl transition-all ${
    state.isAnalyzing
      ? "bg-yellow-400 text-black cursor-wait"
      : "bg-yellow-400 text-black active:scale-[0.98]"
  }`}
>
  {state.isAnalyzing ? (
    <>
      <Loader2 className="w-8 h-8 animate-spin" />
      <span>대본 분석중...</span>
    </>
  ) : (
    <>
      <Sparkles className="w-8 h-8" />
      <span>작업 시작하기</span>
    </>
  )}
</button>





            </section>
          </main>

          {/* 형님 요청: 최종 설정 확인창 UI 업데이트 */}
          {isConfirmOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-lg p-8 space-y-8 animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">최종 설정 확인</h3>
                  <button onClick={() => setIsConfirmOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 space-y-1">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Monitor className="w-3 h-3" /> 화면 비율
                    </span>
                    <p className="text-lg font-black text-yellow-400">{state.videoSettings.aspectRatio}</p>
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 space-y-1">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Mic2 className="w-3 h-3" /> 선택한 성우
                    </span>
                    <p className="text-lg font-black text-emerald-400">
                      {VOICE_LABEL_MAP[state.selectedVoice] ?? state.selectedVoice}
                    </p>
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 space-y-1">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Music className="w-3 h-3" /> 사용자 에셋
                    </span>
                    <p className="text-lg font-black text-blue-400">{state.userAssets.length}개 업로드됨</p>
                  </div>

                  <div className="bg-black/40 p-4 rounded-2xl border border-zinc-800/50 space-y-1">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3" /> 참조 이미지
                    </span>
                    <p className="text-lg font-black text-rose-400">{state.referenceImage ? '사용 중' : '미사용'}</p>
                  </div>
                </div>

                <div className="bg-yellow-400/5 p-4 rounded-2xl border border-yellow-400/20 text-center">
                  <p className="text-sm text-yellow-400/80 font-bold leading-relaxed">
                    {state.skipInitialImageGen
                      ? "AI 생성 및 에셋 자동 배치를 생략하고, 오디오만 생성하여 시작합니다."
                      : "사용자 에셋 우선 배치 후 나머지는 AI가 자동 생성합니다."}
                  </p>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setIsConfirmOpen(false)} className="flex-1 py-4 rounded-2xl font-black text-zinc-500 hover:text-white transition-colors">
                    취소하기
                  </button>
                  <button
  onClick={handleStartAnalysis}
  disabled={state.isAnalyzing}
  className={`flex-[2] py-4 rounded-2xl font-black text-xl shadow-lg transition-all flex items-center justify-center gap-2 ${
    state.isAnalyzing
      ? "bg-zinc-600 text-zinc-300 cursor-not-allowed"
      : "bg-yellow-400 text-black active:scale-95"
  }`}
>
  {state.isAnalyzing ? (
    <>
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>대본 분석중...</span>
    </>
  ) : (
    <>
      <Sparkles className="w-5 h-5" />
      <span>지금 분석 시작</span>
    </>
  )}
</button>

                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="min-h-screen bg-black flex flex-col overflow-hidden">
              <header className="h-20 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4 overflow-hidden">
              <button
                onClick={() => window.location.href = "/"}
                className="flex items-center gap-2 hover:opacity-80"
              >
                <img src={import.meta.env.BASE_URL + "logo.png"} className="w-7 h-7" />
                <span className="font-black text-sm">노깡 STUDIO</span>
              </button>

              <button
                onClick={() => setViewMode('setup')}
                className="p-2 hover:bg-zinc-800 rounded-lg flex-shrink-0"
              >
                <ChevronLeft />
              </button>

              <h2 className="text-sm font-black text-zinc-400 truncate max-w-[200px] flex-shrink-0">
                {state.metadata?.title}
              </h2>

              <div className="h-10 border-l border-zinc-800 ml-2 pl-4 flex items-center flex-shrink-0">
                <BgmSelector
                  variant="compact"

                  selectedBgm={state.bgmUrl}
                  onSelect={u => setState(p => ({ ...p, bgmUrl: u }))}
                  volume={state.bgmVolume}
                  onVolumeChange={v => setState(p => ({ ...p, bgmVolume: v }))}
                  disabled={isGenerating}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
  onClick={undo}
  disabled={historyCount === 0}
  className={`p-2 rounded-lg border ${
    historyCount === 0
      ? 'border-zinc-800 opacity-30 cursor-not-allowed'
      : 'border-zinc-700 hover:bg-zinc-800'
  }`}
  title="뒤로가기 (Ctrl+Z)"
>
  <Undo2 className="w-4 h-4" />
</button>

<button
  onClick={redo}
  disabled={redoCount === 0}
  className={`p-2 rounded-lg border ${
    redoCount === 0
      ? 'border-zinc-800 opacity-30 cursor-not-allowed'
      : 'border-zinc-700 hover:bg-zinc-800'
  }`}
  title="앞으로가기 (Ctrl+Shift+Z)"
>
  <Redo2 className="w-4 h-4" />
</button>

              <button onClick={handleAddScene} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-[11px] font-black hover:bg-zinc-700 active:scale-95 flex items-center gap-1.5">
                <Plus className="w-3 h-3" />장면 추가
              </button>
              <button onClick={handleAddHeader} className="px-3 py-1.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-[11px] font-black hover:bg-zinc-700 active:scale-95 flex items-center gap-1.5">
                <Type className="w-3 h-3" />소제목 추가
              </button>
{(stats.hasMissingImage || stats.hasError) && (
  <button
    onClick={() => processFullBatch('image')}
    disabled={isImageBatchRunningState}
    className="px-3 py-1.5 bg-yellow-400 text-black rounded-lg text-[11px] font-black hover:bg-yellow-300 shadow-md flex items-center gap-1.5 active:scale-95"
  >

    {isImageBatchRunningState ? (
      <Loader2 className="w-3 h-3 animate-spin" />
    ) : (
      <Wand2 className="w-3 h-3" />
    )}
    빈 칸 채우기
  </button>
)}

              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                  {stats.isAllReady ? <CheckCircle2 className="text-emerald-500 w-3 h-3" /> : <Loader2 className="animate-spin text-yellow-400 w-3 h-3" />}
                  {stats.isAllReady ? "준비 완료" : `${stats.progress}%`}
                </span>
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${stats.progress}%` }} />
                </div>
              </div>
            </div>
          </header>

         <main className="flex-grow flex flex-col lg:flex-row p-6 gap-6 h-[calc(100vh-80px)] min-h-0">

           <div className="lg:w-1/2 flex flex-col gap-4 min-h-0">
              <div className="flex-grow flex items-center justify-center bg-zinc-950/30 rounded-3xl border border-zinc-800/50 p-4 min-h-0">
                <div
                  id="preview-container"
                  className="bg-black border border-zinc-800 rounded-2xl overflow-hidden relative shadow-2xl [container-type:inline-size]"
                  style={{
                    aspectRatio: state.videoSettings.aspectRatio === '16:9' ? '16/9' : '9/16',
                    maxHeight: '100%',
                    maxWidth: '100%',
                    height: state.videoSettings.aspectRatio === '9:16' ? '100%' : 'auto',
                    width: state.videoSettings.aspectRatio === '16:9' ? '100%' : 'auto'
                  }}
                >
          {currentScene?.imageUrl && currentScene.userAssetType === 'video' && (
  <>
 <video
  ref={videoARef}
  className="absolute inset-0 w-full h-full object-cover bg-transparent"
  muted
  playsInline
  preload="auto"
  style={{ opacity: activeVideo === 'A' ? 1 : 0 }}
/>

<video
  ref={videoBRef}
  className="absolute inset-0 w-full h-full object-cover bg-transparent"
  muted
  playsInline
  preload="auto"
  style={{ opacity: activeVideo === 'B' ? 1 : 0 }}
/>



  </>
)}


{currentScene?.imageUrl && currentScene.userAssetType !== 'video' && (
  <img
    src={currentScene.imageUrl}
    className="w-full h-full object-cover"
    style={{ transform: `scale(${currentZoomScale})` }}
  />
)}




                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-0">

                    {currentHeader && (
                      <div className="absolute top-[4%] left-0 right-0 text-center">
                        <span
                          className="px-3 py-1 text-white/90 font-black drop-shadow-lg"
                          style={{ fontSize: state.videoSettings.aspectRatio === '16:9' ? '2.8cqw' : '5.0cqw' }}
                        >
                          {currentHeader}
                        </span>
                      </div>
                    )}

                    {!currentScene?.isHeader && subtitleLines.length > 0 && (
                      <div
                        className="absolute left-0 right-0 px-[2.5%] text-center font-black flex flex-col items-center justify-end break-keep"
                        style={{
                          bottom: `${state.videoSettings.subtitlePosition}%`,
                        
                        }}
                      >
                       <div className="relative inline-block">
  {state.videoSettings.showSubtitleBox && (
    <div className="absolute inset-x-[-4%] inset-y-[-5%] bg-black/70 rounded-[2px] z-0" />
  )}
  <div className="relative z-10">
   {subtitleLines.map((line, idx) => {
  const ratioConfig = SUBTITLE_RATIOS[state.videoSettings.aspectRatio as '16:9' | '9:16'];
  const M_ONLY_SCALE = 0.90;

  const base = previewWidth > 0
    ? previewWidth * ratioConfig[state.videoSettings.subtitleSize as SubtitleSize]
    : 16;

  const fontSize =
    state.videoSettings.subtitleSize === 'M'
      ? base * M_ONLY_SCALE
      : base;

  return (
<span
  key={idx}
  className="block text-white"
  style={{
    fontSize: `${fontSize}px`,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
  }}
>
  {line}
</span>

  );
})}


                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4 flex-shrink-0">
               <button
  onClick={() => {
    setIsBreathEditing(false);
    setActiveBreathKey(null);
    setBreathEditText("");
    breathEditTextRef.current = "";
    togglePreview();
  }}
  className="p-4 rounded-full bg-yellow-400 text-black active:scale-90 transition-all"
>
                  {isPlaying ? <StopCircle /> : <PlayCircle />}
                </button>
                <input
                  type="range"
                  min="0"
                  max={totalDuration}
                  step="0.1"
                  value={currentTime}
                  onChange={e => handleSeek(parseFloat(e.target.value))}
                  className="flex-grow accent-yellow-400"
                />
                <span className="text-xs font-mono text-zinc-400">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
              </div>

             <div className="flex-shrink-0 relative z-50">
  <VideoExporter
    scenes={state.scenes}
    settings={state.videoSettings}
    bgmUrl={state.bgmUrl}
    bgmVolume={state.bgmVolume}
    metadata={state.metadata}
    disabled={isGenerating}
    fullSpeechAudioBuffer={fullSpeechAudioBuffer}
    sceneTimeline={sceneTimeline}
    assetStatus={stats.isAllReady ? 'ready' : 'pending'}
    isExporting={isExporting}
    setIsExporting={setIsExporting}
    onDownloadAllAssets={handleDownloadAllAssets}
    isZipping={isZipping}
    zipProgress={zipProgress}
    exportProgress={exportProgress}
    setExportProgress={setExportProgress}
  />
</div>

            </div>

<div
  className={`lg:w-1/2 flex flex-col gap-2 h-full pr-1 transition-all ${
    isExporting ? 'pointer-events-none relative z-0' : 'relative z-10'
  }`}
>




{(() => {
  // ✅ breathId 기준 그룹 만들기 (header는 별도)
  const breathGroups = new Map<string, Scene[]>();
  const headerGroups = new Map<string, Scene[]>();

  state.scenes.forEach(sc => {
    if (sc.isHeader) {
      headerGroups.set(`h-${sc.id}`, [sc]);
      return;
    }
    const key = String((sc as any).breathId ?? "");
    if (!breathGroups.has(key)) breathGroups.set(key, []);
    breathGroups.get(key)!.push(sc);
  });

  const renderedBreath = new Set<string>();

  // ✅ 화면에는 "원래 씬 순서"대로 렌더
  return state.scenes.map((s) => {
    // header
    if (s.isHeader) {
      const i = state.scenes.findIndex(x => x.id === s.id);
      return (
        <SceneCard
          key={s.id}
          ref={el => (sceneRefs.current[s.id] = el)}
          scene={s}
          index={i}
          metadata={state.metadata}
          getBreathKey={() => null}
          onDeleteScene={deleteScene}
          onRegenerateBreathGroup={(key) => {
            setActiveBreathKey(key);
            processBreathGroupAudio(key);
          }}
          onEnterAudioEditMode={(key) => {
  setActiveBreathKey(key);

  const groupScenes = state.scenes.filter(
    x => !x.isHeader && String((x as any).breathId) === key
  );

  // 이미 씬들이 동일한 자막으로 망가져 있으면 1개만 사용
  const unique = Array.from(new Set(groupScenes.map(s => s.subtitle.trim())));

  const groupText =
    unique.length === 1
      ? unique[0]
      : unique.join("\n");

  setBreathEditText(groupText);
  setIsBreathEditing(true);
}}

          onExitAudioEditMode={() => {
            setActiveBreathKey(null);
            setIsBreathEditing(false);
            setBreathEditText("");
          }}
          onRegenerateImage={(id, p) => {
            updateVisualPrompt(id, p || s.visualPrompt);
            processSingleAsset(id, "image");
          }}
          onUpdateSubtitle={updateSubtitle}
          onRegenerateAudio={(id, sub) => {
            updateSubtitle(id, sub || s.subtitle);
            processSingleAsset(id, "audio");
          }}
          onUpdateVisualPrompt={updateVisualPrompt}
          onClick={() => {
            setIsBreathEditing(false);
            setActiveBreathKey(null);
            setBreathEditText("");
            handleSeek(sceneTimeline[i].start);
          }}
          // ✅ 기본 상태에서만 개별 노란테두리
          isActive={!isBreathEditing && currentScene?.id === s.id}
          onRetry={(id) => processSingleAsset(id, "image")}
          onImageUpload={handleManualImageUpload}
          skipInitialImageGen={state.skipInitialImageGen}

          activeBreathKey={activeBreathKey}
          breathEditText={breathEditText}
          onBreathEditTextChange={(key, text) => setBreathEditText(text)}
          onUpdateBreathGroupSubtitle={updateBreathGroupSubtitle}
        />
      );
    }

    const breathKey = String((s as any).breathId ?? "");
    const isActiveBreath = isBreathEditing && activeBreathKey && breathKey === activeBreathKey;

    // ✅ 편집 모드가 아니면: 묶음 wrapper 없이 "씬 카드 1개"만
    if (!isBreathEditing) {
      const i = state.scenes.findIndex(x => x.id === s.id);
      return (
        <SceneCard
          key={s.id}
          ref={el => (sceneRefs.current[s.id] = el)}
          scene={s}
          index={i}
          metadata={state.metadata}
          getBreathKey={() => (!s.isHeader ? String((s as any).breathId ?? "") : null)}
          onDeleteScene={deleteScene}
          onRegenerateBreathGroup={(key) => {
            setActiveBreathKey(key);
            processBreathGroupAudio(key);
          }}
          onEnterAudioEditMode={(key) => {
  setActiveBreathKey(key);

  const groupScenes = state.scenes.filter(
    x => !x.isHeader && String((x as any).breathId) === key
  );

  // 이미 씬들이 동일한 자막으로 망가져 있으면 1개만 사용
  const unique = Array.from(new Set(groupScenes.map(s => s.subtitle.trim())));

  const groupText =
    unique.length === 1
      ? unique[0]
      : unique.join("\n");

  setBreathEditText(groupText);
  setIsBreathEditing(true);
}}

          onExitAudioEditMode={() => {
            setActiveBreathKey(null);
            setIsBreathEditing(false);
            setBreathEditText("");
          }}
          onRegenerateImage={(id, p) => {
            updateVisualPrompt(id, p || s.visualPrompt);
            processSingleAsset(id, "image");
          }}
          onUpdateSubtitle={updateSubtitle}
          onRegenerateAudio={(id, sub) => {
            updateSubtitle(id, sub || s.subtitle);
            processSingleAsset(id, "audio");
          }}
          onUpdateVisualPrompt={updateVisualPrompt}
          onClick={() => {
            setIsBreathEditing(false);
            setActiveBreathKey(null);
            setBreathEditText("");
            handleSeek(sceneTimeline[i].start);
          }}
          isActive={currentScene?.id === s.id}
          onRetry={(id) => processSingleAsset(id, "image")}
          onImageUpload={handleManualImageUpload}
          skipInitialImageGen={state.skipInitialImageGen}

          activeBreathKey={activeBreathKey}
          breathEditText={breathEditText}
          onBreathEditTextChange={(key, text) => setBreathEditText(text)}
          onUpdateBreathGroupSubtitle={updateBreathGroupSubtitle}
        />
      );
    }

    // ✅ 편집 모드일 때:
    // - activeBreathKey 묶음만 "큰 네모 wrapper"로 감싸서 1번만 렌더
    // - 나머지는 평소처럼 개별 씬 카드
    if (!isActiveBreath) {
      const i = state.scenes.findIndex(x => x.id === s.id);
      return (
        <SceneCard
          key={s.id}
          ref={el => (sceneRefs.current[s.id] = el)}
          scene={s}
          index={i}
          metadata={state.metadata}
          getBreathKey={() => (!s.isHeader ? String((s as any).breathId ?? "") : null)}
            onDeleteScene={deleteScene}
          onRegenerateBreathGroup={(key) => {
            setActiveBreathKey(key);
            processBreathGroupAudio(key);
          }}
          onEnterAudioEditMode={(key) => {
  setActiveBreathKey(key);

  const groupScenes = state.scenes.filter(
    x => !x.isHeader && String((x as any).breathId) === key
  );

  // 이미 씬들이 동일한 자막으로 망가져 있으면 1개만 사용
  const unique = Array.from(new Set(groupScenes.map(s => s.subtitle.trim())));

  const groupText =
    unique.length === 1
      ? unique[0]
      : unique.join("\n");

  setBreathEditText(groupText);
  setIsBreathEditing(true);
}}

          onExitAudioEditMode={() => {
            setActiveBreathKey(null);
            setIsBreathEditing(false);
            setBreathEditText("");
          }}
          onRegenerateImage={(id, p) => {
            updateVisualPrompt(id, p || s.visualPrompt);
            processSingleAsset(id, "image");
          }}
          onUpdateSubtitle={updateSubtitle}
          onRegenerateAudio={(id, sub) => {
            updateSubtitle(id, sub || s.subtitle);
            processSingleAsset(id, "audio");
          }}
          onUpdateVisualPrompt={updateVisualPrompt}
          onClick={() => {
  // 🔥 묶음 편집 완전 해제
  setIsBreathEditing(false);
  setActiveBreathKey(null);
  setBreathEditText("");
  breathEditTextRef.current = "";

  // 🔥 해당 씬만 활성화되도록 타임라인 이동
  const i2 = state.scenes.findIndex(x => x.id === s.id);
  handleSeek(sceneTimeline[i2].start);
}}

          // ✅ 편집 모드에서는 개별 노란테두리 금지
          isActive={false}
          onRetry={(id) => processSingleAsset(id, "image")}
          onImageUpload={handleManualImageUpload}
          skipInitialImageGen={state.skipInitialImageGen}

          activeBreathKey={activeBreathKey}
          breathEditText={breathEditText}
          onBreathEditTextChange={(key, text) => setBreathEditText(text)}
          onUpdateBreathGroupSubtitle={updateBreathGroupSubtitle}
        />
      );
    }

    // ✅ active 묶음 wrapper는 1번만
    if (renderedBreath.has(breathKey)) return null;
    renderedBreath.add(breathKey);

    const groupScenes = breathGroups.get(breathKey) ?? [];

    return (
      <div key={`breath-wrap-${breathKey}`} className="relative">
        {/* ✅ 레이아웃 안 밀리는 '오버레이 테두리' */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-yellow-400 z-10" />

        <div className="space-y-2">
          {groupScenes.map(gs => {
            const i = state.scenes.findIndex(x => x.id === gs.id);
            return (
              <SceneCard
                key={gs.id}
                ref={el => (sceneRefs.current[gs.id] = el)}
                scene={gs}
                index={i}
                metadata={state.metadata}
                getBreathKey={() => (!gs.isHeader ? String((gs as any).breathId ?? "") : null)}
                onDeleteScene={deleteScene}
                onRegenerateBreathGroup={(key) => {
                  setActiveBreathKey(key);
                  processBreathGroupAudio(key);
                }}
               onEnterAudioEditMode={(key) => {
  setActiveBreathKey(key);

  const groupScenes = state.scenes.filter(
    x => !x.isHeader && String((x as any).breathId) === key
  );

  // 이미 씬들이 동일한 자막으로 망가져 있으면 1개만 사용
  const unique = Array.from(new Set(groupScenes.map(s => s.subtitle.trim())));

  const groupText =
    unique.length === 1
      ? unique[0]
      : unique.join("\n");

  setBreathEditText(groupText);
  setIsBreathEditing(true);
}}

                onExitAudioEditMode={() => {
                  setActiveBreathKey(null);
                  setIsBreathEditing(false);
                  setBreathEditText("");
                }}
                onRegenerateImage={(id, p) => {
                  updateVisualPrompt(id, p || gs.visualPrompt);
                  processSingleAsset(id, "image");
                }}
                onUpdateSubtitle={updateSubtitle}
                onRegenerateAudio={(id, sub) => {
                  updateSubtitle(id, sub || gs.subtitle);
                  processSingleAsset(id, "audio");
                }}
                onUpdateVisualPrompt={updateVisualPrompt}
                onClick={() => {
                  // ✅ 편집 모드 유지 중 클릭은 씬 선택만(테두리는 묶음만)
                  handleSeek(sceneTimeline[i].start);
                }}
                // ✅ 편집 모드에서는 씬별 노란테두리 금지
                isActive={false}
                onRetry={(id) => processSingleAsset(id, "image")}
                onImageUpload={handleManualImageUpload}
                skipInitialImageGen={state.skipInitialImageGen}

                activeBreathKey={activeBreathKey}
                breathEditText={breathEditText}
                onBreathEditTextChange={(key, text) => setBreathEditText(text)}
                onUpdateBreathGroupSubtitle={updateBreathGroupSubtitle}
              />
            );
          })}
        </div>
      </div>
    );
  });
})()}




</div>


          </main>
        </div>
      )}
    </div>
  );
};

export default App;
