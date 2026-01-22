
export interface UserAsset {
  id: string;
  url: string;
  type: 'image' | 'video';
  name: string;
}

export interface Scene {
  id: string;
  visualGroupId: string;
  visualPrompt: string;
  subtitle: string;

  estimatedDurationSeconds?: number;
  imageUrl?: string;
  audioData?: string;
  audioBuffer?: AudioBuffer;

  status: 'pending' | 'generating' | 'completed' | 'error';
  errorMessage?: string;
  isHeader: boolean;

  isUserAsset?: boolean;
  userAssetType?: 'image' | 'video';

  // ✅ TTS 묶음용
  breathId?: number;
}


export interface YouTubeMetadata {
  title: string;
  thumbnailText: string;
  description: string;
  hashtags: string[];
  subject: string;
}

export enum ArtStyle {
  PHOTOREALISTIC = 'Cinematic Photorealistic',
  REALISTIC = 'Hyper Realistic Photography, 8k resolution, raw photo',
  ANIME = 'Anime/Manga Style',
  CYBERPUNK = 'Cyberpunk Neon'
}

export type SubtitleSize = 'S' | 'M' | 'L';
export type AspectRatio = '16:9' | '9:16';

export type VoiceName = string;

export type InputMode = 'script' | 'prompt';

export interface VideoSettings {
  aspectRatio: AspectRatio;
  subtitleSize: SubtitleSize;
  subtitlePosition: number;
  subtitleColor: string;
  showSubtitleBox: boolean;
}

export interface AppState {
  script: string;
  scenes: Scene[];
  metadata: YouTubeMetadata | null;
  selectedStyle: ArtStyle;
  selectedVoice: VoiceName;
  voiceStylePrompt: string;
  bgmUrl: string | null;
  bgmVolume: number;
  referenceImage?: string; 
  userAssets: UserAsset[];
  isAnalyzing: boolean;
  error: string | null;
  characterPrompt: string;
  atmospherePrompt: string;
  videoSettings: VideoSettings;
  skipInitialImageGen: boolean; // 추가됨
}

export interface VisualGroupInfo {
  start: number;
  end: number;
  totalDuration: number;
}

export interface SceneTimelineEntry {
  start: number;
  end: number;
  scene: Scene;
  duration: number;
  audioOffsetInFullBuffer?: number;
}

export enum ToolType {
  DASHBOARD = "DASHBOARD",
  IMAGE_GEN = "IMAGE_GEN",
  VOICE_SUB = "VOICE_SUB",
  LYRICS_SYNC = "LYRICS_SYNC",
  SCRIPT_WRITER = "SCRIPT_WRITER",
  THUMBNAIL_GEN = "THUMBNAIL_GEN",
  VIDEO_AUTO = "VIDEO_AUTO",
  
}