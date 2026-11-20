import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { initMitra } from './lib/mitra-auth'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import Conversa from './pages/Conversa'
import Produtos from './pages/Produtos'
import Historico from './pages/Historico'
import Notificacoes from './pages/Notificacoes'
import Configuracoes from './pages/Configuracoes'

function App() {
  const [configured, setConfigured] = useState(initMitra)

  return (
    <Routes>
      <Route path="/login" element={<LoginPage onLogin={() => setConfigured(true)} />} />
      <Route element={configured ? <Layout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Conversa />} />
        <Route path="/notificacoes" element={<Notificacoes />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
