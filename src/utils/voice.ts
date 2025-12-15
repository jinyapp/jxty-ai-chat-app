// utils/voice.ts - 语音相关工具函数
export interface VoiceConfig {
  sampleRate: number
  channelCount: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  sampleRate: 16000,
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

export const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/wav'
]

export function getSupportedMimeType(): string {
  for (const type of SUPPORTED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  return 'audio/webm'
}

export function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('m4a')) return 'm4a'
  return 'webm'
}

export function checkVoiceSupport(): {
  supported: boolean
  mediaDevices: boolean
  mediaRecorder: boolean
  webSocket: boolean
} {
  return {
    supported: !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' && typeof WebSocket !== 'undefined',
    mediaDevices: !!navigator.mediaDevices?.getUserMedia,
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    webSocket: typeof WebSocket !== 'undefined',
  }
}

export function calculateAudioLevel(dataArray: Uint8Array): number {
  const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
  return Math.min(average / 255, 1)
}

export function isVoiceActive(level: number, threshold: number = 0.02): boolean {
  return level > threshold
}

export class VoiceActivityDetector {
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly silenceThreshold: number
  private readonly silenceDuration: number
  private onSilenceDetected: () => void

  constructor(
    silenceThreshold: number = 0.02,
    silenceDuration: number = 3000,
    onSilenceDetected: () => void
  ) {
    this.silenceThreshold = silenceThreshold
    this.silenceDuration = silenceDuration
    this.onSilenceDetected = onSilenceDetected
  }

  update(audioLevel: number): void {
    const isActive = isVoiceActive(audioLevel, this.silenceThreshold)
    
    if (isActive) {
      this.clearSilenceTimer()
    } else if (!this.silenceTimer) {
      this.startSilenceTimer()
    }
  }

  private startSilenceTimer(): void {
    this.silenceTimer = setTimeout(() => {
      this.onSilenceDetected()
      this.silenceTimer = null
    }, this.silenceDuration)
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }

  destroy(): void {
    this.clearSilenceTimer()
  }
}
