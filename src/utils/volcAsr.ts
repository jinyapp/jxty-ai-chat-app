import { getApiBaseUrl } from './env';

export async function volcAsr(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  // 假设后端有 /asr/volc 这个接口
  const resp = await fetch(getApiBaseUrl() + 'chat/doubao_asr', {
    method: 'POST',
    body: formData,
  });
  if (!resp.ok) throw new Error('语音识别失败');
  const data = await resp.json();
  return data.text || '';
}

// TypeScript type definition for module augmentation
export type VolcAsr = (audioBlob: Blob) => Promise<string>;