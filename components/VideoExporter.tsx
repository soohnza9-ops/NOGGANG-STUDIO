
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { VideoSettings, YouTubeMetadata, SceneTimelineEntry } from '../types';

import { Loader2, AlertCircle, Download, AlertTriangle, X } from 'lucide-react';
type ElectronExportAPI = {
 
  chooseExportDir: () => Promise<{ canceled: boolean; dirPath: string | null }>;

  exportBegin: (args: {
    width: number;
    height: number;
    fps: number;
    totalFrames: number;
    title: string;
    outputDir: string;
  }) => Promise<{ jobId: string }>;

  exportWriteFrame: (args: { jobId: string; frameIndex: number; pngBytes: Uint8Array }) => Promise<void>;
  exportWriteAudioWav: (args: { jobId: string; wavBytes: Uint8Array }) => Promise<void>;
  exportFinalize: (args: { jobId: string }) => Promise<{ outputPath: string }>;
  exportCancel: (args: { jobId: string }) => Promise<void>;
};


declare global {
  interface Window {
    NOGGANG_EXPORT?: ElectronExportAPI;
  }
}


const VideoExporter: React.FC<{

  settings: VideoSettings;
  bgmUrl: string | null;
  bgmVolume: number;
  metadata: YouTubeMetadata | null;
  disabled: boolean;
  fullSpeechAudioBuffer: AudioBuffer | null;
  sceneTimeline: SceneTimelineEntry[];
  assetStatus: 'ready' | 'pending';
  isExporting: boolean;
  setIsExporting: (v: boolean) => void;
  onDownloadAllAssets: () => void;
  isZipping: boolean;
  zipProgress: number;
  exportProgress: number;
  setExportProgress: (v: number) => void;
}> = ({
  settings,
  bgmUrl,
  bgmVolume,
  metadata,
  fullSpeechAudioBuffer,
  sceneTimeline,
  isExporting,
  setIsExporting,
  onDownloadAllAssets,
  isZipping,
  zipProgress,
  exportProgress,
  setExportProgress
}) => {


  const [showStopConfirm, setShowStopConfirm] = useState(false);
const exportingBtnWrapRef = useRef<HTMLDivElement | null>(null);
const [stopBtnPos, setStopBtnPos] = useState<{ top: number; left: number } | null>(null);
  const cancelRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);



useEffect(() => {
  if (!showStopConfirm) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = prev;
  };
}, [showStopConfirm]);
useLayoutEffect(() => {
if (!isExporting || showStopConfirm) {
     setStopBtnPos(null);
     return;
   }

   const update = () => {
     const el = exportingBtnWrapRef.current;
     if (!el) return;
         const r = el.getBoundingClientRect();
     setStopBtnPos({ top: r.top - 8, left: r.right - 8 });
   };

   update();
   window.addEventListener('resize', update);
  window.addEventListener('scroll', update, true);
   return () => {
     window.removeEventListener('resize', update);
     window.removeEventListener('scroll', update, true);
   };
 }, [isExporting, exportProgress]);
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const getBalancedLines = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    subtitleSize: 'S' | 'M' | 'L'
  ) => {
    if (!text) return [];
    const t = String(text)
      .replace(/\r/g, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!t) return [];

    const ONE_LINE_RATIO = subtitleSize === 'S' ? 0.85 : subtitleSize === 'M' ? 0.92 : 0.98;

    const fullW = ctx.measureText(t).width;
    if (fullW <= maxWidth * ONE_LINE_RATIO) return [t];

    const breaks: number[] = [];
    for (let i = 1; i < t.length; i++) {
      const prev = t[i - 1];
      if (prev === ' ' || /[,.!?…)\]]/.test(prev)) breaks.push(i);
    }

    if (breaks.length === 0) {
      const mid = Math.floor(t.length / 2);
      return [t.slice(0, mid).trim(), t.slice(mid).trim()];
    }

    let best: { a: string; b: string; diff: number } | null = null;
    for (const idx of breaks) {
      const a = t.slice(0, idx).trim();
      const b = t.slice(idx).trim();
      if (!a || !b) continue;
      const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
      if (!best || diff < best.diff) best = { a, b, diff };
    }
    if (best) return [best.a, best.b];

    const cut = breaks[Math.floor(breaks.length / 2)];
    return [t.slice(0, cut).trim(), t.slice(cut).trim()];
  };

  const fillRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    // @ts-ignore
    if (typeof (ctx as any).roundRect === 'function') (ctx as any).roundRect(x, y, w, h, radius);
    else {
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
    }
    ctx.closePath();
    ctx.fill();
  };

  const imgCacheRef = useRef<Map<string, ImageBitmap>>(new Map());
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoCanvasRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const getBitmapFromUrl = async (url: string) => {
    const cache = imgCacheRef.current;
    if (cache.has(url)) return cache.get(url)!;

    const r = await fetch(url, { cache: 'force-cache' });
    if (!r.ok) throw new Error('이미지 fetch 실패: ' + r.status);

    const blob = await r.blob();
    const bmp = await createImageBitmap(blob);
    cache.set(url, bmp);
    return bmp;
  };

  const ensureVideo = async (url: string) => {
    const cache = videoCacheRef.current;
    if (cache.has(url)) return cache.get(url)!;

    const vid = document.createElement('video');
    vid.crossOrigin = 'anonymous';
    vid.preload = 'auto';
    vid.muted = true;
    (vid as any).playsInline = true;
    vid.src = url;

    await new Promise<void>((res, rej) => {
      const onOk = () => {
        cleanup();
        res();
      };
      const onErr = () => {
        cleanup();
        rej(new Error('video load error'));
      };
      const cleanup = () => {
        vid.removeEventListener('loadedmetadata', onOk);
        vid.removeEventListener('error', onErr);
      };
      vid.addEventListener('loadedmetadata', onOk, { once: true });
      vid.addEventListener('error', onErr, { once: true });
      vid.load();
    });

    cache.set(url, vid);
    return vid;
  };

  const seekVideoTo = async (vid: HTMLVideoElement, targetTime: number) => {
    const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;
    const t = Math.max(0, Math.min(dur || 0, targetTime));
    if (!Number.isFinite(t)) return;

    const diff = Math.abs((vid.currentTime || 0) - t);
    if (diff < 0.01) return;

    await new Promise<void>((resolve) => {
      let done = false;

      const cleanup = () => {
        if (done) return;
        done = true;
        vid.removeEventListener('seeked', onSeeked);
        clearTimeout(to);
        resolve();
      };

      const onSeeked = () => cleanup();
      const to = window.setTimeout(() => cleanup(), 800);

      vid.addEventListener('seeked', onSeeked, { once: true });
      try {
        if (typeof (vid as any).fastSeek === 'function') (vid as any).fastSeek(t);
        else vid.currentTime = t;
      } catch {
        cleanup();
      }
    });
  };

  const getVideoBitmapAt = async (url: string, sceneStart: number, sceneEnd: number, t: number) => {
    const vid = await ensureVideo(url);

 const sceneDur = Math.max(0.001, sceneEnd - sceneStart);
const dur = Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 0;

// 장면 길이에 맞춰 "늘려서" 재생 (루프 ❌)
const elapsed = Math.max(0, t - sceneStart);
const ratio = dur > 0 ? Math.min(1, elapsed / sceneDur) : 0;
const target = dur * ratio;


    try {
      if (vid.readyState < 2) {
        await vid.play().catch(() => {});
        vid.pause();
      }
    } catch {}

    await seekVideoTo(vid, target);

    if (vid.readyState < 2 || vid.videoWidth <= 0 || vid.videoHeight <= 0) return null;

    const cMap = videoCanvasRef.current;
    let c = cMap.get(url);
    if (!c) {
      c = document.createElement('canvas');
      cMap.set(url, c);
    }
    c.width = vid.videoWidth;
    c.height = vid.videoHeight;

    const cctx = c.getContext('2d');
    if (!cctx) return null;

    cctx.drawImage(vid, 0, 0, c.width, c.height);
    const bmp = await createImageBitmap(c);
    return bmp;
  };

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const linearResample = (src: Float32Array, srcSR: number, dstSR: number) => {
    if (srcSR === dstSR) return src;
    const ratio = dstSR / srcSR;
    const dstLen = Math.max(1, Math.round(src.length * ratio));
    const dst = new Float32Array(dstLen);
    for (let i = 0; i < dstLen; i++) {
      const s = i / ratio;
      const i0 = Math.floor(s);
      const i1 = Math.min(i0 + 1, src.length - 1);
      const frac = s - i0;
      const a = src[i0] ?? 0;
      const b = src[i1] ?? 0;
      dst[i] = a * (1 - frac) + b * frac;
    }
    return dst;
  };

  const encodeWavMonoF32ToS16PCM = (samples: Float32Array, sampleRate: number) => {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');

    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);

    let o = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = clamp(samples[i], -1, 1);
      const v = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      view.setInt16(o, v, true);
      o += 2;
    }

    return new Uint8Array(buffer);
  };

  const mixSpeechAndBgmToWav = async (totalDuration: number) => {
    const dstSR = 48000;
    const totalSamples = Math.max(1, Math.round(totalDuration * dstSR));
    const out = new Float32Array(totalSamples);

    if (fullSpeechAudioBuffer) {
      const s0 = fullSpeechAudioBuffer.getChannelData(0);
      const speech = new Float32Array(s0.length);
      speech.set(s0);
      const sRes = linearResample(speech, fullSpeechAudioBuffer.sampleRate || 24000, dstSR);

      const n = Math.min(out.length, sRes.length);
      for (let i = 0; i < n; i++) out[i] += sRes[i] * 1.0;
    }

    if (bgmUrl) {
      try {
        const res = await fetch(bgmUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const tempCtx = new AudioContext();
          const decoded = await tempCtx.decodeAudioData(arrayBuf);

          const ch0 = decoded.getChannelData(0);
          const bgm = new Float32Array(ch0.length);
          bgm.set(ch0);

          const bRes = linearResample(bgm, decoded.sampleRate || 44100, dstSR);

          if (bRes.length > 0) {
            const fadeIn = dstSR * 1;
            const fadeOut = dstSR * 2;

            for (let i = 0; i < out.length; i++) {
              const bi = i % bRes.length;
              let vol = (bgmVolume || 0) * 2.05;
              if (i < fadeIn) vol *= i / fadeIn;
              if (i > out.length - fadeOut) vol *= (out.length - i) / fadeOut;
              out[i] += bRes[bi] * vol;
            }
          }

          tempCtx.close();
        }
      } catch {}
    }

    const limitT = 0.82;
    const ceiling = 0.99;
    for (let i = 0; i < out.length; i++) {
      let s = out[i];
      const absS = Math.abs(s);
      if (absS > limitT) {
        const over = absS - limitT;
        s = Math.sign(s) * (limitT + over / (1 + over * 2.5));
      }
      out[i] = clamp(s, -ceiling, ceiling);
    }

    return encodeWavMonoF32ToS16PCM(out, dstSR);
  };

  const drawCover = (
    ctx: CanvasRenderingContext2D,
    bmp: ImageBitmap,
    w: number,
    h: number,
    scale: number,
    doZoom: boolean
  ) => {
    const srcW = bmp.width;
    const srcH = bmp.height;

    const srcRatio = srcW / srcH;
    const dstRatio = w / h;

    const baseDW = srcRatio > dstRatio ? h * srcRatio : w;
    const baseDH = srcRatio > dstRatio ? h : w / srcRatio;

    const dW = doZoom ? baseDW * scale : baseDW;
    const dH = doZoom ? baseDH * scale : baseDH;

    const oX = (w - dW) / 2;
    const oY = (h - dH) / 2;

    ctx.drawImage(bmp, oX, oY, dW, dH);
  };

  const renderFrame = async (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    timeline: SceneTimelineEntry[],
    settings2: VideoSettings
  ) => {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    const entry = timeline.find((e) => !e.scene?.isHeader && t >= e.start && t < e.end) || timeline[0];

    const url = entry?.scene?.imageUrl || null;
    const isVideo = entry?.scene?.userAssetType === 'video';

    if (url && !url.startsWith('data:image/svg')) {
      if (isVideo) {
        const bmp = await getVideoBitmapAt(url, entry.start, entry.end, t);
        if (bmp) drawCover(ctx, bmp, w, h, 1, false);
      } else {
        const bmp = await getBitmapFromUrl(url);

        const sceneStart = entry.start;
        const sceneEnd = entry.end;
        const sceneDuration = Math.max(0.001, sceneEnd - sceneStart);
        const elapsed = Math.max(0, Math.min(sceneDuration, t - sceneStart));

        const sceneIndex = timeline.indexOf(entry);
        const isZoomOut = sceneIndex % 2 !== 0;

        const p = elapsed / sceneDuration;
        const lerp = (a: number, b: number, x: number) => a + (b - a) * x;

        const scale = isZoomOut ? lerp(1.2, 1.0, p) : lerp(1.0, 1.2, p);

        drawCover(ctx, bmp, w, h, scale, true);
      }
    }

    // 상단 헤더(누적)
    ctx.save();
    let activeHeader = '';
    for (const ent of timeline) {
      if (ent.start <= t && ent.scene?.isHeader) activeHeader = ent.scene.subtitle || '';
    }
    if (activeHeader) {
      const fs = w * 0.028;
      ctx.font = `900 ${fs}px 'Noto Sans KR', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(activeHeader.replace(/[\[\]]/g, ''), w / 2, h * 0.04);
    }

    // 하단 자막
    if (!entry?.scene?.isHeader) {
      const ratioMap =
        settings2.aspectRatio === '16:9'
          ? { S: 0.03, M: 0.045, L: 0.055 }
          : { S: 0.05, M: 0.075, L: 0.09 };

      const M_ONLY_SCALE = 0.9;
      const sizeRatio = ratioMap[settings2.subtitleSize];
      const subtitleScale = settings2.subtitleSize === 'M' ? M_ONLY_SCALE : 1.0;
      const baseFS = w * sizeRatio * subtitleScale;

      ctx.font = `900 ${baseFS}px 'Noto Sans KR', sans-serif`;
      ctx.textAlign = 'center';

      const limitRatio = settings2.aspectRatio === '9:16' ? 0.9 : 0.95;

  
      const maxTextWidth = w * limitRatio;

    // ✅ 장면에서 이미 확정된 줄바꿈 그대로 사용 (미리보기와 100% 동일)
// ✅ 미리보기와 동일한 줄 계산 로직 적용
const rawSubtitle = String(entry?.scene?.subtitle || '')
  .replace(/\r/g, '')
  .trim();

let lines: string[] = [];

if (rawSubtitle.includes('\n')) {
  // 이미 줄이 나뉜 경우: 각 줄을 다시 폭 기준으로 보정
  const parts = rawSubtitle.split('\n').map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const balanced = getBalancedLines(
      ctx,
      p,
      maxTextWidth,
      settings2.subtitleSize
    );
    lines.push(...balanced);
  }
} else {
  // 줄바꿈 없는 경우: 미리보기와 동일 계산
  lines = getBalancedLines(
    ctx,
    rawSubtitle,
    maxTextWidth,
    settings2.subtitleSize
  );
}



      const lineH = baseFS * 1.45;
      const textBlockH = lines.length * lineH;

      const padX = baseFS * 0.7;
      const padY = baseFS * 0.1;

      const bottomOffset = h * (settings2.subtitlePosition / 100);
      const BASELINE_FIX = baseFS * 0.55;

      const firstLineY =
        h -
        bottomOffset -
        (settings2.showSubtitleBox ? padY : 0) -
        (textBlockH - lineH) -
        BASELINE_FIX;

      if (settings2.showSubtitleBox && lines.length > 0) {
        let maxW = 0;
        for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);

        const boxW = maxW + padX * 2;
        const boxH = textBlockH + padY * 2;
        const boxX = (w - boxW) / 2;
        const boxTopY = firstLineY - lineH / 2 - padY;

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        const radius = baseFS * 0.2;
        fillRoundRect(ctx, boxX, boxTopY, boxW, boxH, radius);
      }

      ctx.fillStyle = 'white';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, firstLineY + i * lineH);
      }
    }

    ctx.restore();
  };

const handleStopExport = async () => {
  cancelRef.current = true;

  const jobId = jobIdRef.current;
  if (jobId && window.NOGGANG_EXPORT?.exportCancel) {
    try {
      await window.NOGGANG_EXPORT.exportCancel({ jobId });
    } catch {}
  }

  jobIdRef.current = null;

  setShowStopConfirm(false);
  setIsExporting(false);
  setExportProgress(0);
};




const handleExport = async () => {
  if (isExporting || !fullSpeechAudioBuffer) return;

  if (!window.NOGGANG_EXPORT) {
    alert('Electron으로 실행 중이 아닙니다.');
    return;
  }

  const picked = await window.NOGGANG_EXPORT.chooseExportDir();
  if (picked.canceled || !picked.dirPath) return;

  const outputDir = picked.dirPath;

  cancelRef.current = false;
  setIsExporting(true);
  setExportProgress(0);

  try {
    const [w, h] = settings.aspectRatio === '16:9' ? [1920, 1080] : [1080, 1920];

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트 생성 실패');

    const timelineEnd = sceneTimeline.length
      ? sceneTimeline[sceneTimeline.length - 1].end
      : 0;

    const speechDur =
      fullSpeechAudioBuffer.length /
      (fullSpeechAudioBuffer.sampleRate || 24000);

    const totalDuration = Math.max(timelineEnd, speechDur);

    const fps = 24;
    const totalFrames = Math.ceil(totalDuration * fps);

    const title = metadata?.title || 'video';

    const begin = await window.NOGGANG_EXPORT.exportBegin({
      width: w,
      height: h,
      fps,
      totalFrames,
      title,
      outputDir
    });

    jobIdRef.current = begin.jobId;

    const wavBytes = await mixSpeechAndBgmToWav(totalDuration);
    if (cancelRef.current) throw new Error('CANCELLED');

    await window.NOGGANG_EXPORT.exportWriteAudioWav({
      jobId: begin.jobId,
      wavBytes
    });

    for (let f = 0; f < totalFrames; f++) {
      if (cancelRef.current) break;

      const t = f / fps;
      await renderFrame(ctx, w, h, t, sceneTimeline, settings);

      const pngBytes = await new Promise<Uint8Array>((resolve, reject) => {
        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error('blob 실패'));
            const ab = await blob.arrayBuffer();
            resolve(new Uint8Array(ab));
          },
          'image/jpeg',
          0.92
        );
      });

      await window.NOGGANG_EXPORT.exportWriteFrame({
        jobId: begin.jobId,
        frameIndex: f,
        pngBytes
      });

      if (f % 10 === 0) {
        setExportProgress(Math.round((f / totalFrames) * 100));
        await sleep(0);
      }
    }

    setExportProgress(100);
    await window.NOGGANG_EXPORT.exportFinalize({ jobId: begin.jobId });
  } catch (e) {
    const jobId = jobIdRef.current;
    if (jobId) {
      try {
        await window.NOGGANG_EXPORT.exportCancel({ jobId });
      } catch {}
    }
  } finally {
    jobIdRef.current = null;
    cancelRef.current = false;
    setIsExporting(false);
  }
};




  const stopConfirmModal = showStopConfirm
    ? ReactDOM.createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-zinc-900 border border-red-500/30 rounded-[2.5rem] w-full max-w-md p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-white">비디오 제작 중단</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setShowStopConfirm(false)}
                className="flex-1 py-4 rounded-2xl font-black text-zinc-400 bg-zinc-800"
              >
                계속 제작
              </button>
              <button
                onClick={handleStopExport}
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black"
              >
                중단하기
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
{isExporting && !showStopConfirm ? (
  <div ref={exportingBtnWrapRef} className="relative w-2/3">
    <div className="w-full py-4 rounded-2xl font-black text-xl bg-yellow-400 text-black flex items-center justify-center gap-2 pointer-events-none">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>제작 중 ({exportProgress}%)</span>
    </div>
  </div>
) : (

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-2/3 py-4 rounded-2xl font-black text-xl bg-yellow-400 text-black shadow-lg"
            type="button"
          >
            비디오 추출
          </button>
        )}

        <button
          onClick={onDownloadAllAssets}
          className="w-1/3 py-4 rounded-2xl font-bold text-sm bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center justify-center gap-2"
          type="button"
        >
          {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{isZipping ? `${zipProgress}%` : '에셋 저장'}</span>
        </button>
      </div>

      {stopConfirmModal}
{isExporting && stopBtnPos && !showStopConfirm
  ? ReactDOM.createPortal(
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShowStopConfirm(true);
        }}
        type="button"
        style={{
          position: 'fixed',
          top: stopBtnPos.top,
          left: stopBtnPos.left,
          transform: 'translate(-100%, 0)',
          zIndex: 2147483647,
          pointerEvents: 'auto'
        }}
        className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg"
      >
        <X className="w-5 h-5" />
      </button>,
      document.body
    )
  : null}


  
    </div>
  );
};

export default VideoExporter;
