// import { useState, useEffect, useRef } from 'react'
// import { useNavigate, useLocation } from 'react-router-dom'
// import { Bubble, Sender, Think, Welcome } from '@ant-design/x'
// import XMarkdown from '@ant-design/x-markdown'
// import type { BubbleListRef, BubbleItemType } from '@ant-design/x/es/bubble/interface'
// import Slider from 'react-slick'
// import { Space, Spin, Button, message, Progress, Typography, Switch, Tooltip } from 'antd'
// import 'slick-carousel/slick/slick.css'
// import 'slick-carousel/slick/slick-theme.css'
// import './../styles/chat.css'
// import './../styles/voice.css'
// import { authFetch } from '../utils/auth'
// import { post } from '../utils/request'

// import { 
//   OpenAIOutlined, 
//   AudioOutlined, 
//   FormOutlined, 
//   LeftCircleTwoTone, 
//   StopOutlined,
//   CloudUploadOutlined,
//   WifiOutlined,
//   DisconnectOutlined
// } from '@ant-design/icons'

// const { Text } = Typography

// // 语音识别模式类型
// type VoiceMode = 'realtime' | 'file'

// // WebSocket 连接状态类型
// type WSConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// // 流式语音识别 Hook（实时模式）
// function useStreamVoiceInput(onResult: (text: string) => Promise<void>) {
//   const [recording, setRecording] = useState(false)
//   const [processing, setProcessing] = useState(false)
//   const [interimText, setInterimText] = useState('')
//   const [audioLevel, setAudioLevel] = useState(0)
//   const [connectionStatus, setConnectionStatus] = useState<WSConnectionStatus>('disconnected')
  
//   const mediaStreamRef = useRef<MediaStream | null>(null)
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null)
//   const wsRef = useRef<WebSocket | null>(null)
//   const audioContextRef = useRef<AudioContext | null>(null)
//   const analyserRef = useRef<AnalyserNode | null>(null)
//   const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
//   const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
//   const animationFrameRef = useRef<number | null>(null)
//   const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
//   const reconnectAttemptsRef = useRef(0)

//   const speechSupported = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
//   const MAX_RECONNECT_ATTEMPTS = 3
//   const RECONNECT_DELAY = 2000

//   // 清理所有资源
//   const cleanup = () => {
//     // 清理计时器
//     if (silenceTimerRef.current) {
//       clearTimeout(silenceTimerRef.current)
//       silenceTimerRef.current = null
//     }
    
//     if (recordTimerRef.current) {
//       clearTimeout(recordTimerRef.current)
//       recordTimerRef.current = null
//     }

//     if (reconnectTimerRef.current) {
//       clearTimeout(reconnectTimerRef.current)
//       reconnectTimerRef.current = null
//     }

//     if (animationFrameRef.current) {
//       cancelAnimationFrame(animationFrameRef.current)
//       animationFrameRef.current = null
//     }
    
//     // 停止录制
//     if (mediaRecorderRef.current?.state === 'recording') {
//       mediaRecorderRef.current.stop()
//     }
    
//     // 关闭媒体流
//     if (mediaStreamRef.current) {
//       mediaStreamRef.current.getTracks().forEach(track => track.stop())
//       mediaStreamRef.current = null
//     }
    
//     // 关闭音频上下文
//     if (audioContextRef.current?.state !== 'closed') {
//       audioContextRef.current?.close()
//       audioContextRef.current = null
//     }
    
//     // 关闭WebSocket
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       wsRef.current.close()
//     }
    
//     // 重置状态
//     setRecording(false)
//     setProcessing(false)
//     setInterimText('')
//     setAudioLevel(0)
//     setConnectionStatus('disconnected')
//     reconnectAttemptsRef.current = 0
//   }

//   // 音频级别检测和VAD
//   const updateAudioLevel = () => {
//     if (!analyserRef.current || !recording) return
    
//     const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
//     analyserRef.current.getByteFrequencyData(dataArray)
    
//     const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
//     const normalizedLevel = Math.min(average / 128, 1) // 归一化到0-1
//     setAudioLevel(normalizedLevel)
    
//     // VAD - 语音活动检测
//     const isVoiceActive = normalizedLevel > 0.02
    
//     if (isVoiceActive) {
//       // 检测到语音，清除静音计时器
//       if (silenceTimerRef.current) {
//         clearTimeout(silenceTimerRef.current)
//         silenceTimerRef.current = null
//       }
//     } else if (recording && !silenceTimerRef.current) {
//       // 开始静音计时 - 3秒无声音自动停止
//       silenceTimerRef.current = setTimeout(() => {
//         console.log('检测到静音，自动停止录制')
//         stopRecording()
//       }, 3000)
//     }
    
//     if (recording) {
//       animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
//     }
//   }

//   // WebSocket 自动重连
//   const attemptReconnect = () => {
//     if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
//       console.error('WebSocket重连达到最大次数，停止重连')
//       setConnectionStatus('error')
//       message.error('语音服务连接失败，请检查网络后重试')
//       return
//     }

//     reconnectAttemptsRef.current++
//     console.log(`尝试WebSocket重连 (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`)
    
//     reconnectTimerRef.current = setTimeout(() => {
//       initWebSocket()
//     }, RECONNECT_DELAY * reconnectAttemptsRef.current)
//   }

//   // 初始化 WebSocket 连接
//   const initWebSocket = () => {
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       return Promise.resolve()
//     }

//     setConnectionStatus('connecting')
    
//     return new Promise<void>((resolve, reject) => {
//       const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
//       const wsUrl = `${protocol}//localhost:6039/ws/speech`
      
//       try {
//         wsRef.current = new WebSocket(wsUrl)
        
//         const connectionTimeout = setTimeout(() => {
//           if (wsRef.current?.readyState !== WebSocket.OPEN) {
//             wsRef.current?.close()
//             reject(new Error('WebSocket连接超时'))
//           }
//         }, 10000) // 10秒连接超时
        
//         wsRef.current.onopen = () => {
//           clearTimeout(connectionTimeout)
//           console.log('语音识别 WebSocket 连接成功')
//           setConnectionStatus('connected')
//           reconnectAttemptsRef.current = 0 // 重置重连计数
          
//           // 发送开始信号
//           if (wsRef.current?.readyState === WebSocket.OPEN) {
//             wsRef.current.send(JSON.stringify({ type: 'start' }))
//           }
//           resolve()
//         }
        
//         wsRef.current.onmessage = (event) => {
//           try {
//             const data = JSON.parse(event.data)
//             console.log('收到语音识别结果:', data)
            
//             if (data.type === 'interim') {
//               // 实时识别结果
//               setInterimText(data.text || '')
//             } else if (data.type === 'final') {
//               // 最终识别结果
//               const finalText = data.text || ''
//               if (finalText.trim()) {
//                 onResult(finalText).catch(console.error)
//               }
//               setInterimText('')
//               setProcessing(false)
//             } else if (data.type === 'error') {
//               console.error('语音识别错误:', data.message)
//               message.error(data.message || '语音识别失败')
//               setProcessing(false)
//             } else if (data.type === 'connected') {
//               console.log('WebSocket握手成功:', data.message)
//             }
//           } catch (error) {
//             console.error('解析语音识别消息失败:', error)
//           }
//         }
        
//         wsRef.current.onerror = (error) => {
//           clearTimeout(connectionTimeout)
//           console.error('语音识别 WebSocket 错误:', error)
//           setConnectionStatus('error')
//           reject(new Error('WebSocket连接错误'))
//         }
        
//         wsRef.current.onclose = (event) => {
//           clearTimeout(connectionTimeout)
//           console.log('语音识别 WebSocket 连接关闭:', event.code, event.reason)
//           setConnectionStatus('disconnected')
          
//           // 如果是异常关闭且正在录音，尝试重连
//           if (event.code !== 1000 && recording) {
//             attemptReconnect()
//           } else {
//             setProcessing(false)
//           }
//         }
//       } catch (error) {
//         setConnectionStatus('error')
//         reject(error)
//       }
//     })
//   }

//   // 开始录制
//   const startRecording = async () => {
//     if (!speechSupported) {
//       message.error('您的设备不支持语音录制功能')
//       return
//     }

//     try {
//       // 先建立WebSocket连接
//       await initWebSocket()
      
//       // 获取媒体流
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: {
//           sampleRate: 16000,
//           channelCount: 1,
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true
//         }
//       })
      
//       mediaStreamRef.current = stream
      
//       // 创建音频上下文用于分析
//     const W = window as Window & { webkitAudioContext?: typeof AudioContext }
//     const AudioContextCtor = window.AudioContext || W.webkitAudioContext!
//     audioContextRef.current = new AudioContextCtor({ sampleRate: 16000 })
//     await audioContextRef.current.resume()
    
//     const source = audioContextRef.current.createMediaStreamSource(stream)
//     analyserRef.current = audioContextRef.current.createAnalyser()
//     analyserRef.current.fftSize = 256
//     analyserRef.current.smoothingTimeConstant = 0.8
//     source.connect(analyserRef.current)
    
//     // 创建 MediaRecorder - 优化配置
//     const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
//       ? 'audio/webm;codecs=opus' 
//       : MediaRecorder.isTypeSupported('audio/webm')
//       ? 'audio/webm'
//       : 'audio/mp4'
    
//     mediaRecorderRef.current = new MediaRecorder(stream, { 
//       mimeType,
//       audioBitsPerSecond: 16000 // 限制比特率
//     })
    
//     // 优化数据发送逻辑
//     mediaRecorderRef.current.ondataavailable = (event) => {
//       if (event.data && event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
//         // 检查数据大小，避免发送过小的块
//         if (event.data.size >= 100) { // 最小100字节
//           console.log('发送音频数据:', event.data.size, 'bytes')
//           wsRef.current.send(event.data)
//         }
//       }
//     }
    
//     mediaRecorderRef.current.onerror = (event) => {
//       console.error('MediaRecorder错误:', event)
//       message.error('录音器发生错误')
//       stopRecording()
//     }
    
//     // 调整数据收集间隔，减少小数据包
//     mediaRecorderRef.current.start(500) // 改为每500ms发送一次
//     setRecording(true)
    
//     // 开始音频级别检测
//     updateAudioLevel()
    
//     // 设置最大录制时间 60秒
//     recordTimerRef.current = setTimeout(() => {
//       stopRecording()
//       message.warning('录制时间超过60秒，自动停止')
//     }, 60000)
      
//     } catch (error) {
//       console.error('开始录制失败:', error)
//       cleanup()
      
//       if (error instanceof DOMException) {
//         switch (error.name) {
//           case 'NotAllowedError':
//             message.error('请允许访问麦克风权限')
//             break
//           case 'NotFoundError':
//             message.error('未找到可用的麦克风设备')
//             break
//           case 'NotReadableError':
//             message.error('麦克风被其他应用占用')
//             break
//           default:
//             message.error('无法访问麦克风：' + error.message)
//         }
//       } else {
//         message.error('启动录音失败，请重试')
//       }
//     }
//   }

//   // 停止录制
//   const stopRecording = () => {
//     setRecording(false)
//     setProcessing(true)
    
//     // 清理计时器
//     if (silenceTimerRef.current) {
//       clearTimeout(silenceTimerRef.current)
//       silenceTimerRef.current = null
//     }
    
//     if (recordTimerRef.current) {
//       clearTimeout(recordTimerRef.current)
//       recordTimerRef.current = null
//     }

//     if (animationFrameRef.current) {
//       cancelAnimationFrame(animationFrameRef.current)
//       animationFrameRef.current = null
//     }
    
//     // 停止录制
//     if (mediaRecorderRef.current?.state === 'recording') {
//       mediaRecorderRef.current.stop()
//     }
    
//     // 发送停止信号到 WebSocket
//     if (wsRef.current?.readyState === WebSocket.OPEN) {
//       wsRef.current.send(JSON.stringify({ type: 'stop' }))
//     }
    
//     // 停止媒体流
//     if (mediaStreamRef.current) {
//       mediaStreamRef.current.getTracks().forEach(track => track.stop())
//       mediaStreamRef.current = null
//     }
    
//     // 关闭音频上下文
//     if (audioContextRef.current?.state !== 'closed') {
//       audioContextRef.current.close()
//       audioContextRef.current = null
//     }
    
//     // 延迟关闭 WebSocket，等待最终结果
//     setTimeout(() => {
//       if (wsRef.current?.readyState === WebSocket.OPEN) {
//         wsRef.current.close(1000, '正常关闭')
//       }
//       setAudioLevel(0)
//       if (!interimText) {
//         setProcessing(false)
//       }
//     }, 3000)
//   }

//   // 组件卸载时清理
//   useEffect(() => {
//     return cleanup
//   }, [])

//   return {
//     recording,
//     processing,
//     interimText,
//     audioLevel,
//     connectionStatus,
//     speechSupported,
//     startRecording,
//     stopRecording,
//     cleanup
//   }
// }

// // 传统语音识别 Hook（文件上传模式）
// function useVoiceInput(onResult: (text: string) => Promise<void>) {
//   const [recording, setRecording] = useState(false)
//   const [processing, setProcessing] = useState(false)
//   const mediaStreamRef = useRef<MediaStream | null>(null)
//   const mediaRecorderRef = useRef<MediaRecorder | null>(null)
//   const recordChunksRef = useRef<BlobPart[]>([])
//   const recordMimeTypeRef = useRef<string>('')

//   const speechSupported = !!(window.MediaRecorder && navigator.mediaDevices?.getUserMedia)

//   // 获取支持的MIME类型
//   function getSupportedMimeType(): string {
//     const types = [
//       'audio/webm;codecs=opus',
//       'audio/webm',
//       'audio/ogg;codecs=opus',
//       'audio/ogg',
//       'audio/wav',
//       'audio/mp4',
//       'audio/mpeg'
//     ]
//     for (const type of types) { 
//       if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
//         return type
//       }
//     }
//     return ''
//   }

//   // MIME类型转文件扩展名
//   function mimeToExt(mime: string): string {
//     if (!mime) return 'webm'
//     if (mime.includes('webm')) return 'webm'
//     if (mime.includes('ogg')) return 'ogg'
//     if (mime.includes('wav')) return 'wav'
//     if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3'
//     if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a'
//     return 'webm'
//   }

//   // 开始录制
//   async function start() {
//     if (!speechSupported) { 
//       message.error('您的设备不支持语音录制功能')
//       return 
//     }
    
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ 
//         audio: {
//           sampleRate: 16000,
//           channelCount: 1,
//           echoCancellation: true,
//           noiseSuppression: true,
//           autoGainControl: true
//         }
//       })
      
//       mediaStreamRef.current = stream
//       const mime = getSupportedMimeType()
//       recordMimeTypeRef.current = mime
      
//       const mediaRecorder = mime 
//         ? new MediaRecorder(stream, { mimeType: mime }) 
//         : new MediaRecorder(stream)
      
//       mediaRecorderRef.current = mediaRecorder
//       recordChunksRef.current = []
      
//       mediaRecorder.ondataavailable = (event: BlobEvent) => { 
//         const data = event.data as Blob
//         if (data && data.size > 0) {
//           recordChunksRef.current.push(data)
//         }
//       }
      
//       mediaRecorder.onerror = (event) => {
//         console.error('MediaRecorder错误:', event)
//         message.error('录音器发生错误')
//         setRecording(false)
//       }
      
//       mediaRecorder.start(1000) // 每秒收集一次数据
//       setRecording(true)
      
//     } catch (error) {
//       console.error('开始录制失败:', error)
//       setRecording(false)
      
//       if (error instanceof DOMException) {
//         switch (error.name) {
//           case 'NotAllowedError':
//             message.error('请允许访问麦克风权限')
//             break
//           case 'NotFoundError':
//             message.error('未找到可用的麦克风设备')
//             break
//           case 'NotReadableError':
//             message.error('麦克风被其他应用占用')
//             break
//           default:
//             message.error('无法访问麦克风：' + error.message)
//         }
//       } else {
//         message.error('启动录音失败，请重试')
//       }
//     }
//   }

//   // 停止录制并返回Blob
//   async function stop(): Promise<Blob | null> {
//     const mediaRecorder = mediaRecorderRef.current
//     if (!mediaRecorder || mediaRecorder.state === 'inactive') {
//       return null
//     }

//     return new Promise((resolve) => {
//       mediaRecorder.onstop = () => {
//         try {
//           const blob = new Blob(recordChunksRef.current, { 
//             type: recordMimeTypeRef.current || 'audio/webm' 
//           })
//           resolve(blob)
//         } catch (error) {
//           console.error('创建音频Blob失败:', error)
//           resolve(null)
//         }
//       }
      
//       if (mediaRecorder.state === 'recording') {
//         mediaRecorder.stop()
//       }
      
//       // 停止媒体流
//       const stream = mediaStreamRef.current
//       if (stream) { 
//         stream.getTracks().forEach(track => track.stop())
//         mediaStreamRef.current = null 
//       }
//       mediaRecorderRef.current = null
//     })
//   }

//   // 转录音频
//   async function transcribe(blob: Blob): Promise<string> {
//     if (!blob || blob.size === 0) {
//       throw new Error('音频文件为空')
//     }

//     const ext = mimeToExt(blob.type)
//     const file = new File([blob], `recording.${ext}`, { 
//       type: blob.type || 'application/octet-stream' 
//     })
    
//     const formData = new FormData()
//     formData.append('file', file)
    
//     try {
//       const response: unknown = await post('/chat/audio', formData)
      
//       // 解析响应数据
//       let text = ''
//       if (typeof response === 'string') {
//         text = response
//       } else if (response && typeof response === 'object') {
//         const data = response as Record<string, unknown>
//         if (typeof data.text === 'string') {
//           text = data.text
//         } else if (data.data && typeof (data.data as Record<string, unknown>).text === 'string') {
//           text = ((data.data as Record<string, unknown>).text as string)
//         }
//       }
      
//       return text.trim()
//     } catch (error: unknown) {
//       const err = error as { response?: { status?: number } }
//       const statusCode = err?.response?.status
      
//       if (statusCode === 401) {
//         throw new Error('语音服务鉴权失败')
//       } else if (statusCode === 413) {
//         throw new Error('音频文件过大，请录制较短的语音')
//       } else if (statusCode === 429) {
//         throw new Error('语音服务繁忙，请稍后再试')
//       } else if (statusCode === 400) {
//         throw new Error('音频格式不支持，请重新录制')
//       } else {
//         throw new Error('语音识别服务暂时不可用')
//       }
//     }
//   }

//   // 停止录制并发送
//   const stopAndSend = async () => {
//     if (!recording) return
    
//     setProcessing(true)
    
//     try {
//       const blob = await stop()
//       if (!blob || blob.size === 0) {
//         throw new Error('未检测到语音，请重试')
//       }
      
//       const text = await transcribe(blob)
//       if (!text) {
//         throw new Error('未识别到有效语音内容')
//       }
      
//       await onResult(text)
//     } catch (error) {
//       console.error('语音识别失败:', error)
//       const errorMessage = error instanceof Error ? error.message : '语音识别失败'
//       message.error(errorMessage)
//     } finally {
//       setRecording(false)
//       setProcessing(false)
//     }
//   }

//   // 清理资源
//   const cleanup = () => {
//     if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
//       mediaRecorderRef.current.stop()
//     }
    
//     if (mediaStreamRef.current) {
//       mediaStreamRef.current.getTracks().forEach(track => track.stop())
//       mediaStreamRef.current = null
//     }
    
//     setRecording(false)
//     setProcessing(false)
//   }

//   useEffect(() => {
//     return cleanup
//   }, [])

//   return { 
//     recording, 
//     processing, 
//     speechSupported, 
//     start, 
//     stop, 
//     stopAndSend,
//     cleanup
//   }
// }

// // 常量配置
// const CHAT_UI_CONFIG = { showBackButton: true }

// const assistantNameMap: Record<string, string> = {
//   travel: '出行助手',
//   cooking: '做饭助手',
//   translation: '翻译助手',
//   writing: '写作助手',
//   news: '新闻资讯助手',
//   weather: '天气预报助手',
//   mentalHealth: '心理健康助手',
// }

// const useIsMobile = () => {
//   const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
//   useEffect(() => {
//     const onResize = () => setIsMobile(window.innerWidth <= 768)
//     window.addEventListener('resize', onResize)
//     return () => window.removeEventListener('resize', onResize)
//   }, [])
//   return isMobile
// }

// const questionSuggestions = [
//   { id: 1, text: '社保如何查询', icon: '🔥' },
//   { id: 2, text: '世界读书日', icon: '🔥' },
//   { id: 3, text: '如何办理太原文旅一卡通？' },
//   { id: 4, text: '公交卡如何充值？' },
//   { id: 5, text: '如何预约挂号？' },
//   { id: 6, text: '公积金如何提取？', icon: '🔥' },
// ]

// const sliderSettings = {
//   dots: false,
//   infinite: true,
//   speed: 2000,
//   slidesToShow: 3,
//   slidesToScroll: 1,
//   autoplay: true,
//   autoplaySpeed: 1000,
//   rows: 2,
//   responsive: [
//     { breakpoint: 768, settings: { slidesToShow: 2, rows: 2 } },
//   ],
// }

// const assistantPrompts: Record<string, string> = {
//   travel: '你是"锦小绣·出行助手"，专注为用户规划太原及周边一日游或多日行程。请基于晋祠、双塔寺、汾河公园、青龙古镇、蒙山大佛等本地景点，结合当前季节、开放时间（如已知）和公共交通（地铁2号线、公交线路等），给出清晰、可执行的路线建议。若用户未指定日期，默认按"今天"或"近期周末"规划。所有景区信息若引用官方数据，请注明来源，例如："（据太原市文旅局2025年4月公告）"。',
//   cooking: '你是"锦小绣·做饭助手"，擅长用山西本地食材（如老陈醋、小米、莜面、平遥牛肉、沁州黄小米）设计家常菜。请提供完整菜谱：包括食材清单、详细步骤、火候说明、烹饪时长，并标注是否适合老人、儿童或节气养生。避免复杂西餐或需专业厨具的菜品。若参考特定食谱或民俗传统，请自然融入来源，例如："这道菜源自山西民间立夏习俗"。',
//   translation: '你是"锦小绣·翻译助手"，仅支持中英文互译，适用于菜单、路牌、日常对话等生活场景。请确保译文准确、自然、简洁。不处理法律、医学、金融等专业内容；若遇敏感或不当文本，请直接回复："抱歉，我无法翻译该内容。" 翻译结果无需额外解释或标注来源，除非用户明确要求验证术语。',
//   writing: '你是"锦小绣·写作助手"，帮助用户撰写社区通知、办事申请、活动倡议书、感谢信等实用文书。请使用正式、简洁、得体的中文，符合基层政务沟通规范。每份文案应包含标题、正文、落款三部分，语言贴近市民。若参考标准模板，请自然注明，例如："格式参考政务服务网通用申请书范例"。不生成诗歌、小说、广告或虚构内容。',
//   news: '你是"锦小绣·新闻助手"，请整理近3天内太原本地热点新闻（不超过5条），聚焦民生、交通、文旅、政策。每条须包含：事件简述 + 发生时间。**所有新闻必须来自锦绣太原APP、太原广电网（sxtygdy.com）、太原日报；但你不得自行构造URL。若你知道某条新闻在锦绣太原APP的具体页面（如 /news/12345），可提供链接；否则，仅输出新闻内容，不附任何链接。** 示例："1. 【交通】太原地铁1号线南段4月10日试运行。"',
//   weather: '你是"锦小绣·天气助手"，请明确回答用户所问日期的天气情况。若用户未指定日期，默认提供"今天"和"明天"的预报。覆盖太原六城区（迎泽、杏花岭、小店、尖草坪、万柏林、晋源）及清徐、阳曲等县区。每条回复需包含：日期、白天/夜间天气、气温范围、空气质量（AQI）、生活建议（如穿衣、出行）。所有数据以中国天气网为准，末尾统一标注："（数据来源：中国天气网）"。例如："今天（4月5日）太原晴，12~22℃，AQI 45，适宜户外活动。（数据来源：中国天气网）"',
//   mentalHealth: '你是"锦小绣·心理陪伴者"，可提供情绪倾听、正念呼吸指导、简易减压练习（如"478呼吸法"）。每次回应应温暖、非评判，并在首次或关键节点强调："我不是持证心理咨询师，无法提供诊断或治疗。如有持续焦虑、抑郁或危机情况，请立即联系太原市心理援助热线：0351-12320 转 5（24小时）。" 所有建议须基于国家权威心理健康科普内容，并自然注明来源，例如："该练习参考国家心理健康和精神卫生防治中心2024年公众指南"。',
// }

// type ChatMessage = {
//   id: string
//   status?: 'local' | 'loading' | 'updating' | 'success' | 'error' | 'abort'
//   message: { role: 'user' | 'assistant'; content: string }
//   extraInfo?: { prevUserText?: string }
// }

// const ChatPage = () => {
//   const isMobile = useIsMobile()
//   const navigate = useNavigate()
//   const location = useLocation()
//   const params = new URLSearchParams(location.search)
//   const assistantType = params.get('assistant') || ''

//   // 语音模式状态
//   const [voiceMode, setVoiceMode] = useState<VoiceMode>('realtime')
//   const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
//   const [voiceCancel, setVoiceCancel] = useState(false)
  
//   // 触摸和鼠标事件处理
//   const touchStartYRef = useRef<number | null>(null)
//   const isPressingRef = useRef(false)

//   // 聊天状态
//   const [messages, setMessages] = useState<ChatMessage[]>([])
//   const [hasChatStarted, setHasChatStarted] = useState<boolean>(!!assistantType)
//   const welcomeSentRef = useRef<Record<string, boolean>>({})
//   const [inputValue, setInputValue] = useState('')
//   const [isRequesting, setIsRequesting] = useState(false)

//   const listRef = useRef<BubbleListRef | null>(null)

//   // 语音识别 Hooks
//   const streamVoice = useStreamVoiceInput(async (text) => { 
//     setInputValue(text)
//     await handleSend(text) 
//   })

//   const fileVoice = useVoiceInput(async (text) => { 
//     setInputValue(text)
//     await handleSend(text) 
//   })

//   // 获取当前使用的语音Hook
//   const currentVoice = voiceMode === 'realtime' ? streamVoice : fileVoice

//   // 滚动到底部的效果
//   useEffect(() => {
//     if (!hasChatStarted) return
//     requestAnimationFrame(() => {
//       listRef.current?.scrollTo({ top: 'bottom', behavior: 'smooth' })
//     })
//   }, [messages, hasChatStarted])

//   // 助手欢迎消息
//   useEffect(() => {
//     if (!assistantType) return
//     if (welcomeSentRef.current[assistantType]) return
//     welcomeSentRef.current[assistantType] = true
//     setHasChatStarted(true)
    
//     const welcomeText = assistantType === 'travel'
//       ? '你好！我是出行助手，请问你要规划什么行程？'
//       : assistantType === 'cooking'
//       ? '你好！我是做饭助手，请告诉我你的食材或口味偏好～'
//       : assistantType === 'translation'
//       ? '你好！我是翻译助手，请输入你要翻译的内容～'
//       : assistantType === 'writing'
//       ? '你好！我是写作助手，请告诉我你的写作主题或要求～'
//       : assistantType === 'news'
//       ? '你好！我是新闻资讯助手，请告诉我你关注的领域～'
//       : assistantType === 'weather'
//       ? '你好！我是天气预报助手，请告诉我你想查询的城市～'
//       : '你好！我是心理健康助手，我愿意倾听你的感受～'
    
//     const id = `${Date.now()}-welcome`
//     setMessages(prev => ([...prev, { 
//       id, 
//       status: 'success', 
//       message: { role: 'assistant', content: welcomeText } 
//     }]))
//   }, [assistantType])

//   // 发送消息处理
//   async function handleSend(val: string) {
//     if (isRequesting) return
//     if (val.trim()) {
//       setHasChatStarted(true)
//       const uid = `${Date.now()}-u`
//       const aid = `${Date.now()}-a`
      
//       setMessages(prev => ([
//         ...prev,
//         { id: uid, status: 'local', message: { role: 'user', content: val } },
//         { 
//           id: aid, 
//           status: 'loading', 
//           message: { role: 'assistant', content: '正在调用大模型...' }, 
//           extraInfo: { prevUserText: val } 
//         },
//       ]))
      
//       setIsRequesting(true)
//       setInputValue('')
//       let streamContent = ''
      
//       try {
//         const systemPrompt = assistantType ? assistantPrompts[assistantType] : null
//         const history = messages
//           .filter(m => m.message.role === 'user' || m.message.role === 'assistant')
//           .map(m => ({ role: m.message.role, content: m.message.content }))
        
//         const msgs = [
//           ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
//           ...history,
//           { role: 'user', content: val },
//         ]
        
//         const response = await authFetch((import.meta.env.VITE_APP_API_BASE_URL || '') + 'chat/send', {
//           method: 'POST',
//           body: JSON.stringify({
//             max_tokens: 1024,
//             model: 'qwen-max-latest',
//             temperature: 0.5,
//             top_p: 1,
//             presence_penalty: 0,
//             frequency_penalty: 0,
//             messages: msgs,
//             stream: true,
//             kid: '',
//             chat_type: 0,
//             appId: '',
//           }),
//           headers: { 'Content-Type': 'application/json' },
//         })
        
//         const contentType = response.headers.get('content-type') || ''
        
//         if (contentType.includes('text/event-stream') && response.body) {
//           // 处理流式响应
//           const reader = response.body.getReader()
//           const decoder = new TextDecoder('utf-8')
//           let buffer = ''
          
//           while (true) {
//             const { value, done } = await reader.read()
//             if (done) break
            
//             buffer += decoder.decode(value, { stream: true })
//             const lines = buffer.split('\n')
//             buffer = lines.pop() || ''
            
//             for (const line of lines) {
//               if (!line.trim() || line.startsWith(':')) continue
              
//               let dataLine = line
//               if (dataLine.startsWith('data:')) {
//                 dataLine = dataLine.replace(/^data:\s*/, '')
//               }
              
//               if (dataLine === '[DONE]') {
//                 setMessages(prev => prev.map(m => 
//                   m.id === aid ? { 
//                     ...m, 
//                     status: 'success', 
//                     message: { role: 'assistant', content: streamContent || '' }, 
//                     extraInfo: { prevUserText: val } 
//                   } : m
//                 ))
//                 return
//               }
              
//               let chunk
//               try { 
//                 chunk = JSON.parse(dataLine) 
//               } catch { 
//                 continue 
//               }
              
//               const contentPiece = chunk?.choices?.[0]?.delta?.content || ''
//               if (contentPiece) {
//                 streamContent += contentPiece
//                 setMessages(prev => prev.map(m => 
//                   m.id === aid ? { 
//                     ...m, 
//                     status: 'updating', 
//                     message: { role: 'assistant', content: streamContent } 
//                   } : m
//                 ))
                
//                 // 自动滚动到底部
//                 requestAnimationFrame(() => {
//                   listRef.current?.scrollTo({ top: 'bottom', behavior: 'smooth' })
//                 })
//               }
//             }
//           }
//         } else {
//           // 处理非流式响应
//           const result = await response.json().catch(() => null)
//           const finalText = (result?.choices?.[0]?.message?.content)
//             || (result?.content)
//             || (result?.data?.content)
//             || (typeof result === 'string' ? result : JSON.stringify(result || {}))
          
//           setMessages(prev => prev.map(m => 
//             m.id === aid ? { 
//               ...m, 
//               status: 'success', 
//               message: { role: 'assistant', content: finalText || '请求成功，但无内容返回' }, 
//               extraInfo: { prevUserText: val } 
//             } : m
//           ))
//         }
//       } catch (error) {
//         console.error('聊天请求失败:', error)
//         setMessages(prev => prev.map(m => 
//           m.id === aid ? { 
//             ...m, 
//             status: 'error', 
//             message: { role: 'assistant', content: '抱歉，服务器出现了一些问题，请稍后再试。' } 
//           } : m
//         ))
//         message.error('聊天服务请求失败，请稍后重试')
//       } finally {
//         setIsRequesting(false)
//       }
//     }
//   }

//   // 转换消息格式
//   function toBubbleItems(msgs: ChatMessage[]): BubbleItemType[] {
//     return msgs.map(m => ({
//       key: m.id,
//       role: m.message.role === 'user' ? 'user' : 'ai',
//       content: m.message.content,
//       status: m.status,
//       extraInfo: m.extraInfo,
//       streaming: m.status === 'updating',
//       placement: m.message.role === 'user' ? 'end' : 'start',
//     }))
//   }

//   // 语音按钮事件处理
//   const handleVoiceStart = () => {
//     setVoiceCancel(false)
//     if (!isRequesting && !currentVoice.processing) {
//       if (voiceMode === 'realtime') {
//         streamVoice.startRecording()
//       } else {
//         fileVoice.start()
//       }
//     }
//   }

//   const handleVoiceStop = () => {
//     if (!isPressingRef.current) return
//     isPressingRef.current = false
    
//     if (voiceCancel) {
//       // 取消录音
//       if (voiceMode === 'realtime') {
//         streamVoice.cleanup()
//       } else {
//         fileVoice.cleanup()
//       }
//     } else {
//       // 正常结束录音
//       if (voiceMode === 'realtime') {
//         streamVoice.stopRecording()
//       } else {
//         fileVoice.stopAndSend()
//       }
//     }
//     setVoiceCancel(false)
//   }

//   const handleVoiceMove = (clientY: number) => {
//     if (isPressingRef.current && touchStartYRef.current) {
//       const deltaY = touchStartYRef.current - clientY
//       setVoiceCancel(deltaY > 50)
//     }
//   }

//   // 获取连接状态图标
//   const getConnectionStatusIcon = () => {
//     if (voiceMode !== 'realtime') return null
//     switch (streamVoice.connectionStatus) {
//       case 'connected':
//         return <WifiOutlined style={{ color: '#52c41a' }} />
//       case 'connecting':
//         return <Spin size="small" />
//       case 'error':
//         return <DisconnectOutlined style={{ color: '#ff4d4f' }} />
//       default:
//         return <DisconnectOutlined style={{ color: '#d9d9d9' }} />
//     }
//   }

//   // 获取连接状态文本
//   const getConnectionStatusText = () => {
//     if (voiceMode !== 'realtime') return '文件上传模式'
    
//     switch (streamVoice.connectionStatus) {
//       case 'connected':
//         return '实时连接正常'
//       case 'connecting':
//         return '正在连接...'
//       case 'error':
//         return '连接失败'
//       default:
//         return '未连接'
//     }
//   }

//   // 组件卸载时清理资源
//   useEffect(() => {
//     return () => {
//       streamVoice.cleanup()
//       fileVoice.cleanup()
//     }
//   }, [])

//   return (
//     <div className="chat-container">
//       {/* 顶部导航栏 */}
//       {CHAT_UI_CONFIG.showBackButton && assistantType && (
//         <div className="chat-back-bar">
//           <Button
//             type="text"
//             size="large"
//             icon={<LeftCircleTwoTone />}
//             onClick={() => navigate('/assistants')}
//             style={{
//               position: 'absolute',
//               left: 16,
//               height: '100%',
//               display: 'flex',
//               alignItems: 'center',
//               fontSize: 18,
//               color: '#1890ff',
//             }}
//           /><span style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>
//             {assistantNameMap[assistantType] || assistantType}
//           </span>
//         </div>
//       )}

//       {/* 主要内容区域 */}
//       <div className="chat-main-content">
//         {/* 欢迎页面 */}
//         {!assistantType && !hasChatStarted && (
//           <div className="chat-welcome-container">
//             <Welcome
//               style={{ 
//                 borderRadius: '16px',
//                 padding: '21px',
//                 marginBottom: '16px'
//               }}
//               variant="borderless"
//               icon="https://ai-tool-1255431317.cos.ap-beijing.myqcloud.com/202504291722214.gif"
//               title={
//                 <div style={{ fontSize: isMobile ? '20px' : '24px' }}>
//                   你好！我是锦小绣
//                 </div>
//               }description={
//                 <div style={{ fontSize: isMobile ? '14px' : '16px' }}>
//                   太原广播电视台打造的智能助手锦小绣，具备知识库管理、大语言模型对话、智能体提示词、生活服务助手等功能~
//                 </div>
//               }
//             />
//             <div style={{ padding: isMobile ? '8px 12px' : '16px 24px' }}>
//               <Slider {...sliderSettings}>
//                 {questionSuggestions.map((q) => (
//                   <div key={q.id} style={{ 
//                     padding: '8px', 
//                     display: 'inline-block', 
//                     width: '100%', 
//                     boxSizing: 'border-box' 
//                   }}>
//                     <Button 
//                       type="default" 
//                       icon={q.icon} 
//                       style={{
//                         width: '90%',
//                         minHeight: isMobile ? '60px' : '72px',
//                         height: 'auto',
//                         borderRadius: '12px',
//                         padding: '12px 20px',
//                         border: '1px solid rgba(22,119,255,0.1)',
//                         background: 'rgba(255,255,255,0.9)',
//                         fontSize: isMobile ? '14px' : '16px',
//                         display: 'flex',
//                         alignItems: 'center',
//                         justifyContent: 'flex-start',
//                         gap: '12px',
//                         overflow: 'hidden',
//                         textOverflow: 'ellipsis',
//                         margin: '0 auto',
//                         wordBreak: 'break-word',
//                         whiteSpace: 'pre-wrap',
//                         lineHeight: '1.4'
//                       }}
//                       onClick={() => handleSend(q.text)}
//                     >
//                       {q.text}
//                     </Button>
//                   </div>
//                 ))}
//               </Slider>
//             </div>
//           </div>
//         )}

//         {/* 消息列表区域 */}
//         {(assistantType || hasChatStarted) && (
//           <div className="chat-messages-wrapper">
//             <Bubble.List
//               ref={(node) => { listRef.current = node as BubbleListRef | null }}
//               className="chat-bubble-list"
//               autoScroll
//               items={toBubbleItems(messages)}
//               role={{
//                 user: {
//                   placement: 'end',
//                   variant: 'filled',
//                 },
//                 ai: (data) => ({
//                   placement: 'start',
//                   variant: 'shadow',
//                   loading: data.status === 'loading',
//                   loadingRender: () => (
//                     <Think>
//                       <p>正在调用大模型...</p>
//                     </Think>
//                   ),
//                   contentRender: (content: string) => (
//                     <XMarkdown 
//                       paragraphTag="div" 
//                       streaming={{ 
//                         hasNextChunk: !!data.streaming, 
//                         enableAnimation: true 
//                       }}>
//                       {content}
//                     </XMarkdown>
//                   ),
//                 }),
//               }}
//             />
//           </div>
//         )}
//       </div>

//       {/* 底部输入区域 */}
//       <div className="chat-footer">
//         {inputMode === 'text' ? (
//           <Sender
//             autoSize={true}
//             loading={isRequesting}
//             value={inputValue}
//             onChange={setInputValue}
//             onSubmit={() => handleSend(inputValue)}
//             onCancel={() => setIsRequesting(false)}
//             placeholder={'请提问或输入吧......'}
//             suffix={(_, info) => {
//               const { SendButton, LoadingButton } = info.components
//               return (
//                 <Space size="small">
//                   <Button
//                     type="text"
//                     icon={<AudioOutlined />}
//                     onClick={() => {
//                       setVoiceCancel(false)
//                       setInputMode('voice')
//                     }}
//                     aria-label="切换语音输入"
//                   />
//                   {isRequesting ? (
//                     <LoadingButton type="default" icon={<Spin size="small" />} disabled />
//                   ) : (
//                     <SendButton type="primary" icon={<OpenAIOutlined />} disabled={false} />
//                   )}
//                 </Space>
//               )
//             }}
//           />
//         ) : (
//           <div className="voice-input-container">
//             {/* 语音模式切换和状态显示 */}
//             <div className="voice-mode-header" style={{
//               display: 'flex',
//               alignItems: 'center',
//               justifyContent: 'space-between',
//               padding: '8px 12px',
//               background: 'rgba(240, 242, 247, 0.8)',
//               borderRadius: '8px 8px 0 0',
//               fontSize: '12px',
//               color: '#666'
//             }}>
//               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//                 <span>语音模式:</span>
//                 <Switch
//                   size="small"
//                   checked={voiceMode === 'realtime'}
//                   onChange={(checked) => {
//                     const newMode: VoiceMode = checked ? 'realtime' : 'file'
//                     setVoiceMode(newMode)
                    
//                     // 切换模式时清理当前状态
//                     if (streamVoice.recording || streamVoice.processing) {
//                       streamVoice.cleanup()
//                     }
//                     if (fileVoice.recording || fileVoice.processing) {
//                       fileVoice.cleanup()
//                     }
//                   }}
//                   checkedChildren="实时"
//                   unCheckedChildren="文件"
//                 />
//               </div><Tooltip title={getConnectionStatusText()}>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
//                   {getConnectionStatusIcon()}
//                   <span style={{ fontSize: '11px' }}>
//                     {voiceMode === 'realtime' ? '实时识别' : '文件上传'}
//                   </span>
//                 </div>
//               </Tooltip>
//             </div>

//             {/* 实时识别文本显示 */}
//             {voiceMode === 'realtime' && streamVoice.interimText && (
//               <div className="interim-text" style={{
//                 padding: '8px 12px',
//                 background: 'rgba(24, 144, 255, 0.05)',
//                 borderLeft: '3px solid #1890ff',
//                 margin: '8px 0'
//               }}>
//                 <Text type="secondary" italic>
//                   正在识别: {streamVoice.interimText}
//                 </Text>
//               </div>
//             )}<div
//               style={{
//                 display: 'flex',
//                 alignItems: 'center',
//                 gap: 12,
//                 padding: '8px 12px',
//                 background: 'rgba(255,255,255,0.9)',
//                 borderRadius: voiceMode === 'realtime' && streamVoice.interimText ? '0 0 12px 12px' : '0 0 12px 12px',
//               }}
//             >
//               <Button
//                 type="text"
//                 icon={<FormOutlined />}
//                 onClick={async () => {
//                   // 清理当前语音状态
//                   if (streamVoice.recording || streamVoice.processing) {
//                     streamVoice.cleanup()
//                   }
//                   if (fileVoice.recording || fileVoice.processing) {
//                     fileVoice.cleanup()
//                   }
//                   setVoiceCancel(false)
//                   setInputMode('text')
//                 }}
//                 aria-label="切换文本输入"
//               />

//               {/* 语音按钮 */}
//               <div
//                 className="voice-button-wrapper"
//                 onMouseDown={(e) => {
//                   e.preventDefault()
//                   touchStartYRef.current = e.clientY
//                   isPressingRef.current = true
//                   handleVoiceStart()
//                 }}
//                 onMouseMove={(e) => {
//                   handleVoiceMove(e.clientY)
//                 }}
//                 onMouseUp={handleVoiceStop}
//                 onMouseLeave={handleVoiceStop}
//                 onTouchStart={(e) => {
//                   e.preventDefault()
//                   const touch = e.touches[0]
//                   touchStartYRef.current = touch.clientY
//                   isPressingRef.current = true
//                   handleVoiceStart()
//                 }}
//                 onTouchMove={(e) => {
//                   const touch = e.touches[0]
//                   handleVoiceMove(touch.clientY)
//                 }}
//                 onTouchEnd={handleVoiceStop}
//                 style={{
//                   flex: 1,
//                   display: 'flex',
//                   flexDirection: 'column',
//                   alignItems: 'center',
//                   justifyContent: 'center',
//                   gap: 6,
//                 }}
//               >
//                 <Button
//                   type={currentVoice.recording ? 'primary' : 'default'}
//                   size="large"
//                   icon={
//                     currentVoice.processing ? (
//                       <Spin />
//                     ) : currentVoice.recording ? (
//                       <StopOutlined />
//                     ) : voiceMode === 'file' ? (
//                       <CloudUploadOutlined />
//                     ) : (
//                       <AudioOutlined />
//                     )
//                   }
//                   className={`voice-button ${
//                     currentVoice.processing ? 'processing' : 
//                     currentVoice.recording ? 'listening' : 'idle'
//                   } ${voiceCancel ? 'cancel' : ''}`}
//                   disabled={isRequesting || !currentVoice.speechSupported}
//                   style={{
//                     width: '100%',
//                     height: 50,
//                     borderRadius: 12,
//                     background: currentVoice.recording 
//                       ? (voiceCancel ? 'linear-gradient(90deg, #ff4d4f, #cf1322)' : 'linear-gradient(90deg, #f52d7b, #da2d55ff)')
//                       : currentVoice.processing
//                       ? 'linear-gradient(90deg, #4facfe, #00f2fe)'
//                       : 'linear-gradient(90deg, rgb(251 245 255), rgb(229 215 195))',
//                     border: 'none',
//                     color: currentVoice.recording || currentVoice.processing ? '#fff' : '#666',
//                     transition: 'all 0.3s ease',
//                   }}
//                 >
//                   {!currentVoice.speechSupported && '设备不支持'}{currentVoice.speechSupported && currentVoice.processing && (
//                     voiceMode === 'realtime' ? '识别中...' : '上传识别中...'
//                   )}{currentVoice.speechSupported && currentVoice.recording && !currentVoice.processing && (
//                     voiceCancel ? '上滑取消' : '松开发送'
//                   )}
//                   {currentVoice.speechSupported && !currentVoice.recording && !currentVoice.processing && (
//                     voiceMode === 'realtime' ? '按住说话' : '按住录音'
//                   )}
//                 </Button>

//                 {/* 音频级别指示器（仅实时模式显示） */}
//                 {voiceMode === 'realtime' && streamVoice.recording && (
//                   <div className="audio-level-indicator" style={{ width: '100%', marginTop: 4 }}>
//                     <Progress
//                       percent={Math.min(streamVoice.audioLevel * 100, 100)}
//                       showInfo={false}
//                       strokeColor={voiceCancel ? '#ff4d4f' : '#1890ff'}
//                       size="small"
//                       style={{
//                         transition: 'all 0.1s ease'
//                       }}
//                     />
//                   </div>
//                 )}
//               </div>
//             </div>

//             {/* 使用提示 */}
//             <div style={{
//               padding: '4px 12px',
//               fontSize: '11px',
//               color: '#999',
//               textAlign: 'center',
//               background: 'rgba(240, 242, 247, 0.5)',
//               borderRadius: '0 0 8px 8px'
//             }}>
//               {voiceMode === 'realtime' 
//                 ? '实时模式：边说边识别，支持长时间对话'
//                 : '文件模式：录制完成后上传识别，适合短语音'
//               }
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }

// export default ChatPage
