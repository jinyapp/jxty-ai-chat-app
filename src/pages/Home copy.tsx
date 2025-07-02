import { useState, useEffect,  } from 'react';
import Chat, { MessageProps, useMessages, Bubble, Think, TypingBubble, ToolbarItemProps } from '@chatui/core';
import { Welcome } from '@ant-design/x';
import Slider from 'react-slick';
import { Button } from 'antd';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import '@chatui/core/dist/index.css';
import './../styles/chatui-theme.css';
import { marked } from 'marked';
import OpenAI from "openai";


const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-11' , dangerouslyAllowBrowser: true // 替换为你的 API Key
});

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
  { id: 1, text: '五一假期', icon: '🔥' },
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

const Home = () => {
  // const msgRef = useRef(null);
  // const msgRef = useRef('');
  // const typingMsgId = useRef('');
  const isMobile = useIsMobile();
  const { messages, appendMsg, updateMsg } = useMessages([]);

  async function handleSend(type: string, val: string) {
    if (type === 'text' && val.trim()) {
      // 发送用户消息
      appendMsg({
        type: 'text',
        content: { text: val },
        position: 'right',
      });
  
      // 添加初始思考状态
      const thinkingMsg = appendMsg({
        type: 'thinking',
        content: { text: '让我思考一下...' },
        position: 'left',
      });
  
      try {
        // 创建流式响应
        const completion = await openai.chat.completions.create({
          messages: [
            { role: "system", content: "你是锦小绣，太原广播电视台打造的智能助手。" },
            { role: "user", content: val }
          ],
          // model: "deepseek-chat",
          model: "deepseek-reasoner",
          stream: true,
        });
  
        let streamContent = '';
        let streamReasoningContent = '';
        // 更新为流式消息
        const streamMsg = appendMsg({
          type: 'stream',
          content: { text: '' },
          position: 'left',
        });
  
        // 处理流式响应
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          // const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || '';  
          const reasoningContent = (chunk.choices[0]?.delta as { reasoning_content?: string })?.reasoning_content || '';

          streamContent += content;
  
          // 如果存在推理过程，动态更新思考状态
          streamReasoningContent+=reasoningContent
          if (streamReasoningContent) {
            updateMsg(thinkingMsg, {
              type: 'thinking',
              content: { text: `让我思考一下...\n\n${streamReasoningContent}` },
            });
          }
  
          // 动态更新消息内容
          updateMsg(streamMsg, {
            type: 'stream',
            content: { text: streamContent },
          });
        }

        // // 删除思考状态消息
        // const thinkingIndex = messages.indexOf(thinkingMsg);
        // if (thinkingIndex > -1) {
        //   messages.splice(thinkingIndex, 1);
        // }
  
      } catch (error) {
        console.error('API Error:', error);
        updateMsg(thinkingMsg, {
          type: 'text',
          content: { text: '抱歉，服务器出现了一些问题，请稍后再试。' },
        });
      }
    }
  }
  
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
      case 'thinking': // 新增思考状态渲染逻辑
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
        // icon="https://ai-tool-1255431317.cos.ap-beijing.myqcloud.com/ai-chat%2F%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_20250424154544.png"
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
          toolbar={toolbar}
          // messagesRef={msgRef}
          onToolbarClick={handleToolbarClick}
          recorder={{ canRecord: true }}
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