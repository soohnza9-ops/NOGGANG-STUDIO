import React, { useMemo, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { InputMode } from '../types';

interface ScriptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;

  // 기존 props (현재 파일에서는 쓰지 않더라도 유지)
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;

  // ✅ 사용자가 선택한 배속 (0.5 ~ 2.0, 0.1 단위 가능)
  speed: number;
}

const ScriptInput: React.FC<ScriptInputProps> = ({
  value,
  onChange,
  disabled,
  mode,
  onModeChange,
  speed,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result;
        if (typeof text === 'string') onChange(text);
      };
      reader.readAsText(file);
    }
  };

  // ✅ 실측 기반(205자 @ 1.0x = 28초)
  const SEC_PER_CHAR_AT_1X = 28 / 205; // 0.136585...
  const SAFE_SPEED = Math.min(2.0, Math.max(0.5, Number.isFinite(speed) ? speed : 1.0));

  const estimateText = useMemo(() => {
    const chars = value.length;
    if (chars <= 0) return null;

    const baseSeconds = chars * SEC_PER_CHAR_AT_1X;
    const seconds = baseSeconds / SAFE_SPEED;

    const low = seconds * 0.9;
    const high = seconds * 1.1;

    // 60초 미만이면 초로, 이상이면 분으로 표시
    if (seconds < 60) {
      const s1 = Math.max(1, Math.floor(low));
      const s2 = Math.max(s1 + 1, Math.ceil(high));
      return `예상 영상 길이 : 약 ${s1}~${s2}초`;
    }

    const m1 = Math.max(1, Math.floor(low / 60));
    const m2 = Math.max(m1 + 1, Math.ceil(high / 60));
    return `예상 영상 길이 : 약 ${m1}~${m2}분`;
  }, [value.length, SAFE_SPEED]);

  return (
    <div className="space-y-4 flex flex-col h-full flex-grow">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <label className="text-base font-black text-zinc-400 uppercase tracking-widest">
            비디오 대본 입력
          </label>
          <span className="text-[12px] text-yellow-500/70 font-medium">
            * 입력된 대본을 최적의 장면으로 자동 분할합니다.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-500">
            {value.length.toLocaleString()}자
          </span>

          {estimateText && (
            <span className="text-xs font-bold text-zinc-500">
              {estimateText}
            </span>
          )}

          {value && (
            <button
              onClick={() => onChange('')}
              disabled={disabled}
              className="text-xs text-zinc-600 hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" /> 초기화
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-grow flex flex-col h-full">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="여기에 전체 이야기나 대본을 입력하세요. AI가 장면 전환 시점과 어울리는 이미지를 자동으로 분석하여 생성해 드립니다."
          className="flex-grow w-full bg-black border rounded-2xl p-6 text-zinc-200 placeholder:text-zinc-700 transition-all resize-none outline-none leading-relaxed text-lg shadow-inner min-h-[500px] border-zinc-800 focus:border-yellow-400"
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <FileText className="w-24 h-24" />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 flex-shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".txt,.md"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold transition-all border border-zinc-800"
        >
          <Upload className="w-4 h-4" /> 대본 파일 불러오기 (.txt)
        </button>
      </div>
    </div>
  );
};

export default ScriptInput;
