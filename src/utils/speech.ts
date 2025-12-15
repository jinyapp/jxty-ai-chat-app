import { message } from 'antd'; // 假设你使用 ant-design 的 message 提示

// ========================== 语音识别函数 ==========================
type RecognitionResultEvent = {
  results: {
    [index: number]: { [index: number]: { transcript: string } }
  };
};
type RecognitionErrorEvent = { error: string };
interface ISpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: (event: RecognitionResultEvent) => void;
  onerror: (event: RecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

export const startSpeechRecognition = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 兼容性检查
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      message.error('当前浏览器不支持语音识别');
      reject(new Error('浏览器不支持语音识别'));
      return;
    }

    const recognition = new SpeechRecognition();

    // 设置参数
    recognition.continuous = false; // 单次识别
    recognition.interimResults = false; // 不返回中间结果
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    let isRecognizing = true;

    // 成功回调
    recognition.onresult = (event: RecognitionResultEvent) => {
      if (!isRecognizing) return;
      isRecognizing = false;

      const transcript = event.results[0][0].transcript;
      console.log('语音识别结果:', transcript);
      resolve(transcript);
    };

    // 错误处理
    recognition.onerror = (event: RecognitionErrorEvent) => {
      if (!isRecognizing) return;
      isRecognizing = false;

      let errorMessage = '';
      switch (event.error) {
        case 'not-allowed':
          errorMessage = '未获得麦克风权限，请允许使用麦克风';
          break;
        case 'no-speech':
          errorMessage = '未检测到语音，请靠近麦克风并重新尝试';
          break;
        case 'network':
          errorMessage = '网络连接出错，请检查网络后重试';
          break;
        case 'aborted':
          errorMessage = '语音识别被取消';
          break;
        default:
          errorMessage = `语音识别失败: ${event.error}`;
      }

      message.error(errorMessage);
      reject(new Error(errorMessage));
    };

    // 结束回调
    recognition.onend = () => {
      console.log('语音识别结束');
    };

    // 超时处理（移动端常出现无响应）
    const timeoutId = setTimeout(() => {
      if (isRecognizing) {
        isRecognizing = false;
        recognition.stop();
        message.error('语音识别超时，请重试');
        reject(new Error('语音识别超时'));
      }
    }, 8000); // 8秒超时

    // 启动识别
    try {
      recognition.start();
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      message.error('启动语音识别失败，请重试');
      reject(error as Error);
    }
  });
};

// ========================== 语音合成函数 ==========================
export const speak = (text: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('浏览器不支持语音合成'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (e) => {
      console.error('语音合成错误', e);
      reject(new Error('语音合成失败'));
    };

    window.speechSynthesis.speak(utterance);
  });
};
