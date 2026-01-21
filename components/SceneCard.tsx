
import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { Scene, YouTubeMetadata } from '../types';
import { Check, ImageIcon, Mic2, Trash2, AlertTriangle, Loader2, Edit3, X, UploadCloud, Video, FolderOpen, MousePointer2 } from 'lucide-react';

interface SceneCardProps {
  scene: Scene;
  index: number;
  metadata: YouTubeMetadata | null;

  onRegenerateImage: (id: string, prompt?: string) => void;
  onUpdateSubtitle: (id: string, newSubtitle: string) => void;
  onRegenerateAudio: (id: string, prompt?: string) => void;
  onUpdateVisualPrompt: (id: string, newVisualPrompt: string) => void;
  onDeleteScene: (id: string) => void;

  onClick: () => void;
  isActive: boolean;
  onRetry: (id: string) => void;
  onImageUpload: (id: string, base64: string, type?: 'image' | 'video') => void;
  skipInitialImageGen?: boolean;

  // ✅ 묶음(TTS)용
  getBreathKey?: () => string | null;              // breathKey(=breathId)를 카드가 직접 가져오게
  onRegenerateBreathGroup?: (breathKey: string) => void; // 해당 묶음만 오디오 재생성

  // ✅ 오디오 편집 모드 알림용
  onEnterAudioEditMode?: (breathKey: string) => void;
  onExitAudioEditMode?: () => void;

  // ✅ breath 묶음 "공용 텍스트" 편집용
  activeBreathKey?: string | null;
  breathEditText?: string;
  onBreathEditTextChange?: (breathKey: string, text: string) => void;
  onUpdateBreathGroupSubtitle?: (breathKey: string, text: string) => void;
}



const SceneCard = forwardRef<HTMLDivElement, SceneCardProps>(({
  scene,
  index,
  onRegenerateImage,
  onUpdateSubtitle,
  onRegenerateAudio,
  onUpdateVisualPrompt,
  onDeleteScene,
  onClick,
  isActive,

  onRetry,
  onImageUpload,
  skipInitialImageGen,
  getBreathKey,
  onRegenerateBreathGroup,

  onEnterAudioEditMode,
  onExitAudioEditMode,

  activeBreathKey,
  breathEditText,
  onBreathEditTextChange,
  onUpdateBreathGroupSubtitle
}, ref) => {




  const breathKey = getBreathKey ? getBreathKey() : null;
  const hasBreathGroup = !!breathKey;

  const [editedSubtitle, setEditedSubtitle] = useState(scene.subtitle);

  const [editedVisualPrompt, setEditedVisualPrompt] = useState(scene.visualPrompt);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [showAudioEditor, setShowAudioEditor] = useState(false);
    const [showSubtitleEditor, setShowSubtitleEditor] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImageRegenerating, setIsImageRegenerating] = useState(false);
const [isAudioRegenerating, setIsAudioRegenerating] = useState(false);
  const isExporting = (window as any).__NOGGANG_IS_EXPORTING__ === true;
  const imageEditorRef = useRef<HTMLDivElement>(null);
  const audioEditorRef = useRef<HTMLDivElement>(null);
  const imageBtnRef = useRef<HTMLButtonElement>(null);
  const audioBtnRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // 수동 업로드용

  useEffect(() => { setEditedSubtitle(scene.subtitle); }, [scene.subtitle]);
  useEffect(() => { setEditedVisualPrompt(scene.visualPrompt); }, [scene.visualPrompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showImageEditor && imageEditorRef.current && !imageEditorRef.current.contains(target) && imageBtnRef.current && !imageBtnRef.current.contains(target)) {
        setShowImageEditor(false);
      }
      if (showAudioEditor && audioEditorRef.current && !audioEditorRef.current.contains(target) && audioBtnRef.current && !audioBtnRef.current.contains(target)) {
        setShowAudioEditor(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showImageEditor, showAudioEditor]);

  useEffect(() => {
  if (scene.imageUrl && isImageRegenerating) {
    setIsImageRegenerating(false);
  }
}, [scene.imageUrl]);

useEffect(() => {
  if (scene.audioBuffer && isAudioRegenerating) {
    setIsAudioRegenerating(false);
  }
}, [scene.audioBuffer]);


const handleConfirmRegen = (type: 'image' | 'audio') => {
  if (type === 'image') {
    if (!showImageEditor) {
      setShowImageEditor(true);
      setShowAudioEditor(false);
      setShowSubtitleEditor(false);
      return;
    }
    setIsImageRegenerating(true);
    onRegenerateImage(scene.id, editedVisualPrompt);
    return;
  }

  // audio
if (!showAudioEditor) {
  setShowAudioEditor(true);
  setShowImageEditor(false);
  setShowSubtitleEditor(false);

  if (breathKey && onEnterAudioEditMode) {
    onEnterAudioEditMode(breathKey);
  }

  return;
}


  setIsAudioRegenerating(true);

  // ✅ 먼저 "편집 텍스트" 저장
  if (breathKey && onUpdateBreathGroupSubtitle) {
    const text = (activeBreathKey === breathKey ? (breathEditText ?? '') : editedSubtitle);
    onUpdateBreathGroupSubtitle(breathKey, text);
  } else {
    onUpdateSubtitle(scene.id, editedSubtitle);
  }

  // ✅ breathKey 있으면: "이 묶음만" 재생성
  if (breathKey && onRegenerateBreathGroup) {
    onRegenerateBreathGroup(breathKey);
    return;
  }


  // ✅ breathKey 없으면: 기존처럼 씬 단위 재생성
  onRegenerateAudio(scene.id, editedSubtitle);
};




  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      const reader = new FileReader();
      reader.onload = (ev) => onImageUpload(scene.id, ev.target?.result as string, type);
      reader.readAsDataURL(file);
    }
  };

const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  const dt = e.dataTransfer;

  // 1️⃣ Scene → Scene 복사
  const scenePayload = dt.getData('application/x-scene-image');
  if (scenePayload) {
    try {
      const parsed = JSON.parse(scenePayload);
      onImageUpload(
        scene.id,
        parsed.url,
        parsed.type === 'video' ? 'video' : 'image'
      );
    } catch {
      const isVideo = scenePayload.startsWith('data:video/');
      onImageUpload(scene.id, scenePayload, isVideo ? 'video' : 'image');
    }
    return;
  }

  // 2️⃣ 탐색기 파일 → Scene
  if (dt.files && dt.files.length > 0) {
    const file = dt.files[0];
    const type = file.type.startsWith('video/') ? 'video' : 'image';

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!ev.target?.result) return;
      onImageUpload(scene.id, ev.target.result as string, type);
    };
    reader.readAsDataURL(file);
  }
};


  const isActuallyReady = scene.isHeader || (scene.status === 'completed' && scene.imageUrl && scene.audioBuffer);
  
  const statusLabel = () => {
    if (scene.isHeader) return 'READY';
    if (scene.status === 'error') return '조치 필요 (ERROR)';
    
    // 수동 모드인 경우
    if (skipInitialImageGen) {
      if (!scene.audioBuffer) return 'AUDIO GENERATING...';
      if (!scene.imageUrl || scene.imageUrl.startsWith('data:image/svg')) return 'READY (UPLOAD)';
      return 'READY';
    }
    
    if (scene.status === 'generating') return 'GENERATING...';
    if (isActuallyReady) return 'READY';
    return 'PENDING';
  };

  const statusColor = () => {
    if (scene.isHeader) return 'text-zinc-500';
    if (scene.status === 'error') return 'text-yellow-500';
    
    if (skipInitialImageGen) {
        if (!scene.audioBuffer) return 'text-blue-400 animate-pulse';
        return 'text-emerald-400';
    }

    if (scene.status === 'generating') return 'text-blue-400 animate-pulse';
    if (isActuallyReady) return 'text-emerald-400';
    return 'text-zinc-500';
  };

  const duration = scene.audioBuffer?.duration ?? scene.estimatedDurationSeconds ?? 0;

  return (
    <div
    ref={ref}
    onMouseDown={(e) => {
   if (scene.isHeader) e.stopPropagation();
  }}
      onClick={(e) => {
   if (scene.isHeader) {
     e.stopPropagation();
     return;
   }
   onClick();
 }}
      onDragOver={(e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  setIsDragging(true);
}}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
className={`
  transition-all duration-200 cursor-pointer relative rounded-2xl border
  ${scene.isHeader ? 'py-2 px-4 bg-zinc-100 border-zinc-300 shadow-sm z-20' : 'p-3 bg-zinc-900'}
  ${
!scene.isHeader && isActive && !showAudioEditor && activeBreathKey === null
  ? 'border-yellow-400 shadow-[0_0_0_2px_rgba(250,204,21,0.9)] z-20'
      : 'border-zinc-800 hover:border-zinc-700'
  }
  ${scene.status === 'error' ? 'border-yellow-500/50 bg-yellow-500/5' : ''}
  ${isDragging ? 'bg-emerald-500/10 border-emerald-500 border-dashed' : ''}
`}



    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">


          <span className={`text-[9px] font-black uppercase tracking-wider ${scene.isHeader ? 'text-zinc-600' : 'text-zinc-500'}`}>
            {scene.isHeader ? "Section Header" : `Scene ${index + 1}`}
          </span>
          {!scene.isHeader && (
            <>
              <span className="text-[10px] font-mono font-bold text-yellow-400/90 tracking-tighter">({duration.toFixed(1)}s)</span>
              <span className={`text-[8px] flex items-center gap-1 font-bold ${statusColor()}`}>
                {(isActuallyReady || (skipInitialImageGen && scene.audioBuffer)) ? <Check className="w-2 h-2" /> : scene.status === 'error' ? <AlertTriangle className="w-2.5 h-2.5" /> : <Loader2 className="w-2 h-2 animate-spin" />}
                {statusLabel()}
              </span>
              {scene.isUserAsset && (
                <span className="text-[7px] font-black text-blue-400 ml-1 opacity-80 uppercase tracking-tighter">업로드</span>
              )}
            </>
          )}
        </div>
       <button
  disabled={isExporting}
  onClick={(e) => {
    e.stopPropagation();
    if (isExporting) return;
    onDeleteScene(scene.id);
  }}
  className={`p-1 transition-colors ${isExporting ? 'text-zinc-700 cursor-not-allowed' : 'text-zinc-600 hover:text-red-400'}`}
>

          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {!scene.isHeader ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            {/* 썸네일 영역: 클릭 시 폴더 열기 기능 고도화 */}
            <div 
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className={`flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden bg-black border relative transition-all group/thumb ${isDragging ? 'border-emerald-500 scale-105 shadow-lg shadow-emerald-500/20' : 'border-zinc-800 hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/20'}`}
            >
            
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" className="hidden" />
              
             {scene.imageUrl && !scene.imageUrl.startsWith('data:image/svg') ? (
  scene.userAssetType === 'video' ? (
    <video
      src={scene.imageUrl}
      className="w-full h-full object-cover"
      muted
      playsInline
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.preventDefault(); // ❗ 새 탭 열림 방지

        e.dataTransfer.clearData();
        e.dataTransfer.effectAllowed = 'copy';
       e.dataTransfer.setData(
  'application/x-scene-image',
  JSON.stringify({
    url: scene.imageUrl,
    type: scene.userAssetType || 'image'
  })
);
      }}
    />
  ) : (
    <img
      src={scene.imageUrl}
      className="w-full h-full object-cover"
      alt="scene"
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.preventDefault(); // ❗ 새 탭 열림 방지

        e.dataTransfer.clearData();
        e.dataTransfer.effectAllowed = 'copy';
       e.dataTransfer.setData(
  'application/x-scene-image',
  JSON.stringify({
    url: scene.imageUrl,
    type: scene.userAssetType || 'image'
  })
);
      }}
    />
  )
) : (

                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                  {scene.status === 'error' ? (
                    <AlertTriangle className="text-yellow-500 w-5 h-5" />
                  ) : (
                    <>
                      <div className="p-2 bg-zinc-900 rounded-full border border-zinc-800 group-hover/thumb:border-yellow-400 group-hover/thumb:bg-yellow-400/10 transition-colors">
                        <FolderOpen className={`w-5 h-5 transition-colors ${isActive ? 'text-yellow-400' : 'text-zinc-600 group-hover/thumb:text-yellow-400'}`} />
                      </div>
                      <span className="text-[8px] font-black text-zinc-500 group-hover/thumb:text-yellow-400 tracking-tighter uppercase">Click to Upload</span>
                    </>
                  )}
                </div>
              )}

              {/* 로딩 표시: 수동 모드일 때는 오직 오디오 생성 중일 때만 오버레이 (이미지 로딩과 무관) */}
              {!skipInitialImageGen && scene.status === 'generating' && !scene.imageUrl && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <Loader2 className="animate-spin text-yellow-400 w-5 h-5" />
                </div>
              )}

              {isDragging && (
                <div className="absolute inset-0 bg-emerald-500/40 backdrop-blur-sm flex items-center justify-center">
                  <UploadCloud className="w-7 h-7 text-white animate-bounce" />
                </div>
              )}
            </div>
            
            <div className="flex-grow min-w-0 flex flex-col justify-between">
<p className="text-[13px] text-zinc-200 font-bold whitespace-pre-line leading-relaxed mb-2">
  {showSubtitleEditor
    ? editedSubtitle
    : scene.subtitle}
</p>
              <div className="flex gap-2 justify-end">

  {/* 이미지 재생성 */}
  <button 
    ref={imageBtnRef}
    onClick={(e) => {
      e.stopPropagation();
      if (isExporting) return;
      handleConfirmRegen('image');
    }}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border shadow-sm ${
      showImageEditor
        ? 'bg-yellow-400 text-black border-yellow-500'
        : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 active:scale-95'
    }`}
  >
    {isImageRegenerating
      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
      : <ImageIcon className="w-3.5 h-3.5" />
    }
    {showImageEditor ? '지금 생성' : '이미지 재생성'}
  </button>

  {/* 오디오 재생성 (묶음용) */}
  <button 
    ref={audioBtnRef}
    onClick={(e) => {
      e.stopPropagation();
      if (isExporting) return;
      handleConfirmRegen('audio');
    }}
    disabled={scene.status === 'generating' && !scene.audioBuffer}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border shadow-sm ${
      showAudioEditor
        ? 'bg-yellow-400 text-black border-yellow-500'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95'
    }`}
  >
    {isAudioRegenerating
      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
      : <Mic2 className="w-3.5 h-3.5" />
    }
    {showAudioEditor
      ? '지금 생성'
      : hasBreathGroup
        ? '오디오 재생성'
        : '오디오 재생성'}
  </button>

  {/* 자막 수정 */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      setShowAudioEditor(false);
      setShowImageEditor(false);
      setShowSubtitleEditor(v => !v);
    }}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border shadow-sm ${
      showSubtitleEditor
        ? 'bg-yellow-400 text-black border-yellow-500'
        : 'bg-zinc-800/60 text-zinc-200 border-zinc-700/60 hover:bg-zinc-800 active:scale-95'
    }`}
  >
    자막 수정
  </button>


</div>

            </div>
          </div>

          {showImageEditor && (
            <div ref={imageEditorRef} className="mt-1 p-3 bg-zinc-950 rounded-xl border border-blue-500/30 animate-in slide-in-from-top-1 duration-200" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-2">
                 <label className="text-[10px] text-blue-400 font-black uppercase tracking-widest">AI 이미지 프롬프트 수정</label>
                 <button onClick={() => setShowImageEditor(false)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4"/></button>
               </div>
               <textarea 
                  value={editedVisualPrompt} onChange={(e) => setEditedVisualPrompt(e.target.value)} onBlur={() => onUpdateVisualPrompt(scene.id, editedVisualPrompt)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[12px] text-zinc-300 focus:border-blue-500/50 outline-none resize-none leading-relaxed" rows={2} autoFocus
                />
            </div>
          )}

{showAudioEditor && (
  <div
    ref={audioEditorRef}
    className="mt-1 p-3 bg-zinc-950 rounded-xl border border-emerald-500/30 animate-in slide-in-from-top-1 duration-200"
    onClick={e => e.stopPropagation()}
  >
    <div className="flex justify-between items-center mb-2">
      <label className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">
        자막 및 대사 수정
      </label>

      <button
        onClick={() => {
          setShowAudioEditor(false);

          if (breathKey && onUpdateBreathGroupSubtitle) {
  onUpdateBreathGroupSubtitle(breathKey, breathEditText ?? '');
} else {
            onUpdateSubtitle(scene.id, editedSubtitle);
          }

          if (onExitAudioEditMode) onExitAudioEditMode();
        }}
        className="text-zinc-500 hover:text-white transition-colors"
      >
        <X className="w-4 h-4"/>
      </button>
    </div>

    <textarea
      value={
        breathKey && activeBreathKey === breathKey
          ? (breathEditText ?? '')
          : editedSubtitle
      }
      onChange={(e) => {
        const v = e.target.value;

        if (breathKey && activeBreathKey === breathKey && onBreathEditTextChange) {
          onBreathEditTextChange(breathKey, v);
          return;
        }

        setEditedSubtitle(v);
      }}
      onBlur={() => {
        if (breathKey && activeBreathKey === breathKey && onUpdateBreathGroupSubtitle) {
          onUpdateBreathGroupSubtitle(breathKey, breathEditText ?? '');
          return;
        }
        onUpdateSubtitle(scene.id, editedSubtitle);
      }}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[12px] text-zinc-200 font-bold focus:border-emerald-500/50 outline-none resize-none leading-relaxed"
      rows={3}
      autoFocus
    />
  </div>
)}

{showSubtitleEditor && (
  <div
    className="mt-1 p-3 bg-zinc-950 rounded-xl border border-zinc-500/30 animate-in slide-in-from-top-1 duration-200"
    onClick={e => e.stopPropagation()}
  >
    <div className="flex justify-between items-center mb-2">
      <label className="text-[10px] text-zinc-300 font-black uppercase tracking-widest">
        자막 수정
      </label>
      <button
        onClick={() => {
          onUpdateSubtitle(scene.id, editedSubtitle);
          setShowSubtitleEditor(false);
        }}
        className="text-yellow-400 font-black text-xs hover:text-yellow-300"
      >
        완료
      </button>
    </div>

    <textarea
      value={editedSubtitle}
      onChange={(e) => setEditedSubtitle(e.target.value)}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[12px] text-zinc-200 font-bold focus:border-zinc-500/50 outline-none resize-none leading-relaxed"
      rows={3}
      autoFocus
    />
  </div>
)}


        </div>
      ) : (
        <div className="flex items-center gap-2">
            <input value={editedSubtitle} onChange={(e) => setEditedSubtitle(e.target.value)} onBlur={() => onUpdateSubtitle(scene.id, editedSubtitle)} className="flex-grow bg-transparent border-none text-black font-black text-sm p-0 outline-none" />
            <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
        </div>
      )}
    </div>
  );
});

export default SceneCard;
