// doubaoAsr.ts
import axios from 'axios';

const DOUBAO_ASR_URL = 'https://openapi.douyin.com/gateway/aasr/v1/recognize';
const ACCESS_TOKEN = '你的-access-token'; // 替换为实际 token 或动态获取

export async function doubaoASR(file: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, 'audio.wav');
  formData.append('model_name', 'asr_base');

  try {
    const res = await axios.post(DOUBAO_ASR_URL, formData, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return res.data.result || '';
  } catch (error) {
    console.error('豆包语音识别失败:', error);
    return '';
  }
}