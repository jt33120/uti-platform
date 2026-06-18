
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s — AI matching can take time
})

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Ne pas rebondir l'utilisateur déjà sur une page d'auth publique.
      // Ex : la page /reset-password sonde le backend avec un token de
      // récupération Supabase qui 401 légitimement — sans ce garde-fou,
      // l'utilisateur serait renvoyé vers /login avant de pouvoir changer
      // son mot de passe.
      const authPaths = ['/login', '/reset-password', '/forgot-password', '/register']
      const onAuthPage = authPaths.some((p) => window.location.pathname.startsWith(p))
      if (!onAuthPage) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
