import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)

  const login = async (email, password) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  const register = async (email, password, name, role, inviteToken = null) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { email, password, name, role, invite_token: inviteToken || undefined })
      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const updateProfile = async (data) => {
    const { data: updated } = await api.patch('/auth/me', data)
    const newUser = { ...user, ...updated }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
    return newUser
  }

  const uploadAvatar = async (file) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/auth/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const newUser = { ...user, avatar_url: data.avatar_url }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
    return data.avatar_url
  }

  const deleteAvatar = async () => {
    await api.delete('/auth/me/avatar')
    const newUser = { ...user, avatar_url: null }
    localStorage.setItem('user', JSON.stringify(newUser))
    setUser(newUser)
  }

  const isAdmin = user?.role === 'admin'
  const isCommerce = user?.role === 'commerce'
  const isStaff = isAdmin || isCommerce // équipe UTI (admin + commercial)
  const isAO = user?.role === 'ao'

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin, isCommerce, isStaff, isAO, updateProfile, uploadAvatar, deleteAvatar }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
