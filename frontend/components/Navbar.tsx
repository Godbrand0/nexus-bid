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
    <header className="bg-royal-blue shadow-md border-b-4 border-gold">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-5">
          <div className="flex items-center space-x-10">
            <button
              onClick={() => router.push('/')}
              className="text-3xl font-serif font-bold text-white hover:text-gold transition-colors tracking-wide"
            >
              Nexus Bid
            </button>
            <nav className="flex space-x-6">
              <button
                onClick={() => router.push('/')}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-all uppercase tracking-wider ${
                  isHome
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-gray-300 hover:text-white hover:border-b-2 hover:border-gray-400'
                }`}
              >
                Auctions
              </button>
              <button
                onClick={() => router.push('/profile')}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-all uppercase tracking-wider ${
                  isProfile
                    ? 'text-gold border-b-2 border-gold'
                    : 'text-gray-300 hover:text-white hover:border-b-2 hover:border-gray-400'
                }`}
              >
                Profile
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-6">
            <WalletConnect />
            {fees && Number(fees) > 0 && (
              <div className="text-sm font-medium text-gold bg-oxford-blue px-4 py-2 rounded-sm border border-gold/30">
                Fees: {(Number(fees) / 1e18).toFixed(4)} ETH
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
