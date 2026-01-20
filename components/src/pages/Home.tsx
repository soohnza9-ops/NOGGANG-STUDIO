import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../../../services/firebase";
import { useNavigate } from "react-router-dom";
import ApiKeyModal from "../../ApiKeyModal";
import Header from "../../Header";
const Home: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const key = localStorage.getItem("GEMINI_API_KEY") || "";
    setApiKey(key);
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Header />

      <main className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-8 px-6">
        <div className="flex items-center gap-3">
          <div className="bg-yellow-400 w-12 h-12 rounded-2xl flex items-center justify-center">
            <span className="text-black font-extrabold text-2xl -mt-[1px]">
              노
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">노깡 STUDIO</h1>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-zinc-300">
              Gemini API 키
            </div>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                apiKey
                  ? "bg-emerald-400/20 border-emerald-400 text-emerald-300"
                  : "bg-yellow-400/20 border-yellow-400 text-yellow-300"
              }`}
            >
              {apiKey ? "연결됨" : "입력"}
            </button>
          </div>

          <div className="text-[11px] text-zinc-500">
            API 키는 브라우저 로컬에만 저장됩니다
          </div>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <div className="text-[11px] text-zinc-500">
              로그인 상태: {user ? "로그인됨" : "로그인 안 됨"}
            </div>
            {!user && (
              <button
                onClick={() => navigate("/login")}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-zinc-800 hover:bg-zinc-700 border border-zinc-700"
              >
                로그인
              </button>
            )}
          </div>
        </div>

        <button
          disabled={!apiKey}
          onClick={() => navigate("/app")}
          className={`w-full max-w-md h-16 rounded-2xl font-black text-xl transition-all ${
            apiKey
              ? "bg-yellow-400 text-black active:scale-95"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          AI 영상 제작 시작
        </button>

        {isKeyModalOpen && (
          <ApiKeyModal
            initialValue={apiKey}
            onClose={() => setIsKeyModalOpen(false)}
            onSaved={(k) => {
              localStorage.setItem("GEMINI_API_KEY", k);
              setApiKey(k);
              setIsKeyModalOpen(false);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Home;
