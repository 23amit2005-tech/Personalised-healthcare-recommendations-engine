import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('healthmate-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function getApiError(error) {
  return error.response?.data?.message || error.message || 'The request could not be completed.'
}

export default api
