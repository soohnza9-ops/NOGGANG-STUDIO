
import React from 'react';
import { VideoSettings, AspectRatio, SubtitleSize } from '../types';
import { Monitor, Smartphone, Layers, ToggleLeft, ToggleRight } from 'lucide-react';

interface VideoSettingsPanelProps {
  settings: VideoSettings;
  onChange: (settings: Partial<VideoSettings>) => void;
  disabled: boolean;
}

const VideoSettingsPanel: React.FC<VideoSettingsPanelProps> = ({ settings, onChange, disabled }) => {
  const sizeMap: Record<SubtitleSize, string> = settings.aspectRatio === '16:9' 
    ? { S: '3.0cqw', M: '4.5cqw', L: '5.5cqw' }
    : { S: '5.0cqw', M: '7.5cqw', L: '9.0cqw' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-zinc-400 font-bold text-lg border-b border-zinc-800 pb-2">
        <Layers className="w-5 h-5 text-yellow-400" />
        영상 및 자막 설정
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-base font-black text-zinc-400 uppercase tracking-wider">화면 비율</label>
              <div className="flex gap-1.5">
                {(['16:9', '9:16'] as AspectRatio[]).map((ratio) => (
                  <button
                    key={ratio}
                    disabled={disabled}
                    onClick={() => onChange({ aspectRatio: ratio })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm transition-all ${
                      settings.aspectRatio === ratio 
                        ? 'bg-yellow-400 border-yellow-400 text-black font-black' 
                        : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700 font-bold'
                    }`}
                  >
                    {ratio === '16:9' ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-base font-black text-zinc-400 uppercase tracking-wider">자막 크기</label>
              <div className="flex gap-1.5">
                {(['S', 'M', 'L'] as SubtitleSize[]).map((size) => (
                  <button
                    key={size}
                    disabled={disabled}
                    onClick={() => onChange({ subtitleSize: size })}
                    className={`flex-1 py-3 rounded-xl border text-sm transition-all font-black ${
                      settings.subtitleSize === size 
                        ? 'bg-zinc-100 border-zinc-100 text-black' 
                        : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-700'
                    }`}
                  >
                    {size === 'S' ? '소' : size === 'M' ? '중' : '대'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
            <div className="flex flex-col">
               <span className="text-base font-black text-zinc-300">자막 배경 박스</span>
               <span className="text-[12px] text-zinc-600 font-bold">가독성을 위해 배경을 넣습니다.</span>
            </div>
            <button 
              onClick={() => onChange({ showSubtitleBox: !settings.showSubtitleBox })}
              className={`p-1 transition-colors ${settings.showSubtitleBox ? 'text-yellow-400' : 'text-zinc-700'}`}
            >
              {settings.showSubtitleBox ? <ToggleRight className="w-9 h-9" /> : <ToggleLeft className="w-9 h-9" />}
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-base font-black text-zinc-400 uppercase tracking-wider flex justify-between">
              자막 위치 <span className="text-yellow-400">{settings.subtitlePosition}%</span>
            </label>
            <div className="px-1">
              <input 
                type="range" min="0" max="60" step="5"
                disabled={disabled}
                value={settings.subtitlePosition}
                onChange={(e) => onChange({ subtitlePosition: parseInt(e.target.value) })}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-base font-black text-zinc-400 uppercase tracking-wider">자막 미리보기</label>
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-2xl p-4 flex items-center justify-center min-h-[220px]">
            <div 
            className="relative bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden flex flex-col items-center justify-end [container-type:inline-size] w-full"

              style={{ 
                aspectRatio: settings.aspectRatio === '16:9' ? '16 / 9' : '9 / 16', 
                maxWidth: settings.aspectRatio === '16:9' ? '400px' : '220px'
              }}
            >
              <div 
                className="absolute left-0 right-0 px-[2%] text-center font-black pointer-events-none z-10 break-keep flex flex-col items-center"
                style={{ 
                  bottom: `${settings.subtitlePosition}%`, 
                  fontSize: sizeMap[settings.subtitleSize], 
                  color: 'white',
                  lineHeight: '1.35',
                  fontFamily: '"Noto Sans KR", sans-serif',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '90%',
                  margin: '0 auto'
                }}
              >
                <div className="relative inline-block">
                    {settings.showSubtitleBox && <div className="absolute inset-x-[-4%] inset-y-[-5%] bg-black/70 rounded-md -z-10" />}

                    이곳에 자막이 표시됩니다.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSettingsPanel;
