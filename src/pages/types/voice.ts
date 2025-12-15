// types/voice.ts - 语音相关类型定义
export interface StreamVoiceState {
  recording: boolean
  processing: boolean
  interimText: string
  audioLevel: number
  speechSupported: boolean
}

export interface VoiceRecognitionResult {
  type: 'interim' | 'final' | 'error'
  text: string
  confidence: number
  timestamp: number
}

export interface WebSocketMessage {
  type: 'start' | 'stop' | 'interim' | 'final' | 'error' | 'connected'
  text?: string
  confidence?: number
  timestamp?: number
  sessionId?: string
  message?: string
}

export interface VoiceInputHookReturn {
  recording: boolean
  processing: boolean
  interimText: string
  audioLevel: number
  speechSupported: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
}

export interface MediaStreamConstraints {
  audio: {
    sampleRate: number
    channelCount: number
    echoCancellation: boolean
    noiseSuppression: boolean
    autoGainControl: boolean
  }
}

export interface AudioAnalyzerConfig {
  fftSize: number
  smoothingTimeConstant: number
  minDecibels: number
  maxDecibels: number
}

export const DEFAULT_AUDIO_ANALYZER_CONFIG: AudioAnalyzerConfig = {
  fftSize: 256,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
}
