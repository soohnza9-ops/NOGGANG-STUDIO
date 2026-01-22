import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import { Key } from "lucide-react";
import ApiKeyModal from "./ApiKeyModal";

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const key = localStorage.getItem("GEMINI_API_KEY");
    setHasKey(!!key);
  }, [isKeyModalOpen]);
    useEffect(() => {
    const handler = () => setIsKeyModalOpen(true);
    document.addEventListener("open-api-key-modal", handler);
    return () => document.removeEventListener("open-api-key-modal", handler);
  }, []);


  const email = user?.email || "";
  const firstChar = email ? email[0].toUpperCase() : "";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 w-full bg-black/80 backdrop-blur-md border-b border-zinc-800 z-[9999] pointer-events-auto">
        <div className="w-full mx-auto px-6 h-16 flex items-center justify-between">
          {/* LEFT */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 hover:opacity-80"
          >
<img
  src={import.meta.env.BASE_URL + "logo.png"}
  alt="노깡 로고"
  className="w-9 h-9 object-contain"

              draggable={false}
            />
            <h1 className="text-lg font-black text-white">노깡 STUDIO</h1>
          </button>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* API KEY */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className={`px-3 py-2 rounded-xl text-xs font-black border flex items-center gap-1.5 ${
  hasKey
    ? "bg-zinc-900 border-emerald-600 text-emerald-400"
    : "bg-yellow-400 text-black border-yellow-300"
}`}

            >
              <Key className="w-4 h-4" />
              {hasKey ? "API KEY 등록됨" : "API KEY 입력"}
            </button>

            {user ? (
              <>
                {/* USER INFO */}
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <div className="w-7 h-7 rounded-full bg-yellow-400 text-black font-black text-sm flex items-center justify-center">
                    {firstChar}
                  </div>
                  <span className="text-xs text-zinc-200 max-w-[160px] truncate">
                    {email}
                  </span>
                </div>

                {/* LOGOUT */}
                <button
                  onClick={() => signOut(auth)}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="px-4 py-2 rounded-xl text-xs font-black bg-yellow-400 hover:bg-yellow-300 text-black"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* API KEY MODAL */}
      {isKeyModalOpen && (
        <ApiKeyModal
  initialValue={localStorage.getItem("GEMINI_API_KEY") || ""}
  onClose={() => setIsKeyModalOpen(false)}
  onSaved={(key) => {
    localStorage.setItem("GEMINI_API_KEY", key);
    setHasKey(!!key);
    setIsKeyModalOpen(false);
  }}
/>

      )}
    </>
  );
};

export default Header;
