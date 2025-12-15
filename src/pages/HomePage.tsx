import { Welcome, Sender } from '@ant-design/x';
import React, { useState, useEffect, useRef } from 'react';
import {
    FireOutlined,
    HeartOutlined,
    ReadOutlined,
    CommentOutlined,
    SmileOutlined,
} from '@ant-design/icons';
import { Prompts } from '@ant-design/x';
import { Bubble } from '@ant-design/x';
import { useXChat } from '@ant-design/x-sdk';
import {
  App,
  Card,
  ConfigProvider,
  Space,
  theme,
  Flex,GetProp
} from 'antd';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { post } from '../utils/request';

 

const renderTitle = (icon: React.ReactNode, title: string) => (
  <Space align="start">
    {icon}
    <span>{title}</span>
  </Space>
);

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

 

const items = [
  {
    key: '1',
    label: renderTitle(
      <FireOutlined
        style={{
          color: '#FF4D4F',
        }}
      />,
      '热点排行'
    ),
    description: '每日热点资讯排行',
    children: [
      {
        key: '1-1',
        description: `1、市委政法工作会议召开 韦韬书记做出批示`,
      },
      {
        key: '1-2',
        description: `2、《光阴的故事》：岁月如歌，回忆绵长`,
      },
      {
        key: '1-3',
        description: `3、山西发布住宅物业评星新规`,
      },
    ],
  },
  {
    key: '2',
    label: renderTitle(
      <ReadOutlined
        style={{
          color: '#1890FF',
        }}
      />,
      '旅游助手'
    ),
    description: '基于人工智能的旅游助手',
    children: [
      {
        key: '2-1',
        icon: <HeartOutlined />,
        description: `1、旅游线路规划`,
      },
      {
        key: '2-2',
        icon: <SmileOutlined />,
        description: `2、太原有什么好玩的地方？`,
      },
      {
        key: '2-3',
        icon: <CommentOutlined />,
        description: `3、太原游玩需要注意什么`,
      },
      // {
      //   key: '2-4',
      //   icon: <CommentOutlined />,
      //   description: `4、周末亲子游`,
      // },
    ],
  },
];
const roleConfig: GetProp<typeof Bubble.List, 'role'> = {
  ai: {
    placement: 'start',
  },
  local: {
    placement: 'end',
  },

};

 

const HomePage = () => {
  const isMobile = useIsMobile();
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState('');
  const abortRef = useRef(() => {});

  

  // 新的发送请求方法
  const handleSend = async (val) => {
    if (!val.trim()) return;
    setIsLoading(true);
    setContent('');
    
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
      
    } catch (e) {
      setContent('请求失败');
      
    } finally {
      setIsLoading(false);
    }
  };

  

  // Card部分的滑动设置
  const cardSliderSettings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: false,
    autoplaySpeed: 4000,
    vertical: false,  // 改为水平方向
    arrows: false
  };

  // Chat messages
  const { messages } = useXChat({
    // defaultMessages: [], // 添加默认消息
  });

  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  useEffect(() => {
    console.log('Loading state:', isLoading);
  }, [isLoading]);


  return (
    <App>
      <div
        style={{
          padding: isMobile ? '8px' : '16px',
          paddingBottom: isMobile ? 100 : 80,
          overflowY: 'auto',
        }}
      >
        <Welcome
          variant="borderless"
          icon="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*s5sNRo5LjfQAAAAAAAAAAAAADgCCAQ/fmt.webp"
          title={<div style={{ fontSize: isMobile ? '20px' : '24px' }}>你好！我是锦小绣</div>}
          description={
            <div style={{ fontSize: isMobile ? '14px' : '16px' }}>
              太原广播电视台打造的智能助手锦小绣，具备知识库管理、大语言模型对话、智能体提示词、生活服务助手等功能~
            </div>
          }
        />

        {/* <div
          style={{
            margin: isMobile ? '16px 0' : '24px 0',
            padding: '16px',
            background: 'linear-gradient(135deg, #f0f7ff 0%, #f5f0ff 100%)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{marginBottom: 8, fontWeight: 'bold'}}>内容：</div>
          <div style={{marginBottom: 16}}>{content}</div>
          <div style={{marginBottom: 8, fontWeight: 'bold'}}>推理内容：</div>
          <div>{reasoningContent}</div>
        </div> */}

        {/* <div
          style={{
            margin: isMobile ? '16px 0' : '24px 0',
            padding: '16px',
            background: 'linear-gradient(135deg, #f0f7ff 0%, #f5f0ff 100%)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <Slider {...sliderSettings}>
            {questionSuggestions.map((question) => (
              <div 
                key={question.id} 
                style={{ 
                  padding: '8px',
                  display: 'inline-block',
                  width: 'auto', // 自适应内容宽度
                }}
              >
                <Button
                  type="default"
                  icon={question.icon}
                  style={{
                    minWidth: isMobile ? '160px' : '200px', // 最小宽度
                    maxWidth: isMobile ? '240px' : '300px', // 最大宽度
                    width: 'auto', // 自适应内容
                    height: isMobile ? '60px' : '72px',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    border: '1px solid rgba(22,119,255,0.1)',
                    background: 'rgba(255,255,255,0.9)',
                    fontSize: isMobile ? '14px' : '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '12px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onClick={() => message.info(`选择了问题: ${question.text}`)}
                >
                  {question.text}
                </Button>
              </div>
            ))}
          </Slider>
          
        </div> */}

        <ConfigProvider
          theme={{
            algorithm: theme.defaultAlgorithm,
            token: {
              borderRadius: isMobile ? 12 : 8,
              padding: isMobile ? 12 : 16,
            },
          }}
        >
          <Card 
            style={{ 
              border: 0,
              overflow: 'hidden',
              position: 'relative',
              margin: '16px 0',
            }}
          >
            <Slider {...cardSliderSettings}>
              {[1, 2, 3].map((index) => (
                <div key={index}>
                  <Prompts
                    title="主题推荐"
                    items={items}
                    wrap
                    styles={{
                      // wrapper: {
                      //   height: isMobile ? '200px' : '240px',
                      //   padding: '16px',
                      // },
                      item: {
                        flex: 'none',
                        width: isMobile ? 'calc(50% - 8px)' : 'calc(33.33% - 16px)',
                        borderRadius: '12px',
                        padding: isMobile ? '12px 8px' : '16px',
                        fontSize: isMobile ? '14px' : '16px',
                        background: 'linear-gradient(135deg, #f8f9ff 0%, #f5f6ff 100%)',
                        border: '1px solid rgba(22,119,255,0.1)',
                        // transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        transform: 'translateY(0)',
                        transition: 'all 0.3s',
                            // ':hover': {
                            //   transform: 'translateY(-2px)',
                            //   boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            //   borderColor: '#1890ff',
                            // },
                        }
                    }}
                  />
                </div>
              ))}
            </Slider>
          </Card>
        </ConfigProvider>
      </div>

      <Flex
        vertical
        gap="middle"
        align="flex-start"
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#fff',
          padding: isMobile ? '12px 8px' : '16px',
          boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
          borderTopLeftRadius: isMobile ? '16px' : '0',
          borderTopRightRadius: isMobile ? '16px' : '0',
        }}
      >
      <Bubble.List
        role={roleConfig}
        // style={{ maxHeight: 300, overflowY: 'auto' }}
        items={messages.map(({ message, id, status }) => ({
          key: id,
          role: status === 'local' ? 'local' : 'ai',
          content: message,
          // loading: status === 'loading', // 添加加载状态
        }))}
      />
        <Sender
          style={{
            borderRadius: isMobile ? '20px' : '24px',
            fontSize: isMobile ? '14px' : '16px',
          }}
          loading={isLoading} // 使用 isLoading 状态
          value={content}
          onChange={setContent}
          onSubmit={handleSend}
          onCancel={() => {
            abortRef.current();
            setIsLoading(false);
          }}
          allowSpeech
        />
      </Flex>
    </App>
  );
};

export default HomePage;

