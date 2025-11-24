'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import WalletConnect from './WalletConnect'
import { useAccumulatedFees } from '@/hooks/useAuctionHouse'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { address } = useAccount()
  const { fees } = useAccumulatedFees()

  const isHome = pathname === '/'
  const isProfile = pathname === '/profile'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-8">
            <button
              onClick={() => router.push('/')}
              className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              Nexus Bid
             
            </button>
            <nav className="flex space-x-4">
              <button
                onClick={() => router.push('/')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isHome
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Auctions
              </button>
              <button
                onClick={() => router.push('/profile')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isProfile
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Profile
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <WalletConnect />
            {fees && Number(fees) > 0 && (
              <div className="text-sm text-gray-600">
                Fees: {(Number(fees) / 1e18).toFixed(4)} ETH
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
