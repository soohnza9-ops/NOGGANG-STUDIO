
import React, { useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { InputMode } from '../types';

interface ScriptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
}

const ScriptInput: React.FC<ScriptInputProps> = ({ value, onChange, disabled }) => {
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

  const isOverLimit = value.length > 5000;

  return (
    <div className="space-y-4 flex flex-col h-full flex-grow">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <label className="text-base font-black text-zinc-400  uppercase tracking-widest">
            비디오 대본 입력
          </label>
          <span className="text-[12px] text-yellow-500/70 font-medium">
            * AI가 문맥과 글자 수에 맞춰 최적의 장면으로 자동 분할합니다.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold ${isOverLimit ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`}>
            {value.length.toLocaleString()} / 5,000자
          </span>
          {value && (
            <button onClick={() => onChange('')} disabled={disabled} className="text-xs text-zinc-600 hover:text-red-400 flex items-center gap-1 transition-colors">
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
          className={`flex-grow w-full bg-black border rounded-2xl p-6 text-zinc-200 placeholder:text-zinc-700 transition-all resize-none outline-none leading-relaxed text-lg shadow-inner min-h-[500px] ${isOverLimit ? 'border-red-500/50' : 'border-zinc-800 focus:border-yellow-400'}`}
        />
        {!value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <FileText className="w-24 h-24" />
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 flex-shrink-0">
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md" className="hidden" />
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
