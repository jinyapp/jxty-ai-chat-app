import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// import Home from './pages/Home';
import ChatPage from './pages/ChatPage';
import AssistantsPage from './pages/AssistantsPage';
import About from './pages/About';
import NotFound from './pages/NotFound';
import Simple from './pages/Simple';
import HomePage from './pages/HomePage';
// import HomePageDeep from './pages/HomePageDeep';
import { ensureAuth } from './utils/auth'

let authInitPromise: Promise<string> | null = null
function initAuthOnce(): Promise<string> {
  if (!authInitPromise) authInitPromise = ensureAuth()
  return authInitPromise
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    initAuthOnce().then(() => setReady(true)).catch(() => setReady(true))
  }, [])
  if (!ready) return null
  return children as React.ReactElement
}
const AppRoutes = () => {
  return (
    <Router>
      <Routes>
        {/* <Route path="/" element={<Home />} /> */}
        <Route path="/about" element={<AuthGate><About /></AuthGate>} />
        <Route path="/" element={<AuthGate><ChatPage /></AuthGate>} />
        <Route path="/assistants" element={<AuthGate><AssistantsPage /></AuthGate>} />
        <Route path="*" element={<AuthGate><NotFound /></AuthGate>} />
        <Route path="/simple" element={<AuthGate><Simple /></AuthGate>} />
        <Route path="/antd-x" element={<AuthGate><HomePage /></AuthGate>} />
        <Route path="/chat" element={<AuthGate><ChatPage /></AuthGate>} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
  
