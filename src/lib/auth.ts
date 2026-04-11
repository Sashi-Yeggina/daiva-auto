const AUTH_KEY = 'daiva_auth'

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}

export function setAuthenticated(value: boolean) {
  if (value) {
    sessionStorage.setItem(AUTH_KEY, 'true')
  } else {
    sessionStorage.removeItem(AUTH_KEY)
  }
}

export function logout() {
  sessionStorage.removeItem(AUTH_KEY)
}
