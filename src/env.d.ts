/// <reference types="vite/client" />

import type { AppData } from './types'

declare global {
  interface Window {
    tradingStorage?: {
      load: () => Promise<AppData>
      save: (data: AppData) => Promise<boolean>
    }
    windowControls?: {
      toggleCompact: () => Promise<boolean>
      togglePinned: () => Promise<boolean>
    }
  }
}

export {}
