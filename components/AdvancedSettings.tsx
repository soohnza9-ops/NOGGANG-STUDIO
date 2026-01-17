
import React from 'react';
import { Settings2, UserCheck, CloudSun } from 'lucide-react';

interface AdvancedSettingsProps {
  characterPrompt: string;
  onCharacterPromptChange: (prompt: string) => void;
  atmospherePrompt: string;
  onAtmospherePromptChange: (prompt: string) => void;
  disabled: boolean;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  characterPrompt,
  onCharacterPromptChange,
  atmospherePrompt,
  onAtmospherePromptChange,
  disabled
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-zinc-400 font-black  text-base border-b border-zinc-800 pb-2">
          <Settings2 className="w-4 h-4 text-yellow-400" />
          고급 시각 설정
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 캐릭터 고정 설정 */}
        <div className={`
          bg-black/20 p-4 rounded-2xl border transition-all duration-200
          ${disabled ? 'border-zinc-900 opacity-60' : 'border-zinc-800 hover:border-zinc-700 focus-within:border-yellow-400/50'}
        `}>
          <label className="block text-lg text-zinc-300 mb-2 flex items-center gap-1.5 font-black uppercase tracking-wider select-none">
              <UserCheck className="w-5 h-5 text-blue-400" />
              캐릭터 고정
          </label>
        <textarea
  key="character-prompt-clean"
  value={characterPrompt}
  onChange={(e) => onCharacterPromptChange(e.target.value)}
  readOnly={disabled}
  placeholder="예: 인물이 나올 경우 한국인으로 묘사.../ 안경 쓴 20대 여성..."
  autoComplete="off"
  name="characterPrompt_clean"
  className="w-full h-24 bg-zinc-900/30 border border-zinc-800 rounded-xl p-3 text-lg text-zinc-200 resize-none outline-none leading-relaxed"
/>


        </div>

        {/* 장면 분위기 설정 */}
        <div className={`
          bg-black/20 p-4 rounded-2xl border transition-all duration-200
          ${disabled ? 'border-zinc-900 opacity-60' : 'border-zinc-800 hover:border-zinc-700 focus-within:border-yellow-400/50'}
        `}>
          <label className="block text-lg text-zinc-300 mb-2 flex items-center gap-1.5 font-black uppercase tracking-wider select-none">
              <CloudSun className="w-5 h-5 text-orange-400" />
              장면 분위기
          </label>
          <textarea
              value={atmospherePrompt}
              onChange={(e) => onAtmospherePromptChange(e.target.value)}
              disabled={disabled}
              placeholder="예: 비 내리는 어두운 밤..."
              className="w-full h-24 bg-zinc-900/30 border border-zinc-800 rounded-xl p-3 text-lg text-zinc-200 resize-none outline-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettings;
