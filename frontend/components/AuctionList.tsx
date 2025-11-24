'use client'

import { useMemo, useState } from 'react'
import { formatEther } from 'viem'
import Link from 'next/link'
import { useAllAuctions } from '@/hooks/useAuctionHouse'
import { useAuctionNFTMetadata } from '@/hooks/useAuctionNFTMetadata'
import { getPlaceholderImage, formatNFTName } from '@/lib/nft-utils'

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
  bids: any[]
}

interface AuctionListProps {
  currentAddress?: string
  viewMode?: 'list' | 'grid'
}

export default function AuctionList({ currentAddress, viewMode = 'grid' }: AuctionListProps) {
  const { auctions, isLoading, error } = useAllAuctions()
  const [filter, setFilter] = useState<'active' | 'ended'>('active')
  
  // Filter auctions based on selected tab
  const filteredAuctions = useMemo(() => {
    return auctions.filter(auction => {
      const isEnded = !auction.isActive || auction.isFinalized || Date.now() / 1000 >= Number(auction.endTime)
      
      if (filter === 'active') {
        return !isEnded
      } else {
        return isEnded
      }
    })
  }, [auctions, filter])

  const formatTimeRemaining = (endTime: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    const end = Number(endTime)
    const remaining = end - now
    
    if (remaining <= 0) return 'Ended'
    
    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-600">Loading auctions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setFilter('active')}
          className={`py-2 px-4 font-medium text-sm transition-colors relative ${
            filter === 'active' 
              ? 'text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Auctions
          {filter === 'active' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setFilter('ended')}
          className={`py-2 px-4 font-medium text-sm transition-colors relative ${
            filter === 'ended' 
              ? 'text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Ended Auctions
          {filter === 'ended' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
          )}
        </button>
      </div>

      {filteredAuctions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {filter} auctions found
          </h3>
          <p className="text-gray-600">
            {filter === 'active' 
              ? 'Be the first to create an auction!' 
              : 'No past auctions to display.'}
          </p>
        </div>
      ) : (
        viewMode === 'list' ? (
          <div className="space-y-4">
            {filteredAuctions.map((auction) => {
              const isEnded = Date.now() / 1000 >= Number(auction.endTime)
              const status = auction.isFinalized 
                ? 'Finalized' 
                : isEnded 
                  ? 'Ended' 
                  : 'Active'
              
              const statusColor = auction.isFinalized
                ? 'bg-blue-100 text-blue-800'
                : isEnded
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'

              return (
                <Link
                  href={`/auctions/${auction.auctionId}`}
                  key={auction.auctionId}
                  className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          NFT #{auction.tokenId.toString()}
                        </h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                          {status}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p><span className="font-medium">Auction ID:</span> <span className="font-mono text-xs bg-gray-100 px-1 rounded">{auction.auctionId.slice(0, 10)}...{auction.auctionId.slice(-8)}</span></p>
                        <p><span className="font-medium">Contract:</span> {auction.nftContract.slice(0, 10)}...{auction.nftContract.slice(-8)}</p>
                        <p><span className="font-medium">Seller:</span> {auction.seller.slice(0, 10)}...{auction.seller.slice(-8)}</p>
                        <p><span className="font-medium">Starting Price:</span> {formatEther(auction.startingPrice)} STT</p>
                        <p><span className="font-medium">Current Bid:</span> {formatEther(auction.currentBid)} STT</p>
                        <p><span className="font-medium">Bids:</span> {auction.bids?.length || 0}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium mb-1 ${
                        status === 'Active' ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {formatTimeRemaining(auction.endTime)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Ends: {new Date(Number(auction.endTime) * 1000).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => {
              const isEnded = Date.now() / 1000 >= Number(auction.endTime)
              const status = auction.isFinalized
                ? 'Finalized'
                : isEnded
                  ? 'Ended'
                  : 'Active'
              
              const statusColor = auction.isFinalized
                ? 'bg-blue-100 text-blue-800'
                : isEnded
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'

              // Get NFT metadata for this auction
              const AuctionNFTCard = () => {
                const { nftMetadata, loading: metadataLoading } = useAuctionNFTMetadata(
                  auction.nftContract,
                  auction.tokenId.toString()
                )
                
                const imageUrl = nftMetadata?.metadata?.image || getPlaceholderImage()
                const nftName = formatNFTName(nftMetadata?.metadata || null, auction.tokenId.toString())

                return (
                  <Link
                    href={`/auctions/${auction.auctionId}`}
                    key={auction.auctionId}
                    className="block bg-white rounded-lg shadow hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
                  >
                    {/* NFT Image */}
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      {metadataLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      )}
                      <img
                        src={imageUrl}
                        alt={nftName}
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${
                          metadataLoading ? 'opacity-0' : 'opacity-100'
                        }`}
                        onLoad={() => {}}
                        onError={() => {}}
                      />
                      
                      {/* Status Badge Overlay */}
                      <div className="absolute top-3 right-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor} shadow-md`}>
                          {status}
                        </span>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 truncate" title={nftName}>
                          {nftName}
                        </h3>
                        <p className="text-xs text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded w-fit inline-block mt-1">
                          ID: {auction.auctionId.slice(0, 6)}...{auction.auctionId.slice(-4)}
                        </p>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Starting Price:</span>
                          <span className="font-medium">{formatEther(auction.startingPrice)} STT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Current Bid:</span>
                          <span className="font-bold text-blue-600">{formatEther(auction.currentBid)} STT</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Bids:</span>
                          <span className="font-medium">{auction.bids?.length || 0}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {auction.seller.slice(0, 6)}...{auction.seller.slice(-4)}
                        </div>
                        <div className={`text-xs font-medium ${
                          status === 'Active' ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          {formatTimeRemaining(auction.endTime)}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              }

              return <AuctionNFTCard key={auction.auctionId} />
            })}
          </div>
        )
      )}
    </div>
  )
}