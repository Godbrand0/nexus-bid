'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useAuction, useAuctionBids, useAccumulatedFees, useWithdrawFees } from '@/hooks/useAuctionHouse'
import { registerSchemas, subscribeToAuctionEvents } from '@/lib/streams'
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

export default function Home() {
  const { address, isConnected } = useAccount()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [auctionId, setAuctionId] = useState('')
  const [auctions, setAuctions] = useState<any[]>([])

  const { auction, isLoading: isLoadingAuction } = useAuction(auctionId)
  const { bids, isLoading: isLoadingBids } = useAuctionBids(auctionId)
  const { fees, isLoading: isLoadingFees } = useAccumulatedFees()
  const { withdrawFees } = useWithdrawFees()

  // Initialize Somnia Data Streams schemas (server-side only)
  useEffect(() => {
    // Only register schemas on server side
    if (typeof window === 'undefined' && isConnected) {
      registerSchemas().catch(console.error)
    }
  }, [isConnected])

  // Subscribe to real-time events
  useEffect(() => {
    if (!isConnected) return

    let subscriptions: { unsubscribe?: () => void }[] = []

    const setupSubscriptions = async () => {
      try {
        const sub1 = await subscribeToAuctionEvents('AuctionCreated', (data) => {
          console.log('New auction created:', data)
          // Update auctions list
        })
        if (sub1) subscriptions.push(sub1)

        const sub2 = await subscribeToAuctionEvents('BidPlaced', (data) => {
          console.log('New bid placed:', data)
          // Update auction data
        })
        if (sub2) subscriptions.push(sub2)

        const sub3 = await subscribeToAuctionEvents('AuctionFinalized', (data) => {
          console.log('Auction finalized:', data)
          // Update auction status
        })
        if (sub3) subscriptions.push(sub3)
      } catch (error) {
        console.error('Error setting up subscriptions:', error)
      }
    }

    setupSubscriptions()

    return () => {
      // Cleanup subscriptions
      subscriptions.forEach(sub => {
        if (sub && sub.unsubscribe) {
          sub.unsubscribe()
        }
      })
    }
  }, [isConnected])

  const handleWithdrawFees = async () => {
    try {
      await withdrawFees()
      alert('Fees withdrawn successfully!')
    } catch (error) {
      console.error('Error withdrawing fees:', error)
      alert('Failed to withdraw fees')
    }
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
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
                >
                  Withdraw Fees ({parseFloat(fees.toString()) / 1e18} ETH)
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
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                {showCreateForm ? 'Hide Form' : 'Create Auction'}
              </button>
            </div>

            {showCreateForm && (
              <CreateAuction />
            )}

            <div className="mb-6">
              <label htmlFor="auctionId" className="block text-sm font-medium text-gray-700 mb-1">
                Load Auction by ID
              </label>
              <div className="flex space-x-2">
                <input
                  id="auctionId"
                  type="text"
                  placeholder="Enter auction ID..."
                  value={auctionId}
                  onChange={(e) => setAuctionId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => auctionId && setAuctions([auction])}
                  disabled={!auctionId}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Load Auction
                </button>
              </div>
            </div>

            {auctionId && auction && (
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
                bids={(bids as unknown as Bid[]) || []}
                currentAddress={address}
                isSeller={auction[3].toLowerCase() === address?.toLowerCase()}
              />
            )}

            {auctions.length === 0 && !auctionId && (
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
