'use client'

import { useState } from 'react'
import { parseEther, formatEther } from 'viem'
import { usePlaceBid, useFinalizeAuction, useClaimRefund } from '@/hooks/useAuctionHouse'

interface AuctionCardProps {
  auction: any
  bids: any[]
  currentAddress?: string
  isSeller: boolean
}

export default function AuctionCard({ auction, bids, currentAddress, isSeller }: AuctionCardProps) {
  const [bidAmount, setBidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { placeBid } = usePlaceBid()
  const { finalizeAuction } = useFinalizeAuction()
  const { claimRefund } = useClaimRefund()

  const isActive = auction.isActive && Date.now() / 1000 < Number(auction.endTime)
  const isEnded = Date.now() / 1000 >= Number(auction.endTime)
  const canFinalize = !auction.isFinalized && isEnded

  const status = auction.isFinalized 
    ? 'Finalized' 
    : isEnded 
      ? 'Ended' 
      : 'Active'

  const handlePlaceBid = async () => {
    if (!bidAmount) return

    setIsSubmitting(true)
    try {
      // Contract will emit BidPlaced event which Somnia Data Streams will capture
      await placeBid(auction.auctionId, bidAmount, currentAddress)
      
      alert('Bid placed successfully!')
      setBidAmount('')
    } catch (error) {
      console.error('Error placing bid:', error)
      alert('Failed to place bid')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinalize = async () => {
    try {
      // Contract will emit AuctionFinalized event
      await finalizeAuction(auction.auctionId)
      
      alert('Auction finalized!')
    } catch (error) {
      console.error('Error finalizing auction:', error)
      alert('Failed to finalize auction')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg text-gray-900 font-semibold">Auction Details</h3>
          <div className="mt-2 space-y-2 text-sm text-gray-600">
            <p><span className="font-medium">NFT:</span> {auction.nftContract}</p>
            <p><span className="font-medium">Token ID:</span> {auction.tokenId?.toString()}</p>
            <p><span className="font-medium">Seller:</span> {auction.seller}</p>
            <p><span className="font-medium">Starting Price:</span> {formatEther(auction.startingPrice)} STT</p>
            <p><span className="font-medium">Current Bid:</span> {formatEther(auction.currentBid)} STT</p>
            <p><span className="font-medium">Status:</span> {status}</p>
          </div>
        </div>

        {isActive && !isSeller && (
          <div className="space-y-2">
            <input
              type="text"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="Bid amount in STT"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={handlePlaceBid}
              disabled={isSubmitting || !bidAmount}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              {isSubmitting ? 'Placing Bid...' : 'Place Bid'}
            </button>
          </div>
        )}

        {canFinalize && (
          <button
            onClick={handleFinalize}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors"
          >
            Finalize Auction
          </button>
        )}

        {bids.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 text-gray-900">Bids ({bids.length})</h4>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {bids.map((bid, i) => (
                <div key={i} className="text-sm text-gray-600 flex justify-between">
                  <span>{bid.bidder.slice(0, 10)}...</span>
                  <span>{formatEther(bid.amount)} STT</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}