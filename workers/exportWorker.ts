
import * as WebMMuxer from 'https://esm.sh/webm-muxer@3.0.1';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 추출 엔진용 줄바꿈 로직 (미리보기와 100% 동일)
const getBalancedLines = (ctx: any, text: string, maxWidth: number): string[] => {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

// 추출 엔진용 줄바꿈 로직 (미리보기와 100% 동일)
const getBalancedLines = (ctx: any, text: string, maxWidth: number): string[] => {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

// ✅✅✅ 여기부터 추가 (이 블록을 그대로 붙여넣기)
const fillRoundRect = (
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();

  const anyCtx: any = ctx as any;
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }
  ctx.closePath();
  ctx.fill();
};
// ✅✅✅ 여기까지 추가

self.onmessage = async (event) => {


self.onmessage = async (event) => {
    const { type, payload } = event.data;
    if (type === 'start') {
        const { offscreenCanvas, settings, loadedImages, fullSpeechAudioBuffer, fullSpeechAudioSampleRate, sceneTimeline } = payload;
        const ctx = offscreenCanvas.getContext('2d', { alpha: false, desynchronized: true }) as OffscreenCanvasRenderingContext2D;
        const [w, h] = settings.aspectRatio === '16:9' ? [1920, 1080] : [1080, 1920];
        
        const getActiveHeaderForTime = (time: number): string | undefined => {
          let activeHeader: string | undefined = undefined;
          for (const entry of sceneTimeline) {
            if (entry.start <= time && entry.scene.isHeader) activeHeader = entry.scene.subtitle;
          }
          return activeHeader;
        };

        try {
            const totalDuration = sceneTimeline.length ? sceneTimeline[sceneTimeline.length - 1].end : 0; 
            const muxerLib = (WebMMuxer as any).default || WebMMuxer;
            const muxer = new muxerLib.Muxer({ 
              target: new muxerLib.ArrayBufferTarget(), 
              video: { codec: 'V_VP8', width: w, height: h, frameRate: 30 }, 
              audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 1 }, 
              firstTimestampBehavior: 'offset' 
            });
            
            const videoEncoder = new (self as any).VideoEncoder({ 
              output: (chunk: any, metadata: any) => muxer.addVideoChunk(chunk, metadata), 
              error: (e: any) => self.postMessage({ type: 'error', payload: { message: e.message } }) 
            });
            videoEncoder.configure({ codec: 'vp8', width: w, height: h, bitrate: 12_000_000 });
            
            const audioEncoder = new (self as any).AudioEncoder({ 
              output: (chunk: any, metadata: any) => muxer.addAudioChunk(chunk, metadata), 
              error: (e: any) => self.postMessage({ type: 'error', payload: { message: e.message } }) 
            });
            audioEncoder.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: 1, bitrate: 192_000 });

            if (fullSpeechAudioBuffer) {
                const dataRaw = new Float32Array(fullSpeechAudioBuffer);
                const ratio = 48000 / (fullSpeechAudioSampleRate || 24000);
                const resampledData = new Float32Array(Math.ceil(dataRaw.length * ratio));
                for (let i = 0; i < resampledData.length; i++) { resampledData[i] = dataRaw[Math.floor(i / ratio)] * 0.95; }
                const audioData = new (self as any).AudioData({ 
                  format: 'f32', sampleRate: 48000, numberOfFrames: resampledData.length, numberOfChannels: 1, timestamp: 0, data: resampledData 
                });
                audioEncoder.encode(audioData); 
                audioData.close();
            }

            const fps = 30; const totalFrames = Math.ceil(totalDuration * fps); 
            const ratioMap = settings.aspectRatio === '16:9' ? { S: 0.03, M: 0.045, L: 0.055 } : { S: 0.05, M: 0.075, L: 0.09 };
            const baseFS = w * (ratioMap as any)[settings.subtitleSize];

            for (let f = 0; f < totalFrames; f++) {
                if (videoEncoder.encodeQueueSize > 15) await sleep(10);
                const t = f / fps;
                const entry: any = sceneTimeline.find((e: any) => !e.scene.isHeader && t >= e.start && t < e.end) || sceneTimeline[0];
                const img = loadedImages[entry.scene.imageUrl!]; 
                
                ctx.fillStyle = 'black'; ctx.fillRect(0, 0, w, h);
                if (img) {
                    const elapsed = t - entry.start; const eIdx = sceneTimeline.indexOf(entry);
                    const isZoomOut = eIdx % 2 !== 0;
                    let scale = isZoomOut ? Math.max(1.0, 1.2 - (elapsed * 0.04)) : 1.0 + (elapsed * 0.04);
                    const iR = img.width / img.height; const cR = w / h;
                    let dW, dH, oX = 0, oY = 0;
                    if (iR > cR) { dH = h; dW = img.width * (h / img.height); oX = (w - dW) / 2; }
                    else { dW = w; dH = img.height * (w / img.width); oY = (h - dH) / 2; }
                    ctx.save(); ctx.translate(w/2, h/2); ctx.scale(scale, scale); ctx.drawImage(img, oX - w/2, oY - h/2, dW, dH); ctx.restore();
                }

                ctx.save();
                const activeHeader = getActiveHeaderForTime(t);
                if (activeHeader) {
                    const fs = w * 0.028; ctx.font = `900 ${fs}px "Noto Sans KR", sans-serif`; 
                    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillText(activeHeader.replace(/[\[\]]/g, ''), w / 2, h * 0.05);
                }

                if (!entry.scene.isHeader) {
                    ctx.font = `900 ${baseFS}px "Noto Sans KR", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                    
                    // 요청사항 반영: 안전 여백 95% 원복
                    let limitRatio = 0.95;
                    if (settings.aspectRatio === '9:16') limitRatio = 0.90;

                    const maxWidth = w * limitRatio;
                    const lines = getBalancedLines(ctx, entry.scene.subtitle, maxWidth);
                    const bY = h - (h * settings.subtitlePosition / 100);
                    const lineH = baseFS * 1.35;
                    
                    if (settings.showSubtitleBox && lines.length > 0) {
                        let maxW = 0; lines.forEach(l => maxW = Math.max(maxW, ctx.measureText(l).width));
                        const padX = baseFS * 0.7; const padY = baseFS * 0.35;
                        const boxW = maxW + padX * 2; const boxH = lines.length * lineH + padY;
                        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect((w - boxW) / 2, bY - (lines.length * lineH) - padY/2, boxW, boxH);
                    }
                    ctx.fillStyle = 'white';
                    lines.forEach((l, i) => { ctx.fillText(l, w / 2, bY - (lines.length - 1 - i) * lineH); });
                }
                ctx.restore();
                const frame = new (self as any).VideoFrame(offscreenCanvas, { timestamp: Math.floor(t * 1_000_000) });
                videoEncoder.encode(frame, { keyFrame: f % 60 === 0 }); frame.close(); 
            }
            await videoEncoder.flush(); await audioEncoder.flush(); muxer.finalize();
            self.postMessage({ type: 'completed', payload: { blob: new Blob([muxer.target.buffer], { type: 'video/webm' }) } });
        } catch (e: any) { self.postMessage({ type: 'error', payload: { message: e.message } }); }
    }
};
