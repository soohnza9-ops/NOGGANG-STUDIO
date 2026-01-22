import React, { useState } from "react";
import {
  ImageIcon,
  Mic,
  Music,
  FileText,
  Presentation,
  Video,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import ApiKeyRequiredModal from "./ApiKeyRequiredModal";
interface DashboardProps {
  onSelectTool: (toolId: string) => void;
}

type Tool = {
  id: string;
  title: string;
  desc: React.ReactNode;

  icon: React.ElementType;
  color: string;
  enabled: boolean;
};

const Dashboard: React.FC<DashboardProps> = ({ onSelectTool }) => {
  const [lockedPulse, setLockedPulse] = useState<string | null>(null);
  const [showKeyRequired, setShowKeyRequired] = useState(false);
 const tools: Tool[] = [
  {
    id: "video",
    title: "AI 자동화 영상 제작",
    desc: (
  <>
    대본만 입력하면 장면 분석부터<br />
    영상 완성까지 자동으로 제작합니다.
  </>
),
    icon: Video,
    color: "bg-orange-500/10 text-orange-500",
    enabled: true,
  },
  {
    id: "image",
    title: "AI 사진 생성기",
    desc: (
  <>대본, 텍스트 입력만으로<br/>고퀄리티 이미지를 즉시 생성합니다.  </>
),
    icon: ImageIcon,
    color: "bg-blue-500/10 text-blue-500",
    enabled: false,
  },
  {
    id: "voice",
    title: "음성 & 자막 생성기",
    desc: (
  <>다양한 목소리로 음성을 만들고<br/>자막을 자동으로 추출합니다.  </>
),
    icon: Mic,
    color: "bg-green-500/10 text-green-500",
    enabled: false,
  },
  {
    id: "lyrics",
    title: "음악 가사 싱크",
    desc: (
  <>음악과 가사의 완벽한 싱크를 조절해<br/>음악 영상을 제작합니다. </>
),
    icon: Music,
    color: "bg-purple-500/10 text-purple-500",
    enabled: false,
  },
  {
    id: "script",
    title: "AI 대본 만들기",
    desc: (
  <>유튜브, 틱톡 쇼츠를 위한<br/>맞춤형 대본을 생성합니다. </>
),
    icon: FileText,
    color: "bg-yellow-500/10 text-yellow-500",
    enabled: false,
  },
  {
    id: "thumb",
    title: "썸네일 제작",
    desc: (
  <>클릭률을 높이는 감각적인 썸네일을<br/>간단하게 디자인합니다.</>
),
    icon: Presentation,
    color: "bg-red-500/10 text-red-500",
    enabled: false,
  },
];
 const handleToolClick = (toolId: string) => {
    const hasKey = !!localStorage.getItem("GEMINI_API_KEY");

    if (!hasKey) {
      setShowKeyRequired(true);
      return;
    }

    if (toolId === "video") {
      onSelectTool("video");
      return;
    }

    const tool = tools.find((t) => t.id === toolId);
    if (tool?.enabled) {
      onSelectTool(toolId);
      return;
    }

    setLockedPulse(toolId);
    window.setTimeout(() => setLockedPulse(null), 220);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
     <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-8 md:p-12">

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl md:text-3=4xl font-black mb-6 leading-tight">
            창작의 한계를 뛰어넘는 <br />
            <span className="text-yellow-400">AI 크리에이티브 스튜디오</span>
          </h1>
          <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
            최신 생성형 AI 기술을 활용하여 당신의 상상력을 현실로 만드세요. <br />
            복잡한 툴 없이, 단 한 번의 클릭으로 영상 콘텐츠를 완성합니다.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleToolClick("video")}
              className="px-8 py-4 bg-yellow-400 text-black font-bold rounded-2xl hover:bg-yellow-300 transition-all flex items-center gap-2 group"
            >
              지금 시작하기{" "}
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
            <button className="px-8 py-4 bg-zinc-800 text-white font-bold rounded-2xl hover:bg-zinc-700 transition-all">
              사용 가이드 보기
            </button>
          </div>
        </div>

        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-yellow-400/10 blur-[100px] rounded-full"></div>
<img
  src={import.meta.env.BASE_URL + "logo.png"}
  alt="NOGGANG STUDIO Logo"
  className="
    absolute right-6 top-6
    w-40 h-40
    opacity-10
    rotate-6
    pointer-events-none
    select-none
  "
/>
      </div>

      <div>
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold">도구 바로가기</h3>
          <span className="text-zinc-500 text-sm">
            모든 기능을 한눈에 확인하세요
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
 <button
                key={tool.id}
                onClick={() => handleToolClick(tool.id)}


className={`group relative flex flex-col text-left p-6 bg-zinc-900 border border-zinc-700 rounded-3xl transition-all duration-300 overflow-hidden ${
  tool.enabled
    ? "hover:border-yellow-400/60 hover:bg-zinc-850"
    : "opacity-85 hover:border-zinc-500"
}`}


              >


                <div className="flex items-center gap-4 mb-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${tool.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>

                  <h4 className="text-xl font-bold text-zinc-100 group-hover:text-yellow-400 transition-colors">
                    {tool.title}
                  </h4>
                </div>


                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
  {tool.desc}
</p>
                {tool.enabled ? (
                  <div className="absolute bottom-5 right-6 flex items-center gap-2 text-yellow-400 font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    이동하기 <ArrowUpRight className="w-4 h-4" />
                  </div>
                ) : (
                  <div
                    className={`absolute bottom-5 right-6 flex items-center gap-2 text-zinc-200 font-bold text-xs uppercase tracking-widest transition-transform duration-150 ${
                      lockedPulse === tool.id ? "scale-110" : "scale-100"
                    }`}
                  >
                    출시 예정<Lock className="w-4 h-4 text-yellow-400" />
                  </div>
                )}



                <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                  <Icon className="w-32 h-32" />
                </div>

                {!tool.enabled && (
                  <div className="absolute top-4 right-4">
                    <Lock className="w-4 h-4 text-zinc-700" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
           </div>

      {showKeyRequired && (
        <ApiKeyRequiredModal
          onClose={() => setShowKeyRequired(false)}
          onGoToKey={() => {
            setShowKeyRequired(false);
            document.dispatchEvent(new CustomEvent("open-api-key-modal"));
          }}
        />
      )}
    </div>
  );
};


export default Dashboard;
