import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ensureAuth } from '../utils/auth'
import { Button } from 'antd'

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

const AssistantsPage = () => {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [authError, setAuthError] = useState(false)
  const items = [
    { key: 'travel', title: '出行助手', icon: '🚗' },
    { key: 'cooking', title: '做饭助手', icon: '🍳' },
    { key: 'translation', title: '翻译助手', icon: '🌐' },
    { key: 'writing', title: '写作助手', icon: '✍️' },
    { key: 'news', title: '新闻资讯助手', icon: '📰' },
    { key: 'weather', title: '天气预报助手', icon: '🌤️' },
    { key: 'mentalHealth', title: '心理健康助手', icon: '💚' },
  ]

  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [pressKey, setPressKey] = useState<string | null>(null)

  const gradientBg = 'linear-gradient(97deg, #e6f7ff 0%, #f0f8ff 50%, #f7f3ff 100%)'
  const gap = isMobile ? 16 : 24
  const cardMinHeight = isMobile ? 120 : 160
  const cardMinWidth = isMobile ? 150 : 214
  const containerPadding = isMobile ? 24 : 60
  const columns = isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'

  useEffect(() => {
    ensureAuth().then(() => setAuthError(false)).catch(() => setAuthError(true))
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: containerPadding,
        paddingTop: 'env(safe-area-inset-top)',
        backgroundImage: gradientBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      {authError && (
        <div style={{ width: '100%', maxWidth: 960, marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <Button type="primary" onClick={() => { ensureAuth().then(() => setAuthError(false)).catch(() => setAuthError(true)) }}>登录失效，点击重试</Button>
        </div>
      )}
      <div style={{ width: '100%', maxWidth: 960 }}>
        <div style={{ display: 'grid', gridTemplateColumns: columns, gap, justifyItems: 'center' }}>
          {items.map(item => {
            const isHover = hoverKey === item.key
            const isPress = pressKey === item.key
            const transform = isPress ? 'scale(1.02)' : isHover ? 'translateY(-2px)' : 'none'
            const boxShadow = isHover ? '0 8px 20px rgba(0,0,0,0.08)' : '0 4px 12px rgba(0,0,0,0.05)'
            const border = '1px solid #e0e0e0'
            const iconSize = isMobile ? 32 : 40
            const fontSize = isMobile ? 16 : 18
            const iconBg = item.key === 'travel' ? '#e6f4ff'
              : item.key === 'cooking' ? '#fff7e6'
              : item.key === 'translation' ? '#e6fffb'
              : item.key === 'writing' ? '#f9f0ff'
              : item.key === 'news' ? '#fff1f0'
              : item.key === 'weather' ? '#e6f7ff'
              : '#f6ffed'
            const iconColor = item.key === 'travel' ? '#1d7dfa'
              : item.key === 'cooking' ? '#faad14'
              : item.key === 'translation' ? '#13c2c2'
              : item.key === 'writing' ? '#722ed1'
              : item.key === 'news' ? '#cf1322'
              : item.key === 'weather' ? '#1890ff'
              : '#389e0d'
            return (
              <Button
                key={item.key}
                aria-label={item.title}
                tabIndex={0}
                style={{
                  minHeight: cardMinHeight,
                  minWidth: cardMinWidth,
                  borderRadius: 16,
                  border,
                  background: '#fafafa',
                  boxShadow,
                  transition: 'transform 160ms ease, box-shadow 160ms ease',
                }}
                onMouseEnter={() => setHoverKey(item.key)}
                onMouseLeave={() => setHoverKey(null)}
                onMouseDown={() => setPressKey(item.key)}
                onMouseUp={() => setPressKey(null)}
                onClick={() => navigate(`/chat?assistant=${item.key}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/chat?assistant=${item.key}`) }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transform }}>
                  <div style={{ width: iconSize + 20, height: iconSize + 20, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, fontSize: iconSize }}>
                    {item.icon}
                  </div>
                  <div style={{ fontSize, color: '#333' }}>{item.title}</div>
                </div>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default AssistantsPage
