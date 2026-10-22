export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'trackclass:theme'

export function readTheme(): Theme {
  const current = document.documentElement.dataset.theme
  return current === 'light' ? 'light' : 'dark'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    meta.content = theme === 'dark' ? '#050816' : '#eef4fb'
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    return
  }
}
