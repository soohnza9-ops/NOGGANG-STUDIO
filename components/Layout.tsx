import React, { useMemo, useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Video,
  Image as ImageIcon,
  Mic,
  Music,
  FileText,
  Presentation,
  Lock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Header from "./Header";

type Tool = {
  id: string;
  title: string;
  icon: React.ElementType;
  enabled: boolean;
  to: string;
};

const TOOLS: Tool[] = [
  { id: "video", title: "AI 자동화 영상 제작", icon: Video, enabled: true, to: "/app" },
  { id: "image", title: "AI 사진 생성기", icon: ImageIcon, enabled: false, to: "/app" },
  { id: "voice", title: "음성 & 자막 생성기", icon: Mic, enabled: false, to: "/app" },
  { id: "lyrics", title: "음악 가사 싱크", icon: Music, enabled: false, to: "/app" },
  { id: "script", title: "AI 대본 만들기", icon: FileText, enabled: false, to: "/app" },
  { id: "thumb", title: "썸네일 제작", icon: Presentation, enabled: false, to: "/app" },
];

const Layout: React.FC = () => {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/app");

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const isActivePath = useMemo(() => {
    return location.pathname.startsWith("/app");
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === "/") {
      setSidebarOpen(true);
    } else if (location.pathname.startsWith("/app")) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
<div className="h-full bg-black text-white overflow-hidden flex flex-col">
      {/* Header (편집화면에서는 숨김) */}
      {!isEditor && <Header />}

      {/* 바디 영역 (헤더 아래) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-zinc-950 border-r border-zinc-800 flex-shrink-0 transition-all duration-200 sticky top-0 h-full ${
            sidebarOpen ? "w-64" : "w-14"
          }`}
        >
          {/* 닫힘 상태에서 여는 버튼 */}
          {!sidebarOpen && (
            <div className="px-3 py-4 flex justify-center">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
                aria-label="사이드바 열기"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* 섹션 타이틀 */}
          <div className="px-4 pt-4 pb-3">
            {sidebarOpen ? (
              <div className="w-full rounded-lg bg-zinc-800 px-4 py-2 flex items-center justify-between">
                <h3 className="text-xs font-black tracking-widest text-yellow-400 whitespace-nowrap">
                  AI TOOLS
                </h3>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(v => !v)}
                  className="ml-2 flex-shrink-0 p-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 transition"
                  aria-label="사이드바 접기"
                >
                  <ChevronLeft className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="h-4" />
            )}
          </div>

          {/* Nav */}
          <nav className="px-3 pb-6 space-y-1">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const disabled = !t.enabled;
              const active = t.id === "video" ? isActivePath : false;

              const base =
                "w-full flex items-center justify-center px-3 py-3 rounded-xl transition-colors";
              const enabledCls = active
                ? "bg-zinc-900 text-yellow-400"
                : "text-zinc-300 hover:bg-zinc-900 hover:text-yellow-400";
              const disabledCls = "text-zinc-600 cursor-not-allowed";

              const content = (
                <div
                  className={`flex items-center w-full ${
                    sidebarOpen ? "gap-3 justify-start" : "justify-center"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />

                  {sidebarOpen && (
                    <span className="flex-1 text-left truncate">{t.title}</span>
                  )}

                  {sidebarOpen && disabled && (
                    <Lock className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
              );

              if (disabled) {
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled
                    className={`${base} ${disabledCls}`}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <NavLink
                  key={t.id}
                  to={t.to}
                  className={({ isActive }) =>
                    `${base} ${isActive || active ? "bg-zinc-900 text-yellow-400" : enabledCls}`
                  }
                >
                  {content}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
<main className="flex-1 min-w-0 min-h-0">
  <div className="h-full overflow-y-auto overflow-x-hidden nog-scroll">
    <Outlet />
  </div>
</main>



      </div>
    </div>
  );
};

export default Layout;
