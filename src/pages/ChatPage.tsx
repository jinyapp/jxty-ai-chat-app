import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bubble, Sender, Think, Welcome } from '@ant-design/x'
import XMarkdown from '@ant-design/x-markdown'
import type { BubbleListRef, BubbleItemType } from '@ant-design/x/es/bubble/interface'
import Slider from 'react-slick'
import { Space, Spin, Button, message, Progress, Typography } from 'antd'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import './../styles/chat.css'
import './../styles/voice.css'
import { authFetch, ensureAuth } from '../utils/auth'
import { post } from '../utils/request'

import { 
  OpenAIOutlined, 
  AudioOutlined, 
  FormOutlined, 
  ArrowLeftOutlined,
  StopOutlined 
} from '@ant-design/icons'

const { Text } = Typography

const VOICE_ENABLED = (() => {
  const v = String(import.meta.env.VITE_APP_ENABLE_VOICE ?? 'true').toLowerCase()
  return v === 'true' || v === '1' || v === 'on'
})()

// 流式语音识别 Hook
function useStreamVoiceInput(onResult: (text: string) => Promise<void>) {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const speechSupported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

  // 音频级别检测
  const updateAudioLevel = () => {
    if (!analyserRef.current || !recording) return
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = average / 255
    setAudioLevel(normalizedLevel)
    
    // VAD - 语音活动检测
    const isVoiceActive = normalizedLevel > 0.02
    
    if (isVoiceActive) {
      // 检测到语音，清除静音计时器
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }
    } else if (recording && !silenceTimerRef.current) {
      // 开始静音计时 - 3秒无声音自动停止
      silenceTimerRef.current = setTimeout(() => {
        console.log('检测到静音，自动停止录制')
        stopRecording()
      }, 3000)
    }
    
    if (recording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
    }
  }

  // 初始化 WebSocket 连接
  const initWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/speech`
    wsRef.current = new WebSocket(wsUrl)
    
    wsRef.current.onopen = () => {
      console.log('语音识别 WebSocket 连接成功')
      // 发送开始信号
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'start' }))
      }
    }
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('收到语音识别结果:', data)
        
        if (data.type === 'interim') {
          // 实时识别结果
          setInterimText(data.text || '')
        } else if (data.type === 'final') {
          // 最终识别结果
          const finalText = data.text || ''
          if (finalText.trim()) {
            onResult(finalText)
          }
          setInterimText('')
          setProcessing(false)
        } else if (data.type === 'error') {
          console.error('语音识别错误:', data.message)
          message.error(data.message || '语音识别失败')
          setProcessing(false)
        }
      } catch (error) {
        console.error('解析语音识别消息失败:', error)
      }
    }
    
    wsRef.current.onerror = (error) => {
      console.error('语音识别 WebSocket 错误:', error)
      message.error('语音识别连接失败')
      setProcessing(false)
    }
    
    wsRef.current.onclose = () => {
      console.log('语音识别 WebSocket 连接关闭')
      setProcessing(false)
    }
  }

  // 开始录制
  const startRecording = async () => {
    if (!speechSupported) {
      message.error('设备不支持语音录制')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      mediaStreamRef.current = stream
      
      // 创建音频上下文用于分析
      const AC = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || AudioContext
      audioContextRef.current = new AC({ sampleRate: 16000 })
      const source = audioContextRef.current.createMediaStreamSource(stream)
      
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      
      // 初始化 WebSocket
      initWebSocket()
      
      // 创建 MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm'
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType })
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // 发送音频数据到 WebSocket
          wsRef.current.send(event.data)
        }
      }
      
      mediaRecorderRef.current.start(200) // 每200ms发送一次数据
      setRecording(true)
      
      // 开始音频级别检测
      updateAudioLevel()
      
      // 设置最大录制时间 60秒
      recordTimerRef.current = setTimeout(() => {
        stopRecording()
        message.warning('录制时间超过60秒，自动停止')
      }, 60000)
      
    } catch (error) {
      console.error('开始录制失败:', error)
      message.error('无法访问麦克风，请检查权限设置')
    }
  }

  // 停止录制
  const stopRecording = () => {
    setRecording(false)
    setProcessing(true)
    
    // 清理计时器
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current)
      recordTimerRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    // 停止录制
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    
    // 发送停止信号到 WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }
    
    // 停止媒体流
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    
    // 关闭音频上下文
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // 延迟关闭 WebSocket，等待最终结果
    setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
      setAudioLevel(0)
    }, 2000)
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (recording) {
        stopRecording()
      }
    }
  }, [])

  return {
    recording,
    processing,
    interimText,
    audioLevel,
    speechSupported,
    startRecording,
    stopRecording
  }
}

// 传统语音识别 Hook (备用)
function useVoiceInput(onResult: (text: string) => Promise<void>) {
  const [recording, setRecording] = useState(false)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<BlobPart[]>([])
  const recordMimeTypeRef = useRef<string>('')

  const speechSupported = !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia)

  function getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/wav']
    for (const t of types) { 
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t 
    }
    return ''
  }

  function mimeToExt(mime: string): string {
    if (!mime) return 'webm'
    if (mime.includes('webm')) return 'webm'
    if (mime.includes('ogg')) return 'ogg'
    if (mime.includes('wav')) return 'wav'
    if (mime.includes('mp3')) return 'mp3'
    if (mime.includes('m4a')) return 'm4a'
    return 'webm'
  }

  async function start() {
    if (!speechSupported) { 
      message.error('设备不支持语音录制')
      return 
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mime = getSupportedMimeType()
      recordMimeTypeRef.current = mime
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      recordChunksRef.current = []
      mr.ondataavailable = (e) => { 
        const d = (e as unknown as BlobEvent).data
        if (d && d.size > 0) recordChunksRef.current.push(d) 
      }
      mr.start()
      setRecording(true)
    } catch (error) {
      message.error('请允许使用麦克风')
      setRecording(false)
    }
  }

  async function stop(): Promise<Blob | null> {
    const mr = mediaRecorderRef.current
    if (!mr) return null
    return new Promise((resolve) => {
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: recordMimeTypeRef.current || 'audio/webm' })
        resolve(blob)
      }
      mr.stop()
      const s = mediaStreamRef.current
      if (s) { 
        s.getTracks().forEach(t => t.stop())
        mediaStreamRef.current = null 
      }
      mediaRecorderRef.current = null
    })
  }

  async function transcribe(blob: Blob): Promise<string> {
    const ext = mimeToExt(blob.type)
    const file = new File([blob], `recording.${ext}`, { type: blob.type || 'application/octet-stream' })
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data: unknown = await post('chat/audio', fd)
      const text =
        typeof data === 'string' ? data :
        (data && typeof data === 'object' && typeof (data as Record<string, unknown>).text === 'string') ? (data as Record<string, unknown>).text as string :
        (data && typeof data === 'object' && (data as Record<string, unknown>).data && typeof ((data as Record<string, unknown>).data as Record<string, unknown>).text === 'string') ? (((data as Record<string, unknown>).data as Record<string, unknown>).text as string) : ''
      return text
    } catch (err: unknown) {
      const code = (err as { response?: { status?: number } })?.response?.status
      if (code === 401) message.error('语音服务鉴权失败')
      else if (code === 413) message.error('语音文件过大')
      else if (code === 429) message.error('语音服务繁忙，请稍后再试')
      else message.error('语音识别服务暂时不可用')
      return ''
    }
  }

  const stopAndSend = async () => {
    try {
      const blob = await stop()
      if (blob && blob.size > 0) {
        const text = await transcribe(blob)
        if (text) await onResult(text)
        else message.error('未识别到有效语音')
      } else {
        message.error('未检测到语音，请重试')
      }
    } finally {
      setRecording(false)
    }
  }

  return { recording, speechSupported, start, stop, stopAndSend }
}

// 常量配置
const CHAT_UI_CONFIG = { showBackButton: true }

const assistantNameMap: Record<string, string> = {
  travel: '出行助手',
  cooking: '做饭助手',
  translation: '翻译助手',
  writing: '写作助手',
  news: '新闻资讯助手',
  weather: '天气预报助手',
  mentalHealth: '心理健康助手',
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

const questionSuggestions = [
  { id: 1, text: '社保如何查询', icon: '🔥' },
  { id: 2, text: '公积金如何提取？', icon: '🔥' },
  { id: 3, text: '地上文物看山西' },
  { id: 4, text: '公交卡如何充值？' },
  { id: 5, text: '如何预约挂号？' },
  { id: 6, text: '今日热点资讯', icon: '🔥' },
]

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
    { breakpoint: 768, settings: { slidesToShow: 2, rows: 2 } },
  ],
}

const assistantPrompts: Record<string, string> = {
  travel: '你是"锦小绣·出行助手"，专注为用户规划太原及周边一日游或多日行程。请基于晋祠、双塔寺、汾河公园、青龙古镇、蒙山大佛等本地景点，结合当前季节、开放时间（如已知）和公共交通（地铁2号线、公交线路等），给出清晰、可执行的路线建议。若用户未指定日期，默认按"今天"或"近期周末"规划。所有景区信息若引用官方数据，请注明来源，例如："（据太原市文旅局2025年4月公告）"。',
  cooking: '你是"锦小绣·做饭助手"，擅长用山西本地食材（如老陈醋、小米、莜面、平遥牛肉、沁州黄小米）设计家常菜。请提供完整菜谱：包括食材清单、详细步骤、火候说明、烹饪时长，并标注是否适合老人、儿童或节气养生。避免复杂西餐或需专业厨具的菜品。若参考特定食谱或民俗传统，请自然融入来源，例如："这道菜源自山西民间立夏习俗"。',
  translation: '你是"锦小绣·翻译助手"，仅支持中英文互译，适用于菜单、路牌、日常对话等生活场景。请确保译文准确、自然、简洁。不处理法律、医学、金融等专业内容；若遇敏感或不当文本，请直接回复："抱歉，我无法翻译该内容。" 翻译结果无需额外解释或标注来源，除非用户明确要求验证术语。',
  writing: '你是"锦小绣·写作助手"，帮助用户撰写社区通知、办事申请、活动倡议书、感谢信等实用文书。请使用正式、简洁、得体的中文，符合基层政务沟通规范。每份文案应包含标题、正文、落款三部分，语言贴近市民。若参考标准模板，请自然注明，例如："格式参考政务服务网通用申请书范例"。不生成诗歌、小说、广告或虚构内容。',
  news: '你是"锦小绣·新闻助手"，请整理近3天内太原本地热点新闻（不超过5条），聚焦民生、交通、文旅、政策。每条须包含：事件简述 + 发生时间。**所有新闻必须来自锦绣太原APP、太原广电网（sxtygdy.com）、太原日报；但你不得自行构造URL。若你知道某条新闻在锦绣太原APP的具体页面（如 /news/12345），可提供链接；否则，仅输出新闻内容，不附任何链接。** 示例："1. 【交通】太原地铁1号线南段4月10日试运行。"',
  weather: '你是"锦小绣·天气助手"，请明确回答用户所问日期的天气情况。若用户未指定日期，默认提供"今天"和"明天"的预报。覆盖太原六城区（迎泽、杏花岭、小店、尖草坪、万柏林、晋源）及清徐、阳曲等县区。每条回复需包含：日期、白天/夜间天气、气温范围、空气质量（AQI）、生活建议（如穿衣、出行）。所有数据以中国天气网为准，末尾统一标注："（数据来源：中国天气网）"。例如："今天（4月5日）太原晴，12~22℃，AQI 45，适宜户外活动。（数据来源：中国天气网）"',
  mentalHealth: '你是"锦小绣·心理陪伴者"，可提供情绪倾听、正念呼吸指导、简易减压练习（如"478呼吸法"）。每次回应应温暖、非评判，并在首次或关键节点强调："我不是持证心理咨询师，无法提供诊断或治疗。如有持续焦虑、抑郁或危机情况，请立即联系太原市心理援助热线：0351-12320 转 5（24小时）。" 所有建议须基于国家权威心理健康科普内容，并自然注明来源，例如："该练习参考国家心理健康和精神卫生防治中心2024年公众指南"。',
}

type ChatMessage = {
  id: string
  status?: 'local' | 'loading' | 'updating' | 'success' | 'error' | 'abort'
  message: { role: 'user' | 'assistant'; content: string }
  extraInfo?: { prevUserText?: string }
}

const ChatPage = () => {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const assistantType = params.get('assistant') || ''

  // 使用流式语音识别
  const streamVoice = useStreamVoiceInput(async (text) => { 
    setInputValue(text)
    await handleSend(text) 
  })

  // 备用传统语音识别
  const fallbackVoice = useVoiceInput(async (text) => { 
    setInputValue(text)
    await handleSend(text) 
  })
  void fallbackVoice

  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [voiceCancel, setVoiceCancel] = useState(false)
  const touchStartYRef = useRef<number | null>(null)
  const isPressingRef = useRef(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasChatStarted, setHasChatStarted] = useState<boolean>(!!assistantType)
  const welcomeSentRef = useRef<Record<string, boolean>>({})
  const [inputValue, setInputValue] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [authError, setAuthError] = useState(false)

  const listRef = useRef<BubbleListRef | null>(null)

  // 滚动到底部的效果
  useEffect(() => {
    if (!hasChatStarted) return
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 'bottom', behavior: 'smooth' })
    })
  }, [messages, hasChatStarted])

  useEffect(() => {
    ensureAuth().then(() => setAuthError(false)).catch(() => setAuthError(true))
  }, [])

  useEffect(() => {
    if (!assistantType) return
    if (welcomeSentRef.current[assistantType]) return
    welcomeSentRef.current[assistantType] = true
    setHasChatStarted(true)
    
    const welcomeText = assistantType === 'travel'
      ? '你好！我是出行助手，请问你要规划什么行程？'
      : assistantType === 'cooking'
      ? '你好！我是做饭助手，请告诉我你的食材或口味偏好～'
      : assistantType === 'translation'
      ? '你好！我是翻译助手，请输入你要翻译的内容～'
      : assistantType === 'writing'
      ? '你好！我是写作助手，请告诉我你的写作主题或要求～'
      : assistantType === 'news'
      ? '你好！我是新闻资讯助手，请告诉我你关注的领域～'
      : assistantType === 'weather'
      ? '你好！我是天气预报助手，请告诉我你想查询的城市～'
      : '你好！我是心理健康助手，我愿意倾听你的感受～'
    const id = `${Date.now()}-welcome`
    setMessages(prev => ([...prev, { id, status: 'success', message: { role: 'assistant', content: welcomeText } }]))
  }, [assistantType])

  async function handleSend(val: string) {
    if (isRequesting) return
    if (val.trim()) {
      setHasChatStarted(true)
      const uid = `${Date.now()}-u`
      const aid = `${Date.now()}-a`
      setMessages(prev => ([
        ...prev,
        { id: uid, status: 'local', message: { role: 'user', content: val } },
        { id: aid, status: 'loading', message: { role: 'assistant', content: '正在调用大模型...' }, extraInfo: { prevUserText: val } },
      ]))
      setIsRequesting(true)
      setInputValue('')
      let streamContent = ''
      try {
        const systemPrompt = assistantType ? assistantPrompts[assistantType] : null
        const history = messages
          .filter(m => m.message.role === 'user' || m.message.role === 'assistant')
          .map(m => ({ role: m.message.role, content: m.message.content }))
        const msgs = [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...history,
          { role: 'user', content: val },
        ]
        const base = (import.meta.env.VITE_APP_API_BASE_URL || '').replace(/\/+$/, '')
        const response = await authFetch(`${base}/chat/send`, {
          method: 'POST',
          body: JSON.stringify({
            max_tokens: 1024,
            model: 'qwen3-max',
            temperature: 0.5,
            top_p: 1,
            presence_penalty: 0,
            frequency_penalty: 0,
            messages: msgs,
            stream: true,
            kid: '',
            chat_type: 0,
            appId: '',
            "enable_search": true
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        if (response.status === 401) {
          setMessages(prev => prev.map(m => m.id === aid ? { ...m, status: 'error', message: { role: 'assistant', content: '登录已失效，请重新登录后再试。' } } : m))
          setAuthError(true)
          setIsRequesting(false)
          return
        }
        const ct = response.headers.get('content-type') || ''
        if (ct.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder('utf-8')
          let buffer = ''
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              if (!line.trim() || line.startsWith(':')) continue
              let dataLine = line
              if (dataLine.startsWith('data:')) dataLine = dataLine.replace(/^data:\s*/, '')
              if (dataLine === '[DONE]') {
                setMessages(prev => prev.map(m => m.id === aid ? { ...m, status: 'success', message: { role: 'assistant', content: streamContent || '' }, extraInfo: { prevUserText: val } } : m))
                return
              }
              let chunk
              try { chunk = JSON.parse(dataLine) } catch { continue }
              const contentPiece = chunk?.choices?.[0]?.delta?.content || ''
              if (contentPiece) {
                streamContent += contentPiece
                setMessages(prev => prev.map(m => m.id === aid ? { ...m, status: 'updating', message: { role: 'assistant', content: streamContent } } : m))
                requestAnimationFrame(() => {
                  listRef.current?.scrollTo({ top: 'bottom', behavior: 'smooth' })
                })
              }
            }
          }
        } else {
          const result = await response.json().catch(() => null)
          const finalText = (result?.choices?.[0]?.message?.content)
            || (result?.content)
            || (result?.data?.content)
            || (typeof result === 'string' ? result : JSON.stringify(result || {}))
          setMessages(prev => prev.map(m => m.id === aid ? { ...m, status: 'success', message: { role: 'assistant', content: finalText || '请求成功，但无内容返回' }, extraInfo: { prevUserText: val } } : m))
        }
      } catch (error) {
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, status: 'error', message: { role: 'assistant', content: '抱歉，服务器出现了一些问题，请稍后再试。' } } : m))
        message.error('聊天服务请求失败，请稍后重试')
      } finally {
        setIsRequesting(false)
      }
    }
  }

  function toBubbleItems(msgs: ChatMessage[]): BubbleItemType[] {
    return msgs.map(m => ({
      key: m.id,
      role: m.message.role === 'user' ? 'user' : 'ai',
      content: m.message.content,
      status: m.status,
      extraInfo: m.extraInfo,
      streaming: m.status === 'updating',
      placement: m.message.role === 'user' ? 'end' : 'start',
    }))
  }

  return (
    <div className="chat-container">
      {/* 顶部导航栏 */}
      {CHAT_UI_CONFIG.showBackButton && assistantType && (
        <div
          className="chat-header"
          style={{
            position: 'sticky',
            top: 15,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            paddingTop: 'env(safe-area-inset-top)',
            // background: 'linear-gradient(90deg, #4facfe, rgb(243 242 252))',
            // background: 'rgb(243 242 252)',
            backdropFilter: 'saturate(150%) blur(8px)',
            // borderBottom: '1px solid rgb(199 177 177)', 
          }}
        >
          <Button
            type="text"
            size="large"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              try {
                navigate(-1)
              } catch {
                navigate('/assistants')
              }
            }}
            aria-label="返回"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1890ff',
              fontSize: 18,
            }}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 36,
              borderRadius: 8,
              background: 'rgba(0,0,0,0.03)',
              padding: '6px 10px',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 600, color: '#333' }}>
              {assistantNameMap[assistantType] || assistantType}
            </span>
          </div>
          <div style={{ width: 44, height: 44 }} />
        </div>
      )}

      {/* 主要内容区域 */}
      <div className="chat-main-content">
        {/* 欢迎页面 */}
        {!assistantType && !hasChatStarted && (
          <div className="chat-welcome-container">
            <Welcome
              style={{ 
                borderRadius: '16px',
                padding: '21px',
                marginBottom: '16px'
              }}
              variant="borderless"
              icon="https://ai-tool-1255431317.cos.ap-beijing.myqcloud.com/202504291722214.gif"
              title={
                <div style={{ fontSize: isMobile ? '20px' : '24px' }}>
                  你好！我是锦小绣
                </div>
              }
              description={
                <div style={{ fontSize: isMobile ? '14px' : '16px' }}>
                  太原广播电视台打造的智能助手锦小绣，具备知识库管理、大语言模型对话、智能体提示词、生活服务助手等功能~
                </div>
              }
            />
            <div style={{ padding: isMobile ? '8px 12px' : '16px 24px' }}>
              <Slider {...sliderSettings}>
                {questionSuggestions.map((q) => (
                  <div key={q.id} style={{ 
                    padding: '8px', 
                    display: 'inline-block', 
                    width: '100%', 
                    boxSizing: 'border-box' 
                  }}>
                    <Button 
                      type="default" 
                      icon={q.icon} 
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
                        lineHeight: '1.4'
                      }}
                      onClick={() => handleSend(q.text)}
                    >
                      {q.text}
                    </Button>
                  </div>
                ))}
              </Slider>
            </div>
          </div>
        )}

        {/* 消息列表区域 */}
        {(assistantType || hasChatStarted) && (
          <div className="chat-messages-wrapper">
            <Bubble.List
              ref={(node) => { listRef.current = node as BubbleListRef | null }}
              className="chat-bubble-list"
              autoScroll
              items={toBubbleItems(messages)}
              role={{
                user: {
                  placement: 'end',
                  variant: 'filled',
                },
                ai: (data) => ({
                  placement: 'start',
                  variant: 'shadow',
                  loading: data.status === 'loading',
                  loadingRender: () => (
                    <Think>
                      <p>正在调用大模型...</p>
                    </Think>
                  ),
                  contentRender: (content: string) => (
                    <XMarkdown 
                      paragraphTag="div" 
                      streaming={{ 
                        hasNextChunk: !!data.streaming, 
                        enableAnimation: true 
                      }}
                    >
                      {content}
                    </XMarkdown>
                  ),
                }),
              }}
            />
          </div>
        )}
      </div>

      {/* 底部输入区域 */}
      <div className="chat-footer" style={{ padding: 5, marginBottom: 10 }}>
        {inputMode === 'text' ? (
          <Sender
            autoSize={true}
            loading={isRequesting}
            value={inputValue}
            onChange={setInputValue}
            onSubmit={() => handleSend(inputValue)}
            onCancel={() => setIsRequesting(false)}
            placeholder={'请提问或输入吧......'}
            suffix={(_, info) => {
              const { SendButton, LoadingButton } = info.components
              return (
                <Space size="small">
                  {VOICE_ENABLED && (
                    <Button
                      type="text"
                      icon={<AudioOutlined />}
                      onClick={() => {
                        if (!VOICE_ENABLED) {
                          message.warning('语音功能未开启')
                          return
                        }
                        setVoiceCancel(false)
                        setInputMode('voice')
                      }}
                      aria-label="切换语音输入"
                    />
                  )}
                  {isRequesting ? (
                    <LoadingButton type="default" icon={<Spin size="small" />} disabled />
                  ) : (
                    <SendButton type="primary" icon={<OpenAIOutlined />} disabled={authError} />
                  )}
                </Space>
              )
            }}
          />
        ) : (
          VOICE_ENABLED ? (
          <div className="voice-input-container">
            {/* 实时识别文本显示 */}
            {streamVoice.interimText && (
              <div className="interim-text">
                <Text type="secondary" italic>
                  {streamVoice.interimText}
                </Text>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 12,
              }}
            >
              <Button
                type="text"
                icon={<FormOutlined />}
                onClick={async () => {
                  if (streamVoice.recording) {
                    streamVoice.stopRecording()
                  }
                  setVoiceCancel(false)
                  setInputMode('text')
                }}
                aria-label="切换文本输入"
              />

              {/* 流式语音按钮 */}
              <div
                className="voice-button-wrapper"
                onMouseDown={(e) => {
                  e.preventDefault()
                  touchStartYRef.current = e.clientY
                  isPressingRef.current = true
                  setVoiceCancel(false)
                  if (!isRequesting && !streamVoice.processing) {
                    if (VOICE_ENABLED) streamVoice.startRecording()
                  }
                }}
                onMouseMove={(e) => {
                  if (isPressingRef.current && touchStartYRef.current) {
                    const deltaY = touchStartYRef.current - e.clientY
                    setVoiceCancel(deltaY > 50)
                  }
                }}
                onMouseUp={() => {
                  if (!isPressingRef.current) return
                  isPressingRef.current = false
                  if (voiceCancel) {
                    streamVoice.stopRecording()
                  } else {
                    if (streamVoice.recording) {
                      streamVoice.stopRecording()
                    }
                  }
                  setVoiceCancel(false)
                }}
                onTouchStart={(e) => {
                  e.preventDefault()
                  const touch = e.touches[0]
                  touchStartYRef.current = touch.clientY
                  isPressingRef.current = true
                  setVoiceCancel(false)
                  if (!isRequesting && !streamVoice.processing) {
                    if (VOICE_ENABLED) streamVoice.startRecording()
                  }
                }}
                onTouchMove={(e) => {
                  if (isPressingRef.current && touchStartYRef.current) {
                    const touch = e.touches[0]
                    const deltaY = touchStartYRef.current - touch.clientY
                    setVoiceCancel(deltaY > 50)
                  }
                }}
                onTouchEnd={() => {
                  if (!isPressingRef.current) return
                  isPressingRef.current = false
                  if (voiceCancel) {
                    streamVoice.stopRecording()
                  } else {
                    if (streamVoice.recording) {
                      streamVoice.stopRecording()
                    }
                  }
                  setVoiceCancel(false)
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
              <Button
                type={streamVoice.recording ? 'primary' : 'default'}
                size="large"
                  icon={
                    streamVoice.processing ? (
                      <Spin />
                    ) : streamVoice.recording ? (
                      <StopOutlined />
                    ) : (
                      <AudioOutlined />
                    )
                  }
                  className={`voice-button ${
                    streamVoice.processing ? 'processing' : 
                    streamVoice.recording ? 'listening' : 'idle'
                  } ${voiceCancel ? 'cancel' : ''}`}
                disabled={isRequesting}
                  style={{
                    width: '100%',
                    height: 50,
                    borderRadius: 12,
                    background: streamVoice.recording 
                      ? (voiceCancel ? 'linear-gradient(90deg, #ff4d4f, #cf1322)' : 'linear-gradient(90deg, #f52d7b, #da2d55ff)')
                      : streamVoice.processing? 'linear-gradient(90deg, #4facfe, #00f2fe)'
                      : 'linear-gradient(90deg, rgb(251 245 255), rgb(229 215 195))',
                    border: 'none',
                    color: streamVoice.recording || streamVoice.processing ? '#fff' : '#666',
                  }}
              >
                {streamVoice.processing && '识别中...'}
                {streamVoice.recording && !streamVoice.processing && (voiceCancel ? '上滑取消' : '松开发送')}
                {!streamVoice.recording && !streamVoice.processing && '按住说话'}
              </Button>

                {/* 音频级别指示器 */}
                {streamVoice.recording && (
                  <div className="audio-level-indicator" style={{ width: '100%', marginTop: 4 }}>
                    <Progress
                      percent={streamVoice.audioLevel * 100}
                      showInfo={false}
                      strokeColor={voiceCancel ? '#ff4d4f' : '#1890ff'}
                      size="small"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          ) : (
            <div />
          )
        )}
      </div>
    </div>
  )
}

export default ChatPage
