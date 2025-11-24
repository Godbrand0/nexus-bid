'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import CreateAuction from '@/components/CreateAuction'
import AuctionList from '@/components/AuctionList'
import AuctionCard from '@/components/AuctionCard'
import { useAuction, useAuctionBids } from '@/hooks/useAuctionHouse'

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

export default function Home() {
  const { address, isConnected } = useAccount()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [auctionId, setAuctionId] = useState('')
  const [searchAuctionId, setSearchAuctionId] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [mounted, setMounted] = useState(false)
  
  // Use wagmi hooks for direct contract interaction - only when searchAuctionId is set
  const { auction, isLoading: auctionLoading, error: auctionError } = useAuction(searchAuctionId)
  const { bids, isLoading: bidsLoading } = useAuctionBids(searchAuctionId)
  
  // Wait for hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLoadAuction = () => {
    if (auctionId && auctionId.trim() !== '') {
      setSearchAuctionId(auctionId)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
              <div className="flex space-x-2">
                <button
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  {viewMode === 'grid' ? 'List View' : 'Grid View'}
                </button>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  {showCreateForm ? 'Hide Form' : 'Create Auction'}
                </button>
              </div>
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
                  onChange={(e) => {
                    setAuctionId(e.target.value)
                    if (e.target.value === '') {
                      setSearchAuctionId('')
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleLoadAuction}
                  disabled={!auctionId || auctionLoading}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {auctionLoading ? 'Loading...' : 'Load Auction'}
                </button>
              </div>
              {auctionError && (
                <div className="mt-2 text-sm text-red-600">
                  Error loading auction: {auctionError.message}
                </div>
              )}
            </div>

            <AuctionList
              currentAddress={address}
              viewMode={viewMode}
            />

            {auction && (
              <AuctionCard
                auction={{
                  auctionId: auction[0] as string,
                  nftContract: auction[1] as string,
                  tokenId: auction[2] as bigint,
                  seller: auction[3] as string,
                  startingPrice: auction[4] as bigint,
                  currentBid: auction[5] as bigint,
                  highestBidder: auction[6] as string,
                  startTime: auction[7] as bigint,
                  endTime: auction[8] as bigint,
                  isActive: auction[9] as boolean,
                  isFinalized: auction[10] as boolean
                }}
                bids={bids as any[] || []}
                currentAddress={address}
                isSeller={(auction[3] as string)?.toLowerCase() === address?.toLowerCase()}
              />
            )}
          </div>
        )}
      </main>
    </div>
  )
}