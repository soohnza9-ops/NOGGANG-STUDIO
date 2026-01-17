
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { Scene, ArtStyle, SubtitleSize, YouTubeMetadata, AspectRatio } from "../types";

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function uint8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

async function ensureSampleRate(
  buffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (!buffer) return buffer;
  if (buffer.sampleRate === targetSampleRate) return buffer;

  const numCh = buffer.numberOfChannels;
  const targetLength = Math.max(1, Math.round(buffer.duration * targetSampleRate));
  const offline = new OfflineAudioContext(numCh, targetLength, targetSampleRate);

  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start(0);

  return await offline.startRendering();
}

// ✅ TTS 텍스트 정화 (미리듣기 + 실제 생성 공통)
export function sanitizeForTTS(text: string): string {
  return text
    .replace(/['"]/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/,/g, ".")
    .replace(/\.([^\s])/g, ". $1")
    .replace(/\s+/g, " ")
    .trim();
}

export function convertToKoreanSpeech(text: string): string {
  const nativeMap: Record<number, string> = {
    1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯',
    6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열',
    11: '열한', 12: '열두', 13: '열세', 14: '열네',
    15: '열다섯', 16: '열여섯', 17: '열일곱',
    18: '열여덟', 19: '열아홉', 20: '스무'
  };

  const sinoMap = (n: number): string => {
    if (n === 0) return "영";
    const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    const units = ["", "십", "백", "천", "만"];
    let result = "";
    const str = n.toString();
    for (let i = 0; i < str.length; i++) {
      const num = parseInt(str[str.length - 1 - i]);
      if (num !== 0) {
        result = (num === 1 && i > 0 && i < 4 ? "" : digits[num]) + units[i] + result;
      }
    }
    return result;
  };

  const converted = text
    .replace(/(\d+)\s*(명|개|번|살|마리|권|장|벌|켤레|송이|그루|척|통|잔|병)/g,
      (_m, n, u) => {
        const num = parseInt(n);
        return (num <= 20 ? nativeMap[num] : sinoMap(num)) + " " + u;
      }
    )
    .replace(/(\d+)/g, (_m, n) => sinoMap(parseInt(n)));

  return sanitizeForTTS(converted);
}

export const preprocessForTTS = convertToKoreanSpeech;
/**
 * ✅ 클릭(틱) 제거용: AudioBuffer 앞/뒤 초단기 페이드 인/아웃
 */
export function applyEdgeFade(
  buffer: AudioBuffer,
  fadeMs: number = 8
): AudioBuffer {
  const sr = buffer.sampleRate;
  const fadeSamples = Math.max(1, Math.floor(sr * (fadeMs / 1000)));
  const length = buffer.length;

  const actualFade = Math.min(fadeSamples, Math.floor(length / 2));
  if (actualFade <= 0) return buffer;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);

    for (let i = 0; i < actualFade; i++) {
      const g = i / actualFade;
      data[i] *= g;
    }

    for (let i = 0; i < actualFade; i++) {
      const idx = length - actualFade + i;
      const g = (actualFade - i) / actualFade;
      data[idx] *= g;
    }
  }

  return buffer;
}

export async function applyMastering(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;

  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-18, offlineCtx.currentTime);
  compressor.knee.setValueAtTime(12, offlineCtx.currentTime);
  compressor.ratio.setValueAtTime(4, offlineCtx.currentTime);
  compressor.attack.setValueAtTime(0.003, offlineCtx.currentTime);
  compressor.release.setValueAtTime(0.25, offlineCtx.currentTime);

  const gain = offlineCtx.createGain();
  gain.gain.setValueAtTime(1.15, offlineCtx.currentTime);

  source.connect(compressor);
  compressor.connect(gain);
  gain.connect(offlineCtx.destination);

  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * ✅ 안전한 PCM(16-bit little endian) -> AudioBuffer 변환
 */
export async function decodePcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const safeLen = data.byteLength - (data.byteLength % 2);
  const pcm = data.buffer.slice(data.byteOffset, data.byteOffset + safeLen);
  const dataInt16 = new Int16Array(pcm);

  const frameCount = Math.floor(dataInt16.length / numChannels);
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, baseWait = 2000): Promise<T> => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === retries) throw error;
      await sleep(baseWait * Math.pow(1.5, attempt));
      attempt++;
    }
  }
  throw new Error("최대 재시도 실패");
};



export const isHeaderSubtitle = (subtitle: string): boolean => {
  const trimmed = subtitle.trim();
  return /^\[.*\]$/.test(trimmed) && trimmed.length < 100;
};

export const analyzeScriptToScenes = async (
  apiKey: string,
  script: string,
  combinedPrompt: string,
  subtitleSize: SubtitleSize,
  aspectRatio: AspectRatio
): Promise<{ scenes: Scene[], metadata: YouTubeMetadata }> => {
script = script.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  const ai = new GoogleGenAI({ apiKey });



  const MAX_RULE_RETRY = 1;
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_RULE_RETRY; attempt++) {
    try {
      const response: GenerateContentResponse = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `대본:\n${script}\n\n스타일: ${combinedPrompt}`,
          config: {
  responseMimeType: "application/json",
  responseSchema: {

              type: Type.OBJECT,
              properties: {
                metadata: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    storyContext: { type: Type.STRING }
                  },
                  required: ["title", "subject", "storyContext"]
                },
               visualPrompts: {
  type: Type.ARRAY,
  items: { type: Type.STRING }
}

              },
              required: ["metadata", "visualPrompts"]
            }
          }
        })
      );

      const text = response.text || "";
     const data = JSON.parse(text);


const sentences = script.match(/(\[[^\]]+\]|[^.!?]+[.!?])/g) || [];

const limits =
  aspectRatio === '9:16'
    ? subtitleSize === 'L'
      ? { min: 15, max: 20 }
      : subtitleSize === 'M'
        ? { min: 15, max: 30 }
        : { min: 20, max: 40 }
    : subtitleSize === 'L'
      ? { min: 22, max: 40 }
      : subtitleSize === 'M'
        ? { min: 27, max: 55 }
        : { min: 30, max: 80 };

const scenes: Scene[] = [];
let buf = "";

for (const s of sentences) {
  if (!buf) {
    buf = s;
    continue;
  }

  if ((buf + " " + s).length <= limits.max) {
    buf += " " + s;
  } else {
    scenes.push({
      id: "",
     subtitle: buf,
      visualPrompt: "",
      status: "pending",
      isHeader: isHeaderSubtitle(buf),
      syncOffset: 0
    });
    buf = s;
  }
}

if (buf) {
  scenes.push({
    id: "",
   subtitle: buf,
    visualPrompt: "",
    status: "pending",
    isHeader: isHeaderSubtitle(buf),
    syncOffset: 0
  });
}


   return {
  metadata: data.metadata,
  scenes: scenes.map((s, i) => ({
    ...s,
    id: `s-${Date.now()}-${i}`,
    visualPrompt: data.visualPrompts?.[i] ?? ""
  }))
};


      
      
    } catch (e: any) {
      lastError = e;
      // ✅ 다음 재시도 전에 짧게 대기(서버/레이트리밋/불안정 완화)
      await sleep(250 * attempt);
    }
  }

  throw lastError;
};



// ----------------------------
// ✅ TTS (Google Cloud Text-to-Speech) - MP3 방식 통일
// ----------------------------

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

const VOICE_MODEL_MAP: Record<string, string> = {
  // 여성
  Achernar: 'ko-KR-Chirp3-HD-Achernar',
  Aoede: 'ko-KR-Chirp3-HD-Aoede',
  Autonoe: 'ko-KR-Chirp3-HD-Autonoe',
  Callirrhoe: 'ko-KR-Chirp3-HD-Callirrhoe',
  Despina: 'ko-KR-Chirp3-HD-Despina',
  Erinome: 'ko-KR-Chirp3-HD-Erinome',
  Gacrux: 'ko-KR-Chirp3-HD-Gacrux',
  Kore: 'ko-KR-Chirp3-HD-Kore',
  Laomedeia: 'ko-KR-Chirp3-HD-Laomedeia',
  Leda: 'ko-KR-Chirp3-HD-Leda',
  Pulcherrima: 'ko-KR-Chirp3-HD-Pulcherrima',
  Sulafat: 'ko-KR-Chirp3-HD-Sulafat',
  Vindemiatrix: 'ko-KR-Chirp3-HD-Vindemiatrix',
  Zephyr: 'ko-KR-Chirp3-HD-Zephyr',

  // 남성
  Achird: 'ko-KR-Chirp3-HD-Achird',
  Algenib: 'ko-KR-Chirp3-HD-Algenib',
  Algieba: 'ko-KR-Chirp3-HD-Algieba',
  Alnilam: 'ko-KR-Chirp3-HD-Alnilam',
  Charon: 'ko-KR-Chirp3-HD-Charon',
  Enceladus: 'ko-KR-Chirp3-HD-Enceladus',
  Fenrir: 'ko-KR-Chirp3-HD-Fenrir',
  Iapetus: 'ko-KR-Chirp3-HD-Iapetus',
  Orus: 'ko-KR-Chirp3-HD-Orus',
  Puck: 'ko-KR-Chirp3-HD-Puck',
  Rasalgethi: 'ko-KR-Chirp3-HD-Rasalgethi',
  Sadachbia: 'ko-KR-Chirp3-HD-Sadachbia',
  Sadaltager: 'ko-KR-Chirp3-HD-Sadaltager',
  Schedar: 'ko-KR-Chirp3-HD-Schedar',
  Umbriel: 'ko-KR-Chirp3-HD-Umbriel',
  Zubenelgenubi: 'ko-KR-Chirp3-HD-Zubenelgenubi',
};

export const generateSingleAudio = async (
  apiKey: string,
  scene: Scene,
  voiceModelName: string,
  speed: number,
  pitch: number,
  ctx: AudioContext
): Promise<AudioBuffer> => {
  const resolvedVoice =
    (voiceModelName && voiceModelName.includes('ko-KR-'))
      ? voiceModelName
      : (VOICE_MODEL_MAP[voiceModelName] || voiceModelName);

  const isChirp3HD = resolvedVoice.includes('Chirp3-HD');

  const text = convertToKoreanSpeech(scene.subtitle);
  const safeRate = clamp(speed, 0.25, 4.0);

  const audioConfig: any = {
    audioEncoding: 'MP3',
    speakingRate: safeRate
  };

  if (!isChirp3HD) {
    audioConfig.pitch = clamp(pitch, -20, 20);
  }

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: 'ko-KR', name: resolvedVoice },
        audioConfig
      })
    }
  );

  if (!response.ok) {
    let msg = 'Unknown';
    try {
      const errData = await response.json();
      msg = errData?.error?.message || msg;
    } catch {
      // ignore
    }
    throw new Error(`TTS API Error: ${msg}`);
  }

  const result = await response.json();
  const audioBytes = decodeBase64(result.audioContent);

  // ✅ MP3 -> AudioBuffer
  const mp3Ab = uint8ToArrayBuffer(audioBytes);
  const decoded = await ctx.decodeAudioData(mp3Ab.slice(0));

  // ✅ 샘플레이트 24000으로 맞추기
  const srFixed = await ensureSampleRate(decoded, 24000);

  // ✅ 마스터링
  const mastered = await applyMastering(srFixed);

  // ✅ 클릭/틱 제거: 8ms
  applyEdgeFade(mastered, 8);

  return mastered;
};

export const generateAudioBatch = async (
  apiKey: string,
  scenes: Scene[],
  voiceName: string,
  speed: number,
  pitch: number,
  ctx: AudioContext,
  onProgress: (id: string, buffer: AudioBuffer) => void,
  onError: (id: string, error: string) => void
) => {
  const CONCURRENCY = 20;

  let index = 0;

  const worker = async () => {
    while (true) {
      const i = index++;
      if (i >= scenes.length) return;

      const scene = scenes[i];
      try {
      if (scene.isHeader) continue;

const buffer = await generateSingleAudio(
          apiKey,
          scene,
          voiceName,
          speed,
          pitch,
          ctx
        );

        onProgress(scene.id, buffer);
      } catch (e: any) {
        onError(scene.id, e?.message || String(e));
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, scenes.length) },
    () => worker()
  );

  await Promise.all(workers);
};
export const generateSceneImage = async (
  apiKey: string,
  prompt: string,
  style: ArtStyle,
  aspectRatio: string,
  referenceImage: string | undefined,
  characterPrompt: string,
  atmospherePrompt: string,
  storyContext: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });

  const baseTextPrompt = `
This is a single scene from a continuous story.
Story context: ${storyContext}
The main subject must remain consistent across all scenes.

Scene description:
${prompt}

Character details: ${characterPrompt}.
Atmosphere: ${atmospherePrompt}.

ABSOLUTELY NO TEXT.
NO LETTERS.
NO WORDS.
NO SYMBOLS.
NO LOGOS.
NO UI.
NO READABLE CHARACTERS OF ANY KIND.
`.trim();

  const base64 = referenceImage?.split(',')[1];

  const parts: any[] = referenceImage
    ? [
        {
          inlineData: {
            data: base64,
            mimeType: referenceImage.startsWith('data:image/jpeg')
              ? 'image/jpeg'
              : referenceImage.startsWith('data:image/webp')
              ? 'image/webp'
              : 'image/png'
          }
        },
        {
          text: `
THIS IMAGE IS THE ABSOLUTE VISUAL SOURCE OF TRUTH.

You MUST replicate:
- the exact art style
- the rendering technique
- the color palette
- the lighting and tone
- the character’s face, age, proportions, and identity

Do NOT reinterpret.
Do NOT stylize.
Do NOT change the art style.
Do NOT create a new character.

Any deviation is INVALID.

${baseTextPrompt}
          `.trim()
        }
      ]
    : [
        {
          text: `
Art style: ${style}.
${baseTextPrompt}
          `.trim()
        }
      ];

  const response: GenerateContentResponse = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        {
          role: 'user',
          parts
        }
      ],
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any
        }
      }
    })
  );

  const data =
    response.candidates?.[0]?.content?.parts.find((p: any) => p.inlineData)
      ?.inlineData?.data;

  if (!data) {
    throw new Error('Image generation failed: no image data returned');
  }

  return `data:image/png;base64,${data}`;
};

