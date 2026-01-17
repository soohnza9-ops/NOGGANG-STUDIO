import React, { useState } from "react";

interface ApiKeyModalProps {
  initialValue?: string;
  onClose: () => void;
  onSaved: (key: string) => void;
}

export default function ApiKeyModal({
  initialValue = "",
  onClose,
  onSaved,
}: ApiKeyModalProps) {
  const [key, setKey] = useState(initialValue);

  const save = () => onSaved(key);

  const clear = () => {
    setKey("");
    onSaved("");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-5">
        <div className="text-white font-black text-lg">Gemini API 키 입력</div>
        <div className="text-zinc-400 text-xs mt-1">
          입력한 키는 브라우저 로컬스토리지에 저장됩니다.
        </div>

        <textarea
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="여기에 Gemini API Key 붙여넣기"
          className="mt-4 w-full h-28 rounded-xl bg-black border border-zinc-800 text-white p-3 text-sm outline-none"
        />

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            닫기
          </button>
          <button
            onClick={clear}
            className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
          >
            키 삭제
          </button>
          <button
            onClick={save}
            className="px-4 py-2 rounded-xl text-xs font-black bg-yellow-400 text-black hover:bg-yellow-300"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
