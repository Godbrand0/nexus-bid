'use client'

import { useState } from 'react'
import { formatEther } from 'viem'
import { usePlaceBid, useFinalizeAuction, useClaimRefund } from '@/hooks/useAuctionHouse'
import { subscribeToAuctionEvents } from '@/lib/streams'

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

interface AuctionCardProps {
  auction: Auction
  bids: Bid[]
  currentAddress?: string
  isSeller?: boolean
}

export default function AuctionCard({ auction, bids, currentAddress, isSeller }: AuctionCardProps) {
  const [bidAmount, setBidAmount] = useState('')
  const [isPlacingBid, setIsPlacingBid] = useState(false)
  
  const { placeBid } = usePlaceBid()
  const { finalizeAuction } = useFinalizeAuction()
  const { claimRefund } = useClaimRefund()

  const timeRemaining = Number(auction.endTime) - Math.floor(Date.now() / 1000)
  const hasEnded = timeRemaining <= 0
  const hasBids = auction.currentBid > 0
  const isHighestBidder = auction.highestBidder.toLowerCase() === currentAddress?.toLowerCase()
  const hasUserBid = bids.some(bid => bid.bidder.toLowerCase() === currentAddress?.toLowerCase() && !bid.refunded)

  const handlePlaceBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) return
    
    const minBid = formatEther(auction.currentBid) === '0' 
      ? formatEther(auction.startingPrice) 
      : formatEther(auction.currentBid)
    
    if (parseFloat(bidAmount) <= parseFloat(minBid)) {
      alert('Bid must be higher than current bid')
      return
    }

    setIsPlacingBid(true)
    try {
      await placeBid(auction.auctionId, bidAmount)
      setBidAmount('')
      alert('Bid placed successfully!')
    } catch (error) {
      console.error('Error placing bid:', error)
      alert('Failed to place bid')
    } finally {
      setIsPlacingBid(false)
    }
  }

  const handleFinalizeAuction = async () => {
    try {
      await finalizeAuction(auction.auctionId)
      alert('Auction finalized successfully!')
    } catch (error) {
      console.error('Error finalizing auction:', error)
      alert('Failed to finalize auction')
    }
  }

  const handleClaimRefund = async () => {
    try {
      await claimRefund(auction.auctionId)
      alert('Refund claimed successfully!')
    } catch (error) {
      console.error('Error claiming refund:', error)
      alert('Failed to claim refund')
    }
  }

  // Subscribe to real-time updates
  useState(() => {
    subscribeToAuctionEvents('BidPlaced', (data) => {
      console.log('New bid placed:', data)
      // Trigger re-render or update state
    })
  })

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Auction #{auction.auctionId.slice(0, 8)}</h3>
          <p className="text-sm text-gray-600">Token ID: {auction.tokenId.toString()}</p>
        </div>
        <div className="text-right">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            auction.isActive && !auction.isFinalized 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {auction.isActive && !auction.isFinalized ? 'Active' : 'Ended'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Starting Price</p>
          <p className="text-lg font-semibold">{formatEther(auction.startingPrice)} ETH</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Current Bid</p>
          <p className="text-lg font-semibold text-blue-600">
            {hasBids ? formatEther(auction.currentBid) : formatEther(auction.startingPrice)} ETH
          </p>
        </div>
      </div>

      {hasBids && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Highest Bidder</p>
          <p className="text-sm font-mono">{auction.highestBidder}</p>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-1">Time Remaining</p>
        <p className={`font-semibold ${timeRemaining <= 3600 ? 'text-red-600' : 'text-gray-900'}`}>
          {hasEnded ? 'Auction Ended' : `${Math.floor(timeRemaining / 3600)}h ${Math.floor((timeRemaining % 3600) / 60)}m`}
        </p>
      </div>

      {auction.isActive && !auction.isFinalized && !hasEnded && currentAddress && (
        <div className="space-y-3">
          {!isSeller && (
            <div>
              <input
                type="number"
                step="0.01"
                placeholder="Enter bid amount in ETH"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isPlacingBid}
              />
              <button
                onClick={handlePlaceBid}
                disabled={isPlacingBid || !bidAmount}
                className="w-full mt-2 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isPlacingBid ? 'Placing Bid...' : 'Place Bid'}
              </button>
            </div>
          )}

          {isSeller && hasEnded && (
            <button
              onClick={handleFinalizeAuction}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
            >
              Finalize Auction
            </button>
          )}

          {!isSeller && hasUserBid && !isHighestBidder && (
            <button
              onClick={handleClaimRefund}
              className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700"
            >
              Claim Refund
            </button>
          )}
        </div>
      )}

      {bids.length > 0 && (
        <div className="mt-6">
          <h4 className="text-md font-semibold mb-3">Bid History</h4>
          <div className="space-y-2">
            {bids.map((bid, index) => (
              <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm font-mono">{bid.bidder.slice(0, 8)}...</span>
                <span className="font-semibold">{formatEther(bid.amount)} ETH</span>
                <span className="text-xs text-gray-500">
                  {new Date(Number(bid.timestamp) * 1000).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}