import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const login = async () => {
    setMsg(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch {
      setMsg("로그인 실패: 이메일/비밀번호를 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    setMsg(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg("비밀번호 재설정 메일을 보냈습니다.");
    } catch {
      setMsg("재설정 메일 전송 실패: 이메일을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <div className="text-xl font-black text-white mb-2">로그인</div>
        <div className="text-sm text-zinc-400 mb-6">노깡스튜디오를 사용하려면 로그인 해주세요.</div>

        <div className="space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none"
            autoComplete="email"
          />
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            type="password"
            className="w-full px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-white outline-none"
            autoComplete="current-password"
          />

          {msg && <div className="text-sm text-yellow-300">{msg}</div>}

          <button
            onClick={login}
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-xl font-black bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-60"
          >
            로그인
          </button>

          <button
            onClick={reset}
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-xl font-black bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-60"
          >
            비밀번호 재설정 메일 보내기
          </button>

          <div className="text-[11px] text-zinc-600 font-bold pt-2">
            * 비밀번호가 기억나지 않으면 “재설정 메일”을 사용하세요.
          </div>
        </div>
      </div>
    </div>
  );
}
