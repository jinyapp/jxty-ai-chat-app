import { useState, useEffect,useRef  } from 'react';
import Chat, { MessageProps, useMessages, Bubble, Think, TypingBubble, ToolbarItemProps } from '@chatui/core';
import { Welcome } from '@ant-design/x';
import Slider from 'react-slick';
import { Button } from 'antd';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import '@chatui/core/dist/index.css';
import './../styles/chatui-theme.css';
import './../styles/chat.css';
import { marked } from 'marked';
import OpenAI from "openai";
import { doubaoASR } from '../utils/doubaoAsr';
import { post } from '../utils/request';

// 判断是否是 Hybrid App 环境
const isHybridApp = () => {
  return typeof window.NativeBridge !== 'undefined' && window.NativeBridge?.startVoiceRecognition;
};
//官方版本
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-6080deca60b746ee9f703dd8bbe3', dangerouslyAllowBrowser: true // 替换为你的 API Key
});
//豆包火山引擎
// const openai = new OpenAI({
//   apiKey: process.env['ARK_API_KEY'],
//   baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
//   dangerouslyAllowBrowser: true
// });
// Markdown 渲染函数
// const renderMarkdown = (content: string) => marked.parse(content) as string;
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

const questionSuggestions = [
  { id: 1, text: '社保如何查询', icon: '🔥' },
  { id: 2, text: '世界读书日',  icon: '🔥'},
  { id: 3, text: '如何办理太原文旅一卡通？', },
  { id: 4, text: '公交卡如何充值？',  },
  { id: 5, text: '如何预约挂号？',  },
  { id: 6, text: '公积金如何提取？', icon: '🔥' },
];

const sliderSettings = {
  dots: false,
  infinite: true,
  speed: 2000,
  slidesToShow: 3,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 1000,
  rows: 2,
  responsive: [
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 2,
        rows: 2
      }
    }
  ]
};

const toolbar: ToolbarItemProps[] = [
  {
    type: "image",
    icon: "image",
    title: "图片",
  },
  {
    type: "camera",
    icon: "camera",
    title: "拍照",
  },
];

const getUserInfo = () => {
  return new Promise((resolve) => {
    if (window.setupWebViewJavascriptBridge) {
      window.setupWebViewJavascriptBridge(function (bridge) {
        bridge.callHandler('getIsclientstate', {}, function (data) {
          let userInfo;
          try {
            userInfo = typeof data === 'string' ? JSON.parse(data) : data;
          } catch (e) {
            userInfo = data;
          }
          if (!userInfo || !userInfo.account) {
            userInfo = { account: 'admin', password: '112233445566' };
          }
          resolve(userInfo);
        });
      });
    } else {
      resolve({ account: 'admin', password: '112233445566' });
    }
  });
};

const Home = () => {
  // const msgRef = useRef(null);
  // const msgRef = useRef('');
  // const typingMsgId = useRef('');
  const isMobile = useIsMobile();
  // @ts-ignore: 'inputValue' is declared but its value is never read.
  const [inputValue, setInputValue] = useState('');
  const { messages, appendMsg, updateMsg } = useMessages([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [content, setContent] = useState('');
  const [reasoningContent, setReasoningContent] = useState('');

  useEffect(() => {
    getUserInfo().then((info) => setUserInfo(info));
  }, []);

  // 发送消息
  async function handleSend(type: string, val: string) {
    if (type === 'text' && val.trim()) {
      appendMsg({
        type: 'text',
        content: { text: val },
        position: 'right',
      });

      const thinkingMsg = appendMsg({
        type: 'thinking',
        content: { text: '让我思考一下...' },
        position: 'left',
      });

      setContent('');
      setReasoningContent('');
      try {
        const body = {
          max_tokens: 1024,
          model: 'deepseek-reasoner',
          temperature: 0.5,
          top_p: 1,
          presence_penalty: 0,
          frequency_penalty: 0,
          messages: [{ role: 'user', content: val }],
          stream: true,
          kid: '',
          chat_type: 0,
          appId: ''
        };
        const res = await post('http://localhost:1003/api/chat/send', body);
        setContent(res.content || '');
        setReasoningContent(res.reasoning_content || '');
        updateMsg(thinkingMsg, {
          type: 'text',
          content: { text: (res.content || '') + '\n' + (res.reasoning_content || '') },
        });
      } catch (error) {
        setContent('请求失败');
        setReasoningContent('');
        updateMsg(thinkingMsg, {
          type: 'text',
          content: { text: '抱歉，服务器出现了一些问题，请稍后再试。' },
        });
      }
    }
  }
  
  const renderMarkdown = (content: string) => marked.parse(content) as string;

   // 渲染消息内容
   function renderMessageContent(msg: MessageProps) {
    const { type, content } = msg;

    switch (type) {
      case 'text':
        return <Bubble data-animation="fadeInUp" content={content.text} />;
      case 'stream':
        return (
          <TypingBubble
            data-animation="fadeInUp"
            content={content.text}
            messageRender={renderMarkdown}
            isRichText
            options={{ step: [1, 4], interval: 50 }}
          />
        );
      case 'image':
        return (
          <Bubble type="image">
            <img src={content.picUrl} alt="" />
          </Bubble>
        );
      case 'thinking':
        return (
          <Bubble>
            <Think isDone={false}>
              <p>{content.text}</p>
            </Think>
          </Bubble>
        );
      default:
        return null;
    }
  }
  
  function handleQuickReplyClick(item: { name: string }) {
    handleSend('text', item.name);
  }

  function handleToolbarClick(item: ToolbarItemProps) {
    if (item.type === "orderSelector") {
      appendMsg({
        type: "order-selector",
        content: {},
      });
    }
  }
 // Web Speech API 语音识别（仅限 Chrome 等支持的浏览器）
   // @ts-ignore: 'startWebSpeechRecognition' is declared but its value is never read.
 const startWebSpeechRecognition = (callback: (text: string) => void) => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
  

    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log(event.results[0][0]);
      console.log('语音识别结果:', transcript); 
      callback(transcript);
    };

    recognition.onerror = (event) => {
      let errorMessage = '语音识别出错:';
      switch (event.error) {
        case 'network':
          errorMessage += ' 网络错误，请检查连接。尝试使用备用方案...';
          // 切换到备用方案
          startAudioRecordAndUpload(callback);
          break;
        default:
          errorMessage += ` ${event.error}`;
          console.error(errorMessage);
          alert(errorMessage); // 或者使用 toast 提示等更友好的方式
      }
    };

    recognition.start();
  } else {
    alert('当前浏览器不支持 Web Speech API，正在使用备用方案...');
    startAudioRecordAndUpload(callback);
  }
};

// 使用 MediaRecorder 录音并上传到豆包 ASR（备用方案）
const startAudioRecordAndUpload = (callback: (text: string) => void) => {
  if (mediaRecorderRef.current) {
    console.warn('已经有录音实例在运行');
    return;
  }

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        try {
          const recognizedText = await doubaoASR(audioBlob);
          callback(recognizedText);
        } catch (err) {
          console.error('ASR 失败:', err);
          alert('语音识别失败，请重试');
        }
      };

      mediaRecorder.start();
      console.log('✅ 开始录音');
    })
    .catch((err) => {
      console.error('获取媒体权限失败:', err);
      alert('无法访问麦克风，请检查权限设置');
    });
};

// Hybrid App 原生语音识别
const startNativeVoiceRecognition = (callback: (text: string) => void) => {
  window.NativeBridge.startVoiceRecognition((recognizedText: string) => {
    if (recognizedText) {
      callback(recognizedText);
    }
  });
};

// 统一入口：根据环境选择合适的语音识别方式
const startVoiceRecognition = (callback: (text: string) => void) => {
  // if (isHybridApp()) {
  //   startNativeVoiceRecognition(callback);
  // } else if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  //   startWebSpeechRecognition(callback);
  // } else {
  //   // 备用方案：录音后上传到豆包 ASR
  //   startAudioRecordAndUpload(callback);
  // }

  if (isHybridApp()) {
    startNativeVoiceRecognition(callback);
  } else {
    // 直接使用 MediaRecorder + doubaoASR 作为唯一方案
    startAudioRecordAndUpload(callback);
  }
};
// onStart：用户按住输入框时触发，立即开始录音
const handleRecorderStart = () => {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
    console.warn('录音已经在进行中');
    return;
  }
  // console.log('开始录音');
  startVoiceRecognition((recognizedText) => {
    console.log('识别结果:', recognizedText); // 先打印看看是什么类型
    if (recognizedText && typeof recognizedText === 'string') {
      setInputValue(recognizedText);
      handleSend('text', recognizedText);
    }
  });
};
// onEnd：用户松手时触发，结束录音
// const handleRecorderEnd = () => {
//   if (isHybridApp()) {
//     window.NativeBridge.stopVoiceRecognition();
//   } else if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
//     // 对于支持 Web Speech API 的环境，不需要额外处理
//     return;
//   } else {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
//       mediaRecorderRef.current.stop();
//       console.log('MediaRecorder 已停止');
//     }
//   }
// };

const handleRecorderEnd = () => {
  console.log('⏹️ 结束录音');
  if (isHybridApp()) {
    window.NativeBridge.stopVoiceRecognition();
  } else {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // 必须显式 stop()
      console.log('✅ MediaRecorder 已停止');
    }
  }
};
  // recorder 属性配置
  const recorderProps = {
    canRecord: true,
    volume: 0.6,
    onStart: () => {
      console.log('开始录音');
      handleRecorderStart()
    },
    onEnd: () => {
      console.log('结束录音');
      handleRecorderEnd()
      // startVoiceRecognition((recognizedText) => {
      //   if (recognizedText) {
      //     console.log('识别结果:', recognizedText); // 先打印看看是什么类型
      //     if (typeof recognizedText === 'string') {
      //       setInputValue(recognizedText);
      //       handleSend('text', recognizedText);
      //     }
      //   }
      // });
    },
    onCancel: () => {
      console.log('取消录音');
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    },
  };
  return (
    <div className="chat-container" style={{ 
      padding: isMobile ? '16px' : '50px',
    }}>
      <Welcome
        style={{
          borderRadius: '16px',
        }}
        variant="borderless"
        icon="https://ai-tool-1255431317.cos.ap-beijing.myqcloud.com/202504291722214.gif"
        title={<div style={{ fontSize: isMobile ? '20px' : '24px' }}>你好！我是锦小绣</div>}
        description={
          <div style={{ fontSize: isMobile ? '14px' : '16px' }}>
            太原广播电视台打造的智能助手锦小绣，具备知识库管理、大语言模型对话、智能体提示词、生活服务助手等功能~
          </div>
        }
      />
      {/* 新增内容展示 */}
      <div style={{marginBottom: 8, fontWeight: 'bold'}}>内容：</div>
      <div style={{marginBottom: 16}}>{content}</div>
      <div style={{marginBottom: 8, fontWeight: 'bold'}}>推理内容：</div>
      <div>{reasoningContent}</div>
      
      <div style={{
        margin: isMobile ? '0px 0' : '16px 0',
        padding: '16px',
        borderRadius: '16px',
      }}>
        <Slider {...sliderSettings}>
          {questionSuggestions.map((question) => (
            <div 
              key={question.id} 
              style={{ 
                padding: '8px',
                display: 'inline-block',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <Button
                type="default"
                icon={question.icon}
                style={{
                  width: '90%',
                  minHeight: isMobile ? '60px' : '72px',
                  height: 'auto',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  border: '1px solid rgba(22,119,255,0.1)',
                  background: 'rgba(255,255,255,0.9)',
                  fontSize: isMobile ? '14px' : '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: '0 auto',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.4',
                }}
                onClick={() => handleSend('text', question.text)}
              >
                {question.text}
              </Button>
            </div>
          ))}
        </Slider>
      </div>

      <div className="chat-messages-container">
        <Chat
          toolbar={toolbar}
          // messagesRef={msgRef}
          onToolbarClick={handleToolbarClick}
          recorder={recorderProps}
          wideBreakpoint="800px"
          messages={messages}
          renderMessageContent={renderMessageContent}
          onSend={handleSend}
          onQuickReplyClick={handleQuickReplyClick}
          onImageSend={() => Promise.resolve()}
        />
      </div>
    </div>
  );
}
export default Home;