import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../services/firebase";
import { Key } from "lucide-react";
import ApiKeyModal from "./ApiKeyModal";

type HeaderProps = {
  onKeyStatusChange: (hasKey: boolean) => void;
};

const Header: React.FC<HeaderProps> = ({ onKeyStatusChange }) => {
  const [user, setUser] = useState<User | null>(null);

  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);

  const lastStatusRef = useRef<boolean | null>(null);

  // (A) Firebase 로그인 상태 구독
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // (B) 최초 로드시 로컬스토리지에서 키 확인
  useEffect(() => {
    const key = localStorage.getItem("GEMINI_API_KEY") || "";
    const ok = key.trim().length > 0;

    setApiKey(key);
    setHasKey(ok);

    lastStatusRef.current = ok;
    onKeyStatusChange(ok);
  }, [onKeyStatusChange]);

  const handleSelectKey = async () => {
    setIsKeyModalOpen(true);
  };

  return (
    <>
      <header className="w-full bg-black/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 ml-16">
            <div className="bg-yellow-400 w-10 h-10 rounded-2xl flex items-center justify-center">
              <span
                className="text-black font-extrabold text-xl leading-none -mt-[1px]"
                style={{ fontFamily: '"Noto Sans KR", sans-serif' }}
              >
                노
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              노깡 STUDIO
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-2">
              <button
                type="button"
                onClick={handleSelectKey}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                  hasKey
                    ? "bg-emerald-400/20 border-emerald-400 text-emerald-300"
                    : "bg-yellow-400/20 border-yellow-400 text-yellow-300"
                }`}
              >
                <Key className="w-4 h-4" />
                {hasKey ? "API 키 연결됨" : "API 키 입력"}
              </button>
              <div className="text-[10px] text-zinc-400 mt-1">
                키는 브라우저에만 저장됩니다
              </div>
            </div>

            {user && (
              <button
                onClick={() => signOut(auth)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white"
              >
                로그아웃
              </button>
            )}
          </div>
        </div>
      </header>

      {isKeyModalOpen && (
        <ApiKeyModal
          initialValue={apiKey}
          onClose={() => setIsKeyModalOpen(false)}
          onSaved={(k) => {
            localStorage.setItem("GEMINI_API_KEY", k);

            setApiKey(k);
            const ok = k.trim().length > 0;

            // 같은 값이면 아무것도 안 함
            if (lastStatusRef.current === ok) return;
            lastStatusRef.current = ok;

            setHasKey(ok);
            onKeyStatusChange(ok);

            setIsKeyModalOpen(false);
          }}
        />
      )}
    </>
  );
};

export default Header;
