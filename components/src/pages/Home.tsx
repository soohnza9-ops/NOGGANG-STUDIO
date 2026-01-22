import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Video,
  Image as ImageIcon,
  Mic,
  Music,
  FileText,
  Presentation,
  Lock,
} from "lucide-react";

import ApiKeyModal from "../../ApiKeyModal";
import Dashboard from "../../Dashboard";

type Tool = {
  id: string;
  title: string;
  icon: React.ElementType;
  enabled: boolean;
};

const TOOLS: Tool[] = [
  { id: "video", title: "AI 자동화 영상 제작", icon: Video, enabled: true },
  { id: "image", title: "AI 사진 생성기", icon: ImageIcon, enabled: false },
  { id: "voice", title: "음성 & 자막 생성기", icon: Mic, enabled: false },
  { id: "lyrics", title: "음악 가사 싱크", icon: Music, enabled: false },
  { id: "script", title: "AI 대본 만들기", icon: FileText, enabled: false },
  { id: "thumb", title: "썸네일 제작", icon: Presentation, enabled: false },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [openKeyModal, setOpenKeyModal] = useState(false);

useEffect(() => {
  setApiKey(localStorage.getItem("GEMINI_API_KEY") || "");
}, []);

  const handleClick = (tool: Tool) => {
if (!apiKey) {
  setOpenKeyModal(true);
  return;
}


    if (!tool.enabled) return;
    navigate("/app");
  };


  return (
    <div className="flex-1">


 {/* Main */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 px-24 py-16">
<Dashboard
  onSelectTool={(toolId) => {
    if (!apiKey) {
      setOpenKeyModal(true);
      return;
    }

    if (toolId !== "video") return;
    navigate("/app");
  }}
/>

        </div>
      </main>

      {openKeyModal && (
        <ApiKeyModal
          initialValue={apiKey}
          onClose={() => setOpenKeyModal(false)}
          onSaved={(k) => {
            localStorage.setItem("GEMINI_API_KEY", k);
            setApiKey(k);
            setOpenKeyModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Home;
