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
    <div className="bg-white rounded-sm shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
      <div className="p-6 space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <h3 className="text-xl font-serif font-bold text-charcoal mb-1">Lot #{auction.tokenId?.toString()}</h3>
          <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">
            {auction.nftContract.slice(0, 6)}...{auction.nftContract.slice(-4)}
          </p>
        </div>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Seller</span>
            <span className="font-mono text-gray-800 bg-gray-50 px-2 py-1 rounded">
              {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Starting Price</span>
            <span className="font-serif text-gray-900">{formatEther(auction.startingPrice)} STT</span>
          </div>
          <div className="flex justify-between items-center bg-cream p-2 rounded border border-gray-100">
            <span className="text-royal-blue font-bold">Current Bid</span>
            <span className="font-serif font-bold text-lg text-royal-blue">{formatEther(auction.currentBid)} STT</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Status</span>
            <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-sm ${
              status === 'Active' ? 'bg-green-100 text-british-green' : 
              status === 'Ended' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-royal-blue'
            }`}>
              {status}
            </span>
          </div>
        </div>

        {isActive && !isSeller && (
          <div className="space-y-3 pt-2">
            <input
              type="text"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="Bid amount in STT"
              className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-1 focus:ring-royal-blue focus:border-royal-blue text-black placeholder-gray-400 font-serif"
            />
            <button
              onClick={handlePlaceBid}
              disabled={isSubmitting || !bidAmount}
              className="w-full bg-british-green text-white py-2.5 px-4 rounded-sm hover:bg-green-900 disabled:bg-gray-400 transition-colors font-serif font-bold uppercase tracking-wide text-sm"
            >
              {isSubmitting ? 'Placing Bid...' : 'Place Bid'}
            </button>
          </div>
        )}

        {canFinalize && (
          <button
            onClick={handleFinalize}
            className="w-full bg-royal-blue text-white py-2.5 px-4 rounded-sm hover:bg-blue-900 transition-colors font-serif font-bold uppercase tracking-wide text-sm"
          >
            Finalize Auction
          </button>
        )}

        {bids.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <h4 className="font-serif font-bold mb-3 text-charcoal text-sm uppercase tracking-wide">Recent Bids</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {bids.map((bid, i) => (
                <div key={i} className="text-sm flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600 font-mono text-xs">{bid.bidder.slice(0, 8)}...</span>
                  <span className="font-medium text-charcoal">{formatEther(bid.amount)} STT</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}