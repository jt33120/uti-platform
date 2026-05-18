import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import ConsultantsPage from './pages/ConsultantsPage'
import AOSPage from './pages/AOSPage'
import AODetailPage from './pages/AODetailPage'
import NewConsultantPage from './pages/NewConsultantPage'
import NewAOPage from './pages/NewAOPage'
import NewClientPage from './pages/NewClientPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import PartnerAccessPage from './pages/PartnerAccessPage'
import PartnersPage from './pages/PartnersPage'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function GuestRoute({ children }) {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/consultants" element={<ConsultantsPage />} />
          <Route path="/consultants/new" element={<NewConsultantPage />} />
          <Route path="/aos" element={<AOSPage />} />
          <Route path="/aos/new" element={<ProtectedRoute adminOnly><NewAOPage /></ProtectedRoute>} />
          <Route path="/clients/new" element={<ProtectedRoute adminOnly><NewClientPage /></ProtectedRoute>} />
          <Route path="/aos/:id" element={<AODetailPage />} />
          <Route path="/partners" element={<ProtectedRoute adminOnly><PartnersPage /></ProtectedRoute>} />
          <Route path="/partners-access" element={<ProtectedRoute adminOnly><PartnerAccessPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
