'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'

export default function WalletConnect() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Only run WalletConnect in browser environment
    const isBrowser = typeof window !== 'undefined'
    const isIndexedDBAvailable = 'indexedDB' in window
    
    console.log('Environment check:', { isBrowser, isIndexedDBAvailable })
    
    if (isBrowser && isIndexedDBAvailable) {
      setMounted(true)
    } else {
      console.warn('WalletConnect requires browser environment with IndexedDB')
      setMounted(false)
    }
  }, [])

  // Prevent rendering until client-side hydration is complete
  if (!mounted) {
    return (
      <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
    )
  }

  return <ConnectButton />
}