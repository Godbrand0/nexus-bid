'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import WalletConnect from '@/components/WalletConnect'
import CreateAuction from '@/components/CreateAuction'
import AuctionCard from '@/components/AuctionCard'

// Type definitions
interface Auction {
  auctionId: string
  nftContract: string
  tokenId: bigint
  seller: string
  startingPrice: bigint
  currentBid: bigint
  highestBidder: string
  startTime: bigint
  endTime: bigint
  isActive: boolean
  isFinalized: boolean
}

interface Bid {
  bidder: string
  amount: bigint
  timestamp: bigint
  refunded: boolean
}

export default function AuctionHome() {
  const { address, isConnected } = useAccount()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [auctionId, setAuctionId] = useState('')
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [auction, setAuction] = useState<any>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [fees, setFees] = useState<bigint | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait for hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch auction data
  const loadAuction = async (id: string) => {
    if (!id) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`/api/auctions/${id}`)
      const data = await response.json()
      setAuction(data.auction)
      setBids(data.bids || [])
    } catch (error) {
      console.error('Error loading auction:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch accumulated fees (owner only)
  const loadFees = async () => {
    try {
      const response = await fetch('/api/fees')
      const data = await response.json()
      setFees(data.fees)
    } catch (error) {
      console.error('Error loading fees:', error)
    }
  }

  useEffect(() => {
    if (mounted && isConnected) {
      loadFees()
    }
  }, [mounted, isConnected])

  const handleWithdrawFees = async () => {
    try {
      const response = await fetch('/api/fees/withdraw', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        alert('Fees withdrawn successfully!')
        loadFees()
      } else {
        throw new Error(data.error || 'Failed to withdraw fees')
      }
    } catch (error) {
      console.error('Error withdrawing fees:', error)
      alert('Failed to withdraw fees')
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Initializing...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-2xl font-bold text-gray-900">Nexus Auction House</h1>
            <div className="flex items-center space-x-4">
              <WalletConnect />
              {fees && Number(fees) > 0 && (
                <button
                  onClick={handleWithdrawFees}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                >
                  Withdraw Fees ({(Number(fees) / 1e18).toFixed(4)} ETH)
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isConnected ? (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to Nexus Auction House
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Connect your wallet to start creating and bidding on auctions
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Auctions</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                {showCreateForm ? 'Hide Form' : 'Create Auction'}
              </button>
            </div>

            {showCreateForm && <CreateAuction />}

            <div className="mb-6">
              <label htmlFor="auctionId" className="block text-sm font-medium text-gray-700 mb-1">
                Load Auction by ID
              </label>
              <div className="flex space-x-2">
                <input
                  id="auctionId"
                  type="text"
                  placeholder="0x..."
                  value={auctionId}
                  onChange={(e) => setAuctionId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => loadAuction(auctionId)}
                  disabled={!auctionId || isLoading}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Loading...' : 'Load Auction'}
                </button>
              </div>
            </div>

            {auction && (
              <AuctionCard
                auction={auction}
                bids={bids}
                currentAddress={address}
                isSeller={auction.seller?.toLowerCase() === address?.toLowerCase()}
              />
            )}

            {auctions.length === 0 && !auctionId && !auction && (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">No auctions found</h3>
                <p className="text-gray-600">Create a new auction or load an existing one by ID</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}