/* eslint-disable no-empty-pattern */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import Chat, { MessageProps, useMessages, Bubble, Think, TypingBubble, RecorderHandle } from '@chatui/core';
import { Welcome } from '@ant-design/x';
import Slider from 'react-slick';
import { Button, message } from 'antd';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import '@chatui/core/dist/index.css';
import './../styles/chatui-theme.css';
import { marked } from 'marked';
import OpenAI from "openai";
import { startSpeechRecognition, speak } from '../utils/speech';

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-6080deca60b746ee9f703dd8bbe32cb2', dangerouslyAllowBrowser: true // 替换为你的 API Key
});

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
  { id: 1, text: '五一假期', icon: '🔥' },
  { id: 2, text: '世界读书日', icon: '🔥' },
  { id: 3, text: '如何办理太原文旅一卡通？', },
  { id: 4, text: '公交卡如何充值？', },
  { id: 5, text: '如何预约挂号？', },
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

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const Home = () => {
  const isMobile = useIsMobile();
  const { messages, appendMsg, updateMsg } = useMessages([]);
  const MAX_HISTORY = 20; // 最大对话轮数
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'system', content: '你是锦小绣，太原广播电视台打造的智能助手。在回答问题的时候，要做到真实性，要有所依据，并给出依据链接。而且保持实时性。' }
  ]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [enableVoice,] = useState(false);
  const [, setIsRecording] = useState(false);

  // const [enableVoice, setEnableVoice] = useState(false);
  // const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<RecorderHandle>(null!);

  async function handleSend(type: string, val: string) {
    if (type === 'text' && val.trim()) {
      const newHistory: ChatMessage[] = [...chatHistory, { role: 'user' as const, content: val }];
      if (newHistory.length > MAX_HISTORY * 2 + 1) {
        newHistory.splice(1, 2);
      }
      setChatHistory(newHistory);

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

      try {
        const completion = await openai.chat.completions.create({
          messages: chatHistory.concat({ role: 'user', content: val }),
          model: "deepseek-reasoner",
          stream: true,
        });

        let streamContent = '';
        let streamReasoningContent = '';
        const streamMsg = appendMsg({
          type: 'stream',
          content: { text: '' },
          position: 'left',
        });

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          const reasoningContent = (chunk.choices[0]?.delta as { reasoning_content?: string })?.reasoning_content || '';

          streamContent += content;

          streamReasoningContent += reasoningContent;
          if (streamReasoningContent) {
            updateMsg(thinkingMsg, {
              type: 'thinking',
              content: { text: `让我思考一下...\n\n${streamReasoningContent}` },
            });
          }

          updateMsg(streamMsg, {
            type: 'stream',
            content: { text: streamContent },
          });
        }

        if (streamContent) {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: streamContent
          }]);

          if (enableVoice && !isSpeaking) {
            try {
              setIsSpeaking(true);
              await speak(streamContent);
            } catch (error) {
              console.error('语音合成错误:', error);
            } finally {
              setIsSpeaking(false);
            }
          }
        }

      } catch (error) {
        console.error('API Error:', error);
        updateMsg(thinkingMsg, {
          type: 'text',
          content: { text: '抱歉，服务器出现了一些问题，请稍后再试。' },
        });
      }
    }
  }

  // const handleRecordStart = () => {
  //   setIsRecording(true);
  //   message.info('开始录音...');
  // };
  async function requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // 马上关闭
      return true;
    } catch (err) {
      console.error('麦克风权限被拒绝', err);
      message.error('无法访问麦克风，请手动开启权限');
      return false;
    }
  }
  const handleRecordStart = async () => {
    const allowed = await requestMicrophonePermission();
    if (!allowed) return;
  
    setIsRecording(true);
    message.info('开始录音...');
  };

  const handleRecordEnd = async () => {
    setIsRecording(false);
    message.loading('正在识别语音...');
    
    try {
      const transcript = await startSpeechRecognition();
      if (transcript) {
        message.success('语音识别成功');
        handleSend('text', transcript);
      }
    } catch (error: any) {
      console.error('语音识别错误:', error);
      // 错误消息已经在 startSpeechRecognition 中处理
    } finally {
      message.destroy(); // 清除 loading 消息
    }
  };

  const handleRecordCancel = () => {
    setIsRecording(false);
    message.info('已取消录音');
  };

  const renderMarkdown = (content: string) => marked.parse(content) as string;

  function renderMessageContent(msg: MessageProps) {
    const { type, content } = msg;

    switch (type) {
      case 'text':
        return <Bubble data-animation='fadeInUp' content={content.text} />;
      case 'stream':
        return (
          <TypingBubble
            data-animation='fadeInUp'
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

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'linear-gradient(97deg, #f2f9fe 0%, #f7f3ff 100%)',
      padding: isMobile ? '16px' : '24px',
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

      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.6)',
        borderRadius: '16px',
        marginBottom: '16px',
      }}>
        <Chat
          recorder={{
            canRecord: true,
            volume: 100,
            onStart: handleRecordStart,
            onEnd: handleRecordEnd,
            onCancel: handleRecordCancel,
            ref: recorderRef
          }}
          wideBreakpoint="800px"
          messages={messages}
          renderMessageContent={renderMessageContent}
          onSend={handleSend}
          onQuickReplyClick={handleQuickReplyClick}
          onImageSend={() => Promise.resolve()}
        />
      </div>
      {/* <VoiceSwitch /> */}
    </div>
  );
}
export default Home;    