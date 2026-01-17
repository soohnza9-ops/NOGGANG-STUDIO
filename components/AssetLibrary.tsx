
import React, { useRef } from 'react';
import { Image as ImageIcon, Video, X, Plus, FileVideo, Wand2, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { UserAsset } from '../types';

interface AssetLibraryProps {
  assets: UserAsset[];
  onAssetsChange: (assets: UserAsset[]) => void;
  onGenerateEmpty?: () => void;
  isGenerating?: boolean;
  disabled: boolean;
  showGenerateButton?: boolean;
  // 설정 화면 전용 토글
  skipInitialImageGen?: boolean;
  onSkipInitialImageGenChange?: (val: boolean) => void;
}

const AssetLibrary: React.FC<AssetLibraryProps> = ({ 
  assets, onAssetsChange, onGenerateEmpty, isGenerating, disabled, showGenerateButton,
  skipInitialImageGen, onSkipInitialImageGenChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Explicitly type the result of Array.from as File[] to avoid 'unknown' type errors during iteration
    const files = Array.from(e.target.files || []) as File[];
    const newAssets: UserAsset[] = [];

    for (const file of files) {
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });

      newAssets.push({
        id: `ua-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url,
        type: type as 'image' | 'video',
        name: file.name,
      });
    }

    onAssetsChange([...assets, ...newAssets]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAsset = (id: string) => {
    onAssetsChange(assets.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <label className="text-base font-black text-zinc-400  uppercase tracking-widest">
            사용자 에셋 라이브러리 (이미지/영상)
          </label>
        </div>
        
        {/* 설정 페이지 전용 토글 버튼 - 텍스트 변경: 형님 요청사항 반영 */}
        {onSkipInitialImageGenChange !== undefined && (
          <button 
            onClick={() => onSkipInitialImageGenChange(!skipInitialImageGen)}
            className={`flex items-center gap-2 px-6 py-3 border-2 rounded-xl text-sm font-black transition-all ${
              skipInitialImageGen 
                ? 'bg-yellow-400 text-black border-yellow-400 scale-105 shadow-lg shadow-yellow-400/40' 
                : 'bg-zinc-900 border-yellow-400/40 text-yellow-400/70 hover:border-yellow-400 hover:text-yellow-400 hover:bg-yellow-400/5'
            }`}
          >
            {skipInitialImageGen ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            AI 이미지 생성 및 에셋 자동 배치를 생략하고, 오디오만 생성하여 시작 (수동 업로드 모드)
          </button>
        )}

        {/* 워크스페이스 전용 생성 버튼 */}
        {showGenerateButton && onGenerateEmpty && (
          <button 
            onClick={onGenerateEmpty}
            disabled={disabled || isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black hover:bg-emerald-500/30 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/5"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            비어있는 에셋 생성하기
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {assets.map((asset) => (
          <div key={asset.id} className="relative aspect-video rounded-xl border border-zinc-800 bg-black overflow-hidden group">
            {asset.type === 'video' ? (
              <video 
                src={asset.url} 
                className="w-full h-full object-cover" 
                muted
                playsInline
                autoPlay
                onCanPlay={(e) => { 
                  e.currentTarget.muted = true;
                  e.currentTarget.pause(); 
                  e.currentTarget.currentTime = 0.5; 
                }}
              />
            ) : (
              <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />
            )}
            <button
              onClick={() => removeAsset(asset.id)}
              disabled={disabled}
              className="absolute top-1 right-1 p-1 bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            >
              <X className="w-2.5 h-2.5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 py-0.5 text-center pointer-events-none">
              <span className="text-[8px] font-black text-white uppercase">{asset.type}</span>
            </div>
          </div>
        ))}
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="aspect-video rounded-xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 flex flex-col items-center justify-center gap-1 hover:border-zinc-700 hover:bg-zinc-900 transition-all text-zinc-500 disabled:opacity-50 group"
        >
          <Plus className="w-5 h-5 group-hover:text-emerald-400 transition-colors" />
          <span className="text-[10px] font-bold">추가하기</span>
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*"
        multiple
        className="hidden"
      />
    </div>
  );
};

export default AssetLibrary;
