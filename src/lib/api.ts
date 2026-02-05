const PASSWORD_STORAGE = 'openclaw-admin-password'

export function getPassword(): string | null {
  return localStorage.getItem(PASSWORD_STORAGE)
}

export function setPassword(password: string): void {
  localStorage.setItem(PASSWORD_STORAGE, password)
}

export function clearPassword(): void {
  localStorage.removeItem(PASSWORD_STORAGE)
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const password = getPassword()

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(password ? { 'X-Password': password } : {}),
      ...options?.headers,
    },
  })

  if (response.status === 401) {
    clearPassword()
    window.location.reload()
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed: ${response.status}`)
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}
