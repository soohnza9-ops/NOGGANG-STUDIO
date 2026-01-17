
import React, { useRef } from 'react';
import { ArtStyle } from '../types';
import { Camera, Zap, Layout, Aperture, Image as ImageIcon, X, Upload } from 'lucide-react';

interface StyleSelectorProps {
  selectedStyle: ArtStyle;
  onSelect: (style: ArtStyle) => void;
  referenceImage?: string;
  onReferenceImageChange: (base64?: string) => void;
  disabled: boolean;
}

const styles = [
  { id: ArtStyle.PHOTOREALISTIC, label: '영화 같은', icon: Camera, color: 'from-blue-500 to-cyan-500' },
  { id: ArtStyle.REALISTIC, label: '현실 사진', icon: Aperture, color: 'from-emerald-500 to-green-500' },
  { id: ArtStyle.ANIME, label: '애니메이션', icon: Zap, color: 'from-pink-500 to-rose-500' },
  { id: ArtStyle.CYBERPUNK, label: '사이버펑크', icon: Layout, color: 'from-violet-500 to-purple-600' },
];

const StyleSelector: React.FC<StyleSelectorProps> = ({ 
  selectedStyle, 
  onSelect, 
  referenceImage, 
  onReferenceImageChange, 
  disabled 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        onReferenceImageChange(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-base font-black text-zinc-400 ">
          스타일 및 참조 이미지
        </label>
        {referenceImage && (
          <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-tighter animate-pulse">
            참조 이미지 우선 모드 활성화됨
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* 스타일 버튼 구역 */}
        <div className="flex-grow grid grid-cols-2 sm:grid-cols-4 gap-3">
          {styles.map((style) => {
            const Icon = style.icon;
            const isSelected = selectedStyle === style.id && !referenceImage;
            return (
              <button
                key={style.id}
                onClick={() => onSelect(style.id)}
                disabled={disabled || !!referenceImage}
                className={`
                  relative flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200
                  ${isSelected 
                    ? 'bg-zinc-900 border-yellow-400 ring-1 ring-yellow-400 shadow-lg shadow-yellow-500/10' 
                    : 'bg-black border-zinc-800 text-zinc-500'
                  }
                  ${(disabled || !!referenceImage) ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:border-zinc-600 hover:bg-zinc-900'}
                `}
              >
                <div className={`p-2 rounded-full bg-gradient-to-br ${style.color} text-white opacity-90`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-zinc-500'}`}>
                  {style.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 참조 이미지 업로드 구역 - 형님 요청대로 글자 키우고 노란색으로 변경 */}
        <div className="flex-shrink-0 w-full md:w-64 h-24 relative group">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          {referenceImage ? (
            <div className="w-full h-full rounded-xl border border-yellow-400 overflow-hidden relative">
              <img src={referenceImage} className="w-full h-full object-cover" />
              <button 
                onClick={() => onReferenceImageChange(undefined)}
                className="absolute top-1 right-1 p-1 bg-black/80 rounded-full text-white hover:bg-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-yellow-400 py-1 text-center">
                <span className="text-[9px] text-black font-black uppercase">Ref Active</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="w-full h-full bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-zinc-700 hover:bg-zinc-900 transition-all text-zinc-500 disabled:opacity-50"
            >
              <Upload className="w-6 h-6 text-yellow-400" />
              <span className="text-lg font-black text-yellow-400">참조 이미지 업로드</span>
            </button>
          )}
        </div>
      </div>
      
      {!referenceImage && (
        <p className="text-[10px] text-zinc-600">
          * 참조 이미지를 업로드하면 색감, 스타일, 캐릭터 특징을 AI가 그대로 따라갑니다.
        </p>
      )}
    </div>
  );
};

export default StyleSelector;
