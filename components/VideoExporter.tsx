// VideoExporter.tsx ✅ 전체 교체본 (Portal로 StopConfirm 고정 + Worker + OffscreenCanvas + WebCodecs + webm-muxer)
// - StopConfirm 모달을 createPortal(document.body)로 분리해서 "씬카드가 위로 올라와서 안눌림" 문제 해결
// - importScripts / CDN fetch / MediaRecorder / previewCanvasRef 제거
// - 워커는 module 타입 + esm.sh ESM import 사용

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Scene, VideoSettings, YouTubeMetadata, SceneTimelineEntry } from '../types';
import { Loader2, AlertCircle, Download, AlertTriangle, X } from 'lucide-react';

const VideoExporter: React.FC<{
  scenes: Scene[];
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
  scenes,
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
  const [error, setError] = useState<string | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const workerRef = useRef<Worker | null>(null);

// ❌ 아래 useEffect 블록 전체 제거
useEffect(() => {
  if (!showStopConfirm) return;
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {
    document.body.style.overflow = prev;
  };
}, [showStopConfirm]);


  const handleStopExport = () => {
    try {
      workerRef.current?.terminate();
    } catch {}
    workerRef.current = null;
    setIsExporting(false);
    setShowStopConfirm(false);
    setExportProgress(0);
    setError('사용자가 제작을 취소했습니다.');
  };

  const getWorkerCode = () => {
    return `
      import * as WebMMuxer from 'https://esm.sh/webm-muxer@3.0.1';

      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

      // ✅ 2줄 밸런스 분리 (중(M) 한줄로 화면 밖 문제 해결 핵심)
      const getBalancedLines = (ctx, text, maxWidth, subtitleSize) => {
        if (!text) return [];
        const t = String(text)
          .replace(/\\r/g, '')
          .replace(/[ \\t]{2,}/g, ' ')
          .replace(/\\s{2,}/g, ' ')
          .trim();
        if (!t) return [];

        // ✅ 사이즈별 1줄 허용 비율
        const ONE_LINE_RATIO =
          subtitleSize === 'S' ? 0.85 :
          subtitleSize === 'M' ? 0.92 :
          0.98;

        const fullW = ctx.measureText(t).width;
        if (fullW <= maxWidth * ONE_LINE_RATIO) {
          return [t];
        }

        const breaks = [];
        for (let i = 1; i < t.length; i++) {
          const prev = t[i - 1];
          if (prev === ' ' || /[,.!?…)\\]]/.test(prev)) {
            breaks.push(i);
          }
        }

        if (breaks.length === 0) {
          const mid = Math.floor(t.length / 2);
          return [
            t.slice(0, mid).trim(),
            t.slice(mid).trim()
          ];
        }

        let best = null;
        for (const idx of breaks) {
          const a = t.slice(0, idx).trim();
          const b = t.slice(idx).trim();
          if (!a || !b) continue;

          const diff = Math.abs(ctx.measureText(a).width - ctx.measureText(b).width);
          if (!best || diff < best.diff) best = { a, b, diff };
        }

        if (best) return [best.a, best.b];

        const cut = breaks[Math.floor(breaks.length / 2)];
        return [
          t.slice(0, cut).trim(),
          t.slice(cut).trim()
        ];
      };

      const fillRoundRect = (ctx, x, y, w, h, r) => {
        const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
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

      // ✅ 이미지 캐시 (URL → ImageBitmap 재사용)
      const __imgCache = new Map();

      async function getBitmapFromUrl(url) {
        if (!url) return null;

        if (__imgCache.has(url)) return __imgCache.get(url);

        const r = await fetch(url, { cache: 'force-cache' });
        if (!r.ok) throw new Error('이미지 fetch 실패: ' + r.status);

        const blob = await r.blob();
        const bmp = await createImageBitmap(blob);

        __imgCache.set(url, bmp);
        return bmp;
      }

      let frameResponse = null;
      let lastProvidedFrameIndex = -1;
      let lastGoodBitmap = null;
      let prevSceneId = null;

      self.onmessage = async (event) => {
        try {
          if (event?.data?.type === 'provide_frame') {
            const idx = Number(event.data?.payload?.frameIndex ?? -1);
            const bmp = event.data?.payload?.bitmap || null;

            frameResponse = bmp;
            lastProvidedFrameIndex = idx;
            return;
          }

          // ✅ 폰트 로드 (실패해도 진행)
          try {
            const font = new FontFace(
              'Noto Sans KR',
              'url(https://fonts.gstatic.com/s/notosanskr/v27/PbykFmXiEBPT4ITbgNA5CgmOelzI.woff2)',
              { weight: '900' }
            );
            await font.load();
            self.fonts.add(font);
          } catch {}

          if (!event?.data || event.data.type !== 'start') return;

          const payload = event.data.payload || {};
          const offscreenCanvas = payload.offscreenCanvas;

          if (!offscreenCanvas || typeof offscreenCanvas.getContext !== 'function') {
            throw new Error('offscreenCanvas가 워커로 전달되지 않았습니다. (OffscreenCanvas/transfer 미지원 또는 전달 실패)');
          }

          if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined' || typeof VideoFrame === 'undefined' || typeof AudioData === 'undefined') {
            throw new Error('WebCodecs 미지원 환경이라 비디오 추출이 불가합니다.');
          }

          const settings = payload.settings;
          const fullSpeechAudioRaw = payload.fullSpeechAudioRaw;
          const fullSpeechAudioSampleRate = payload.fullSpeechAudioSampleRate || 24000;

          const bgmAudioRaw = payload.bgmAudioRaw || null;
          const bgmAudioSampleRate = payload.bgmAudioSampleRate || 44100;
          const bgmVolume = payload.bgmVolume || 0;

          const sceneTimeline = payload.sceneTimeline || [];

          const ctx = offscreenCanvas.getContext('2d');

          const w = settings.aspectRatio === '16:9' ? 1920 : 1080;
          const h = settings.aspectRatio === '16:9' ? 1080 : 1920;

          const timelineEnd = sceneTimeline?.length ? sceneTimeline[sceneTimeline.length - 1].end : 0;
          const speechSamples = (fullSpeechAudioRaw ? (fullSpeechAudioRaw.byteLength / 4) : 0);
          const speechDuration = speechSamples / (fullSpeechAudioSampleRate || 24000);
          const totalDuration = Math.max(timelineEnd, speechDuration);

          if (sceneTimeline?.length) sceneTimeline[sceneTimeline.length - 1].end = totalDuration;

          const muxerLib = (WebMMuxer.default || WebMMuxer);
          const muxer = new muxerLib.Muxer({
            target: new muxerLib.ArrayBufferTarget(),
            video: { codec: 'V_VP8', width: w, height: h, frameRate: 30 },
            audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 1 }
          });

          const vEncoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: (e) => self.postMessage({ type: 'error', payload: { message: e?.message ? e.message : String(e) } })
          });
          vEncoder.configure({ codec: 'vp8', width: w, height: h, bitrate: 14_000_000 });

          const aEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (e) => self.postMessage({ type: 'error', payload: { message: e?.message ? e.message : String(e) } })
          });
          aEncoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 256_000 });

          // --------------------
          // ✅ 오디오 믹스
          // --------------------
          const finalMixedAudio = new Float32Array(Math.round(totalDuration * 48000));
          const speechData = fullSpeechAudioRaw ? new Float32Array(fullSpeechAudioRaw) : new Float32Array(0);
          const sRatio = 48000 / (fullSpeechAudioSampleRate || 24000);

          for (let i = 0; i < finalMixedAudio.length; i++) {
            const sIdx = i / sRatio;
            const i0 = Math.floor(sIdx);
            const i1 = Math.min(i0 + 1, Math.max(0, speechData.length - 1));
            if (i0 < speechData.length && speechData.length > 0) {
              const frac = sIdx - i0;
              finalMixedAudio[i] = (speechData[i0] * (1 - frac) + speechData[i1] * frac) * 1.0;
            } else {
              finalMixedAudio[i] = 0;
            }
          }

          if (bgmAudioRaw) {
            const bgmData = new Float32Array(bgmAudioRaw);
            const bRatio = 48000 / (bgmAudioSampleRate || 44100);

            for (let i = 0; i < finalMixedAudio.length; i++) {
              if (bgmData.length === 0) break;
              const bIdx = (i % Math.round(bgmData.length * bRatio)) / bRatio;
              const b0 = Math.floor(bIdx);
              const b1 = (b0 + 1) % bgmData.length;
              const frac = bIdx - b0;

              let vol = bgmVolume * 2.05;
              if (i < 48000) vol *= (i / 48000);
              if (i > finalMixedAudio.length - 96000) vol *= (finalMixedAudio.length - i) / 96000;

              finalMixedAudio[i] += (bgmData[b0] * (1 - frac) + bgmData[b1] * frac) * vol;
            }
          }

          const limitT = 0.82;
          const ceiling = 0.99;
          for (let i = 0; i < finalMixedAudio.length; i++) {
            let s = finalMixedAudio[i];
            const absS = Math.abs(s);
            if (absS > limitT) {
              const over = absS - limitT;
              s = Math.sign(s) * (limitT + (over / (1 + over * 2.5)));
            }
            finalMixedAudio[i] = Math.max(-ceiling, Math.min(ceiling, s));
          }

          const aData = new AudioData({
            format: 'f32',
            sampleRate: 48000,
            numberOfFrames: finalMixedAudio.length,
            numberOfChannels: 1,
            timestamp: 0,
            data: finalMixedAudio
          });
          aEncoder.encode(aData);
          aData.close();

          // --------------------
          // ✅ 비디오 프레임 루프
          // --------------------
          const fps = 30;
          const totalFrames = Math.ceil(totalDuration * fps);

          const ratioMap = settings.aspectRatio === '16:9'
            ? { S: 0.03, M: 0.045, L: 0.055 }
            : { S: 0.05, M: 0.075, L: 0.09 };

          const M_ONLY_SCALE = 0.90;
          const sizeRatio = ratioMap[settings.subtitleSize];
          const subtitleScale = (settings.subtitleSize === 'M') ? M_ONLY_SCALE : 1.0;
          const baseFS = w * sizeRatio * subtitleScale;

          for (let f = 0; f < totalFrames; f++) {
            if (f % 10 === 0) {
              self.postMessage({
                type: 'progress',
                payload: { percent: Math.round((f / totalFrames) * 100) }
              });
            }

            const t = f / fps;

            const entry =
              sceneTimeline.find(e => !e.scene?.isHeader && t >= e.start && t < e.end) ||
              sceneTimeline[0];

            // ✅ 장면 전환 감지 → 이전 프레임 캐시 제거
            if (f === 0 || (prevSceneId !== entry.scene.imageUrl)) {
              lastGoodBitmap = null;
            }
            prevSceneId = entry.scene.imageUrl;

            // ✅ 현재 엔트리
            const url = entry?.scene?.imageUrl || null;
            const isVideo = entry?.scene?.userAssetType === 'video';

           // ✅ 1) 비디오면: 메인 프레임 요청을 매 프레임이 아니라 "N프레임마다"만 수행 (UI 스크롤 프리징 방지)
if (isVideo) {
  const VIDEO_REQUEST_EVERY_N_FRAMES = 4; // ✅ 30fps 기준: 4면 7.5fps만 메인에서 공급(대부분 충분). 3~6 사이 취향.

  const shouldRequest =
    (f === 0) ||
    (prevSceneId !== entry.scene.imageUrl) ||
    (f % VIDEO_REQUEST_EVERY_N_FRAMES === 0) ||
    (!lastGoodBitmap); // 첫 프레임/전환/주기/캐시없음

  if (shouldRequest) {
    self.postMessage({
      type: 'request_frame',
      payload: { timestamp: t, frameIndex: f }
    });

    const waitStart = performance.now();
    while (
      lastProvidedFrameIndex < f &&
      (performance.now() - waitStart) < 350 // ✅ 1200 → 350: 너무 오래 기다리면 UI도 더 답답해짐
    ) {
      await sleep(1);
    }

    // 프레임 수신 처리
    if (frameResponse) {
      lastGoodBitmap = frameResponse;
      frameResponse = null;
    }
  }

  // 캔버스 클리어
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, h);

  // ✅ 요청 못받아도 lastGoodBitmap으로 계속 그려서 검정 깜빡임/프리징 완화
  const bmpToDraw = lastGoodBitmap || null;

  if (bmpToDraw) {
    const srcW = bmpToDraw.width;
    const srcH = bmpToDraw.height;

    const srcRatio = srcW / srcH;
    const dstRatio = w / h;

    let dW, dH, oX, oY;

    if (srcRatio > dstRatio) {
      dH = h;
      dW = h * srcRatio;
      oX = (w - dW) / 2;
      oY = 0;
    } else {
      dW = w;
      dH = w / srcRatio;
      oX = 0;
      oY = (h - dH) / 2;
    }

    ctx.drawImage(bmpToDraw, oX, oY, dW, dH);
  }
}

            // ✅ 2) 이미지면: 워커가 직접 fetch+캐시해서 그림 (메인 호출 없음)
            else {
              const bmp = url ? await getBitmapFromUrl(url) : null;

              if (bmp) {
                const sceneStart = entry.start;
                const sceneEnd = entry.end;
                const sceneDuration = Math.max(0.001, sceneEnd - sceneStart);
                const elapsed = Math.max(0, Math.min(sceneDuration, t - sceneStart));

                const sceneIndex = sceneTimeline.indexOf(entry);
                const isZoomOut = sceneIndex % 2 !== 0;

                const p = elapsed / sceneDuration;
                const lerp = (a, b, t) => a + (b - a) * t;

                const scale = isZoomOut
                  ? lerp(1.2, 1.0, p)
                  : lerp(1.0, 1.2, p);

                const srcW = bmp.width;
                const srcH = bmp.height;

                const srcRatio = srcW / srcH;
                const dstRatio = w / h;

                const baseDW = srcRatio > dstRatio ? h * srcRatio : w;
                const baseDH = srcRatio > dstRatio ? h : w / srcRatio;

                const dW = baseDW * scale;
                const dH = baseDH * scale;

                const oX = (w - dW) / 2;
                const oY = (h - dH) / 2;

                ctx.drawImage(bmp, oX, oY, dW, dH);
              }
            }

            // ✅ 상단 헤더(누적)
            ctx.save();
            let activeHeader = '';
            for (const ent of sceneTimeline) {
              if (ent.start <= t && ent.scene?.isHeader) activeHeader = ent.scene.subtitle || '';
            }
            if (activeHeader) {
              const fs = w * 0.028;
              ctx.font = "900 " + fs + "px 'Noto Sans KR', sans-serif";
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              ctx.fillText(activeHeader.replace(/[\\[\\]]/g, ''), w / 2, h * 0.04);
            }

            // ✅ 하단 자막
            if (!entry?.scene?.isHeader) {
              ctx.font = "900 " + baseFS + "px 'Noto Sans KR', sans-serif";
              ctx.textAlign = 'center';

              const limitRatio = (settings.aspectRatio === '9:16') ? 0.90 : 0.95;

              const cleanSubtitle = String(entry?.scene?.subtitle || '')
                .replace(/\\r?\\n+/g, ' ')
                .replace(/\\r/g, '')
                .replace(/\\s{2,}/g, ' ')
                .trim();

              const maxTextWidth = w * limitRatio;

              const lines =
                cleanSubtitle.length <= 6
                  ? [cleanSubtitle]
                  : getBalancedLines(ctx, cleanSubtitle, maxTextWidth, settings.subtitleSize);

              const lineH = baseFS * 1.45;
              const textBlockH = lines.length * lineH;

              const padX = baseFS * 0.7;
              const padY = baseFS * 0.10;

              const bottomOffset = h * (settings.subtitlePosition / 100);
              const BASELINE_FIX = baseFS * 0.55;

              const firstLineY =
                (h - bottomOffset)
                - (settings.showSubtitleBox ? padY : 0)
                - (textBlockH - lineH)
                - BASELINE_FIX;

              if (settings.showSubtitleBox && lines.length > 0) {
                let maxW = 0;
                lines.forEach(l => { maxW = Math.max(maxW, ctx.measureText(l).width); });
                const boxW = maxW + padX * 2;
                const boxH = textBlockH + padY * 2;
                const boxX = (w - boxW) / 2;
                const boxTopY = firstLineY - (lineH / 2) - padY;

                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                const radius = baseFS * 0.2;
                fillRoundRect(ctx, boxX, boxTopY, boxW, boxH, radius);
              }

              ctx.fillStyle = 'white';
              ctx.textBaseline = 'middle';
              lines.forEach((l, i) => ctx.fillText(l, w / 2, firstLineY + i * lineH));
            }

            ctx.restore();

            const vFrame = new VideoFrame(offscreenCanvas, { timestamp: Math.floor(t * 1_000_000) });
            vEncoder.encode(vFrame, { keyFrame: f % 30 === 0 });
            vFrame.close();

            if (vEncoder.encodeQueueSize > 10) await sleep(10);
          }

          await vEncoder.flush();
          await aEncoder.flush();
          muxer.finalize();

          self.postMessage({
            type: 'completed',
            payload: { blob: new Blob([muxer.target.buffer], { type: 'video/webm' }) }
          });
        } catch (e) {
          const msg = e?.message ? e.message : String(e);
          self.postMessage({ type: 'error', payload: { message: msg } });
        }
      };
    `;
  };

  const handleExport = async () => {
    if (isExporting || !fullSpeechAudioBuffer) return;

    setIsExporting(true);
    setError(null);
    setExportProgress(0);

    try {
      if (typeof (window as any).OffscreenCanvas === 'undefined') {
        throw new Error('이 브라우저는 OffscreenCanvas를 지원하지 않아 비디오 추출이 불가합니다. (Chrome 최신 권장)');
      }

      const workerBlob = new Blob([getWorkerCode()], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(workerBlob), { type: 'module' });
      workerRef.current = worker;

      worker.onerror = (e: any) => {
        console.error('[Worker onerror]', e);
        setError(`워커 에러: ${e?.message || e?.error?.message || 'unknown'}`);
        setIsExporting(false);
        try { worker.terminate(); } catch {}
        workerRef.current = null;
      };

      const [w, h] = settings.aspectRatio === '16:9' ? [1920, 1080] : [1080, 1920];
      const offscreen = new OffscreenCanvas(w, h);

      // ✅ 비디오 프리로드 (이미지는 워커/메인에서 fetch)
      const videoElements: Record<string, HTMLVideoElement> = {};
      const videoFrameCanvases: Record<string, HTMLCanvasElement> = {};
      const videoSeekLocks: Record<string, Promise<void> | null> = {};

      for (const scene of scenes) {
        if (!scene.imageUrl || scene.imageUrl.startsWith('data:image/svg')) continue;
        try {
          if (scene.userAssetType === 'video') {
            if (!videoElements[scene.imageUrl]) {
              const vid = document.createElement('video');
              vid.crossOrigin = 'anonymous';
              vid.preload = 'auto';
              vid.muted = true;
              (vid as any).playsInline = true;
              vid.src = scene.imageUrl;

              await new Promise<void>((res, rej) => {
                const onOk = () => { cleanup(); res(); };
                const onErr = () => { cleanup(); rej(new Error('video load error')); };
                const cleanup = () => {
                  vid.removeEventListener('loadedmetadata', onOk);
                  vid.removeEventListener('error', onErr);
                };
                vid.addEventListener('loadedmetadata', onOk, { once: true });
                vid.addEventListener('error', onErr, { once: true });
                vid.load();
              });

              videoElements[scene.imageUrl] = vid;
              videoSeekLocks[scene.imageUrl] = null;
            }
          }
        } catch (e) {
          console.error('Asset pre-loading error:', e);
        }
      }

      // ✅ BGM 디코드
      let bgmAudioRaw: ArrayBuffer | null = null;
      let bgmSR = 44100;

      if (bgmUrl) {
        try {
          const res = await fetch(bgmUrl);
          if (res.ok) {
            const arrayBuf = await res.arrayBuffer();
            const tempCtx = new AudioContext();
            const decoded = await tempCtx.decodeAudioData(arrayBuf);

            const ch0 = decoded.getChannelData(0);
            const copy = new Float32Array(ch0.length);
            copy.set(ch0);

            bgmAudioRaw = copy.buffer;
            bgmSR = decoded.sampleRate;

            tempCtx.close();
          }
        } catch {}
      }

      // ✅ TTS 오디오 복사(transfer)
      const rawAudio = fullSpeechAudioBuffer.getChannelData(0);
      const audioCopy = new Float32Array(rawAudio.length);
      audioCopy.set(rawAudio);

      const seekVideoTo = async (vid: HTMLVideoElement, targetTime: number) => {
        const t = Math.max(0, Math.min((Number.isFinite(vid.duration) ? vid.duration : 0) || 0, targetTime));
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

          const to = window.setTimeout(() => cleanup(), 250);

          vid.addEventListener('seeked', onSeeked, { once: true });
          try {
            // fastSeek 지원 브라우저면 우선 사용
            if (typeof (vid as any).fastSeek === 'function') (vid as any).fastSeek(t);
            else vid.currentTime = t;
          } catch {
            cleanup();
          }
        });
      };

      worker.onmessage = async (e) => {
        try {
          const { type, payload } = e.data || {};

          if (type === 'progress') {
            setExportProgress(payload.percent);
            return;
          }

          if (type === 'request_frame') {
            const { timestamp, frameIndex } = payload;

            const entry =
              sceneTimeline.find(ent => !ent.scene.isHeader && timestamp >= ent.start && timestamp < ent.end) ||
              sceneTimeline[0];

            let bitmap: ImageBitmap | null = null;

            const url = entry?.scene?.imageUrl;

            if (url) {
              if (entry.scene.userAssetType === 'video' && videoElements[url]) {
                const vid = videoElements[url];
// ✅ 씬 변경 감지 (URL ❌ / scene.start 기준)
if ((vid as any).__lastSceneStart !== entry.start) {
  (vid as any).__started = false;
  (vid as any).__lastSceneStart = entry.start;
}

                const sceneDuration = Math.max(0.001, entry.end - entry.start);
                const videoDuration =
                  Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 1;

               if (!(vid as any).__started) {
  vid.currentTime = 0;
 vid.loop = true;
vid.playbackRate = sceneDuration / videoDuration;
  await vid.play();
  (vid as any).__started = true;

  
}





                const prevLock = videoSeekLocks[url];
                const lock = (async () => {
                  if (prevLock) {
                    try { await prevLock; } catch {}
                  }
                 await new Promise<void>((resolve) => {
  vid.requestVideoFrameCallback(() => resolve());
});
                })();

                videoSeekLocks[url] = lock;
                await lock;

                if (vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
                  let c = videoFrameCanvases[url];
                  if (!c) {
                    c = document.createElement('canvas');
                    videoFrameCanvases[url] = c;
                  }
                  c.width = vid.videoWidth;
                  c.height = vid.videoHeight;

                  const ctx2d = c.getContext('2d');
                  if (ctx2d) {
                    ctx2d.drawImage(vid, 0, 0, c.width, c.height);
                    bitmap = await createImageBitmap(c);
                  }
                }
              }
            }

            worker.postMessage(
              { type: 'provide_frame', payload: { frameIndex, bitmap } },
              bitmap ? [bitmap] : []
            );

            return;
          }

          if (type === 'completed') {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(payload.blob);
            a.download = `${metadata?.title || 'video'}.webm`;
            a.click();
            setIsExporting(false);
            worker.terminate();
            workerRef.current = null;
            return;
          }

          if (type === 'error') {
            setError(payload.message);
            setIsExporting(false);
            worker.terminate();
            workerRef.current = null;
            return;
          }
        } catch (err) {
          console.error('[worker.onmessage fatal]', err);
          setError(String(err));
          setIsExporting(false);
          try { worker.terminate(); } catch {}
          workerRef.current = null;
        }
      };

      const transfer: Transferable[] = [offscreen, audioCopy.buffer];
      if (bgmAudioRaw) transfer.push(bgmAudioRaw);

      worker.postMessage(
        {
          type: 'start',
          payload: {
            offscreenCanvas: offscreen,
            settings,
            fullSpeechAudioRaw: audioCopy.buffer,
            fullSpeechAudioSampleRate: fullSpeechAudioBuffer.sampleRate,
            bgmAudioRaw,
            bgmAudioSampleRate: bgmSR,
            bgmVolume,
            sceneTimeline: sceneTimeline.map(e2 => ({
              start: e2.start,
              end: e2.end,
              scene: {
                subtitle: e2.scene.subtitle,
                imageUrl: e2.scene.imageUrl,
                isHeader: e2.scene.isHeader,
                userAssetType: e2.scene.userAssetType
              }
            }))
          }
        },
        transfer
      );
    } catch (err: any) {
      setError(err?.message || String(err));
      setIsExporting(false);
      try { workerRef.current?.terminate(); } catch {}
      workerRef.current = null;
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
        {isExporting ? (
          <div className="relative w-2/3 overflow-visible">
            <button
              disabled
              className="w-full py-4 rounded-2xl font-black text-xl bg-yellow-400 text-black flex items-center justify-center gap-2"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>제작 중 ({exportProgress}%)</span>
            </button>

            <button
              onClick={() => setShowStopConfirm(true)}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center z-[50]"
              type="button"
            >
              <X className="w-5 h-5" />
            </button>
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

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-900/50 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2 whitespace-pre-wrap">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
};

export default VideoExporter;
