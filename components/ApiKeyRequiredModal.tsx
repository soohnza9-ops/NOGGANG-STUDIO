import { Key } from "lucide-react";

interface Props {
  onClose: () => void;
  onGoToKey: () => void;
}

export default function ApiKeyRequiredModal({ onClose, onGoToKey }: Props) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-zinc-800 p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-yellow-400 text-black flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-white">API 키가 필요합니다</h3>
          </div>
                <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold"
          >
            닫기
          </button>

        </div>

        <p className="text-sm text-zinc-400 leading-relaxed mb-6">
          이 도구는 생성형 AI API를 사용합니다. <br />
          계속하려면 먼저 <span className="text-yellow-400 font-bold">API 키를 등록</span>해 주세요.
        </p>


      </div>
    </div>
  );
}
