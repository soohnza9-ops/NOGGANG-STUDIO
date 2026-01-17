import React, { useMemo, useRef } from "react";
import { Music, Upload } from "lucide-react";

type Variant = "full" | "compact" | "inline" | "side";

type Props = {
  variant?: Variant;
  selectedBgm: string | null;
  onSelect: (url: string | null) => void;
  volume: number; // 0~1
  onVolumeChange: (v: number) => void;
  disabled?: boolean;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const prettyPercent = (v: number) => `${Math.round(clamp01(v) * 100)}%`;

const filenameFromUrl = (url: string) => {
  try {
    if (url.startsWith("blob:")) return "업로드된 BGM";
    const u = new URL(url);
    const last = u.pathname.split("/").pop();
    return decodeURIComponent(last || "BGM");
  } catch {
    return "BGM";
  }
};

const BgmSelector: React.FC<Props> = ({
  variant = "full",
  selectedBgm,
  onSelect,
  volume,
  onVolumeChange,
  disabled,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const label = useMemo(() => {
    if (!selectedBgm) return "선택 안 됨";
    return filenameFromUrl(selectedBgm);
  }, [selectedBgm]);

  const openPicker = () => {
    if (disabled) return;
    fileRef.current?.click();
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    onSelect(url);
    e.target.value = "";
  };

  /**
   * ✅ SIDE: "미리듣기 박스 왼쪽 독립 카드"
   * - 부모가 높이를 고정(h-XXX)하면, 이 컴포넌트는 h-full로 정확히 맞춰짐
   * - 내부 UI는 그 높이를 절대 넘기지 않도록 세로 압축
   */
 if (variant === "side") {
  return (
    <div className="h-full w-[230px] bg-[#141414] rounded-xl border border-zinc-800/50 p-3 flex flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onPickFile}
        disabled={disabled}
      />

      {/* ✅ 1) 한 줄: 아이콘 + BGM(베이스) + '볼륨' + 슬라이더 + % */}
      <div className="flex items-center gap-2">
        <Music className="w-4 h-4 text-sky-300 shrink-0" />

        {/* BGM 글자: 베이스 폰트 */}
        <div className="text-base font-black text-zinc-200 leading-none shrink-0">
          BGM
        </div>

        {/* 볼륨 라벨 */}
        <div className="text-[11px] font-black text-zinc-400 shrink-0">
          볼륨
        </div>

        {/* 슬라이더: 남는 폭 전부 */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={clamp01(volume)}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400 min-w-0"
        />

        {/* % */}
        <span className="text-[11px] font-mono font-black text-yellow-400 w-[36px] text-right shrink-0">
          {prettyPercent(volume)}
        </span>
      </div>

      {/* ✅ 2) 파일명(선택 안 됨) */}
      <div
        className="text-[10px] font-bold text-zinc-500 truncate mt-1"
        title={selectedBgm ? label : ""}
      >
        {selectedBgm ? label : "선택 안 됨"}
      </div>

      {/* ✅ 3) 아래: 업로드 버튼 */}
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={`
         mt-2 h-12 w-full rounded-xl

          border border-zinc-800 bg-[#0a0a0a]
          text-[11px] font-black text-zinc-200
          flex items-center justify-center gap-2
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-zinc-700 active:scale-[0.99]"}
        `}
        title={selectedBgm ? "다시 불러오기" : "BGM 불러오기"}
      >
        <Upload className="w-4 h-4" />
        <span className="truncate">{selectedBgm ? "다시 불러오기" : "불러오기"}</span>
      </button>

      {/* 높이 여유 채우기 */}
      <div className="flex-1" />
    </div>
  );
}



  // ✅ INLINE: (기존 유지)
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onPickFile}
          disabled={disabled}
        />

        <div className="flex items-center gap-2 px-3 h-10 rounded-xl border border-zinc-800 bg-[#0a0a0a]">
          <Music className="w-4 h-4 text-sky-300" />
          <span className="text-[12px] font-black text-zinc-200">BGM</span>

          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className={`
              ml-1 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg
              border border-zinc-800 bg-[#141414] text-[11px] font-black text-zinc-200
              ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-zinc-700 active:scale-[0.98]"}
            `}
            title={selectedBgm ? label : "BGM 불러오기"}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="max-w-[80px] truncate">{selectedBgm ? label : "불러오기"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-zinc-800 bg-[#0a0a0a]">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={clamp01(volume)}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            disabled={disabled}
            className="w-[90px] h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
          />
          <span className="text-[11px] font-mono font-black text-yellow-400 w-[36px] text-right">
            {prettyPercent(volume)}
          </span>
        </div>
      </div>
    );
  }

  // ✅ COMPACT (기존 유지)
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onPickFile}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className={`
            h-9 px-3 rounded-xl border border-zinc-800 bg-black/40
            text-zinc-200 text-[11px] font-black flex items-center gap-2
            ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-zinc-700 active:scale-[0.98]"}
          `}
          title={selectedBgm ? label : "BGM 불러오기"}
        >
          <Music className="w-4 h-4 text-sky-300" />
          <span className="max-w-[160px] truncate">{selectedBgm ? label : "BGM 불러오기"}</span>
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={clamp01(volume)}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-[120px] accent-yellow-400"
        />
        <span className="text-[11px] font-mono font-black text-yellow-400 w-[40px] text-right">
          {prettyPercent(volume)}
        </span>
      </div>
    );
  }

  // ✅ FULL (기존 유지)
  return (
    <div className="bg-[#0a0a0a] p-6 rounded-[1.5rem] border border-zinc-800/50 space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onPickFile}
        disabled={disabled}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-sky-300" />
          <div className="text-lg font-black text-zinc-200">BGM</div>
        </div>
        <div className="text-sm font-mono font-black text-yellow-400">{prettyPercent(volume)}</div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] font-black text-zinc-500">볼륨</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={clamp01(volume)}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
        />
      </div>

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={`
          w-full h-20 rounded-2xl border border-dashed border-zinc-800 bg-[#0a0a0a]
          text-zinc-300 font-black
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-zinc-700 active:scale-[0.99]"}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="w-5 h-5 text-zinc-500" />
          <div className="text-sm">{selectedBgm ? label : "불러오기"}</div>
        </div>
      </button>
    </div>
  );
};

export default BgmSelector;
