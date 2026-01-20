import React, { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../services/firebase";

const Header: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  return (
    <header className="w-full bg-black/80 backdrop-blur-md border-b border-zinc-800 sticky top-0 z-50">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 ml-16">
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center">
  <img
    src="/logo.png"
    alt="노깡 로고"
    className="w-10 h-10 object-contain"
    draggable={false}
  />
</div>

          <h1 className="text-xl font-bold text-white tracking-tight">
            노깡 STUDIO
          </h1>
        </div>

        <div className="flex items-center gap-2">
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
  );
};

export default Header;
