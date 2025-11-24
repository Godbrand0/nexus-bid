'use client'

import { useState, useEffect } from 'react'
import { formatEther, parseEther } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuction, useAuctionBids, usePlaceBid, useFinalizeAuction, useClaimRefund } from '@/hooks/useAuctionHouse'
import { useAuctionNFTMetadata } from '@/hooks/useAuctionNFTMetadata'
import { subscribeToBids, unsubscribe } from '@/lib/streams'
import { AUCTION_HOUSE_ADDRESS } from '@/contracts'
import { getPlaceholderImage, formatNFTName } from '@/lib/nft-utils'

interface Bid {
  bidder: string
  amount: bigint
  timestamp: bigint
  refunded: boolean
}

export default function AuctionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const auctionId = params.id as string
  const { address: currentAddress } = useAccount()
  
  const { auction: fetchedAuction, isLoading: auctionLoading, error: auctionError } = useAuction(auctionId)
  const { bids: fetchedBids, isLoading: bidsLoading } = useAuctionBids(auctionId)
  
  const [bidAmount, setBidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showBidModal, setShowBidModal] = useState(false)
  const [localBids, setLocalBids] = useState<Bid[]>([])
  const [localAuction, setLocalAuction] = useState<any>(null)
  
  // Get NFT metadata for the auction item
  const { nftMetadata, loading: metadataLoading } = useAuctionNFTMetadata(
    localAuction?.nftContract || '',
    localAuction?.tokenId?.toString() || ''
  )
  
  const { placeBid } = usePlaceBid()
  const { finalizeAuction } = useFinalizeAuction()
  const { claimRefund } = useClaimRefund()
  const publicClient = usePublicClient()

  // Initialize local state when data is fetched
  useEffect(() => {
    if (fetchedAuction) {
      setLocalAuction({
        auctionId: fetchedAuction[0],
        nftContract: fetchedAuction[1],
        tokenId: fetchedAuction[2],
        seller: fetchedAuction[3],
        startingPrice: fetchedAuction[4],
        currentBid: fetchedAuction[5],
        highestBidder: fetchedAuction[6],
        startTime: fetchedAuction[7],
        endTime: fetchedAuction[8],
        isActive: fetchedAuction[9],
        isFinalized: fetchedAuction[10]
      })
    }
  }, [fetchedAuction])

  useEffect(() => {
    if (fetchedBids) {
      // Sort bids by timestamp descending (newest first)
      const sortedBids = [...(fetchedBids as any[])].sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
      setLocalBids(sortedBids)
    }
  }, [fetchedBids])

  // Subscribe to real-time bid updates via WebSocket
  useEffect(() => {
    if (!auctionId) return

    let subscription: any = null
    
    const setupSubscription = async () => {
      try {
        console.log('📡 Setting up bid subscription for auction:', auctionId)
        
        subscription = await subscribeToBids(
          AUCTION_HOUSE_ADDRESS,
          auctionId,
          (bidData) => {
            console.log('🔥 New bid received via WebSocket:', bidData)
            
            // Update local state with new bid
            const newBid: Bid = {
              bidder: bidData.bidder,
              amount: bidData.amount,
              timestamp: bidData.timestamp,
              refunded: false
            }
            
            setLocalBids(prev => [newBid, ...prev])
            
            // Update auction current bid and highest bidder
            setLocalAuction((prev: any) => {
              if (!prev) return prev
              return {
                ...prev,
                currentBid: bidData.amount,
                highestBidder: bidData.bidder
              }
            })
          },
          (error) => {
            // WebSocket errors are handled in streams.ts
            console.warn('⚠️ Bid subscription error:', error)
          }
        )
        
        console.log('✅ WebSocket subscription active - you will see real-time bid updates')
      } catch (error) {
        // WebSocket connection failed - this is normal if the endpoint doesn't support WS
        console.warn('⚠️ Real-time updates unavailable. Please refresh the page to see new bids.')
        // The dApp continues to work normally, users just need to refresh to see new bids
      }
    }

    setupSubscription()

    return () => {
      if (subscription) {
        unsubscribe(subscription)
      }
    }
  }, [auctionId])

  if (auctionLoading || !localAuction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <div className="text-gray-600">Loading auction details...</div>
        </div>
      </div>
    )
  }

  if (auctionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Auction</h2>
          <p className="text-gray-600 mb-6">{auctionError.message}</p>
          <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  const handlePlaceBid = async () => {
    if (!bidAmount) {
      alert('Please enter a bid amount')
      return
    }

    const bidInWei = parseEther(bidAmount)
    
    // Check if bid is higher than current bid
    if (bidInWei <= localAuction.currentBid) {
      alert(`Bid must be higher than current bid of ${formatEther(localAuction.currentBid)} STT`)
      return
    }

    // Check if bid is higher than starting price
    if (bidInWei < localAuction.startingPrice) {
      alert(`Bid must be at least ${formatEther(localAuction.startingPrice)} STT`)
      return
    }

    setIsSubmitting(true)
    try {
      // Contract will emit BidPlaced event which will be captured by our WebSocket subscription
      const txHash = await placeBid(localAuction.auctionId, bidAmount, currentAddress)
      console.log('Bid transaction sent:', txHash)
      
      // Wait for transaction to be mined
      if (txHash && publicClient) {
        console.log('Waiting for transaction confirmation...')
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
        console.log('Transaction confirmed:', receipt)
        
        if (receipt.status === 'success') {
          alert('Bid placed successfully!')
          
          // Manually update local state immediately
          const newBid: Bid = {
            bidder: currentAddress || '',
            amount: bidInWei,
            timestamp: BigInt(Math.floor(Date.now() / 1000)),
            refunded: false
          }
          
          setLocalBids(prev => [newBid, ...prev])
          
          setLocalAuction((prev: any) => ({
            ...prev,
            currentBid: bidInWei,
            highestBidder: currentAddress
          }))
          
          setBidAmount('')
          setShowBidModal(false)
        } else {
          throw new Error('Transaction failed')
        }
      }
    } catch (error) {
      console.error('Error placing bid:', error)
      alert('Failed to place bid: ' + (error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinalize = async () => {
    try {
      // Contract will emit AuctionFinalized event
      await finalizeAuction(localAuction.auctionId)
      
      alert('Auction finalized!')
      window.location.reload()
    } catch (error) {
      console.error('Error finalizing auction:', error)
      alert('Failed to finalize auction')
    }
  }

  const handleClaimRefund = async () => {
    try {
      // Contract will emit BidRefunded event
      await claimRefund(localAuction.auctionId)
      
      alert('Refund claimed successfully!')
      window.location.reload()
    } catch (error) {
      console.error('Error claiming refund:', error)
      alert('Failed to claim refund')
    }
  }

  const handleImportNFT = async () => {
    try {
      // Check if wallet supports watchAsset
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet')
        return
      }

      // Type the ethereum request properly
      const ethereum = window.ethereum as any
      const watchAssetParams = {
        type: 'ERC721',
        options: {
          address: localAuction.nftContract,
          tokenId: localAuction.tokenId.toString(),
        },
      }

      // Request to add NFT to wallet
      const wasAdded = await ethereum.request({
        method: 'wallet_watchAsset',
        params: [watchAssetParams],
      })

      if (wasAdded) {
        alert('NFT imported successfully! Check your wallet.')
      } else {
        alert('NFT import was cancelled')
      }
    } catch (error) {
      console.error('Error importing NFT:', error)
      alert('Failed to import NFT: ' + (error as Error).message)
    }
  }

  const formatTimeRemaining = (endTime: bigint) => {
    const now = Math.floor(Date.now() / 1000)
    const end = Number(endTime)
    const remaining = end - now
    
    if (remaining <= 0) return 'Ended'
    
    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const isSeller = localAuction.seller.toLowerCase() === currentAddress?.toLowerCase()
  const isEnded = Date.now() / 1000 >= Number(localAuction.endTime)
  const isActive = localAuction.isActive && !isEnded
  const canFinalize = !localAuction.isFinalized && isEnded
  const hasBid = localBids.some(bid => bid.bidder.toLowerCase() === currentAddress?.toLowerCase())
  const isHighestBidder = localAuction.highestBidder.toLowerCase() === currentAddress?.toLowerCase()

  const status = localAuction.isFinalized 
    ? 'Finalized' 
    : isEnded 
      ? 'Ended' 
      : 'Active'
  
  const statusColor = localAuction.isFinalized
    ? 'bg-blue-100 text-blue-800'
    : isEnded
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-green-100 text-green-800'

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    alert(`Copied ${label} to clipboard!`)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Auctions
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Auction Details</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">ID: {localAuction.auctionId}</span>
                  <button 
                    onClick={() => copyToClipboard(localAuction.auctionId, 'Auction ID')}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Copy Auction ID"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full font-medium ${statusColor}`}>
                {status}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Left Column - NFT Display */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="relative aspect-square bg-gray-100">
                    {metadataLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    <img
                      src={nftMetadata?.metadata?.image || getPlaceholderImage()}
                      alt={formatNFTName(nftMetadata?.metadata || null, localAuction?.tokenId?.toString() || '')}
                      className={`w-full h-full object-cover ${
                        metadataLoading ? 'opacity-0' : 'opacity-100'
                      }`}
                      onLoad={() => {}}
                      onError={() => {}}
                    />
                  </div>
                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {formatNFTName(nftMetadata?.metadata || null, localAuction?.tokenId?.toString() || '')}
                    </h2>
                    {nftMetadata?.metadata?.description && (
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {nftMetadata.metadata.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Auction Info */}
              <div className="space-y-8">
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Asset Information</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">NFT Contract</span>
                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://shannon-explorer.somnia.network/address/${localAuction.nftContract}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {localAuction.nftContract.slice(0, 10)}...{localAuction.nftContract.slice(-8)}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                        <button 
                          onClick={() => copyToClipboard(localAuction.nftContract, 'NFT Contract')}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copy Contract Address"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-gray-600 items-center py-2 border-b border-gray-200">
                      <span className="">Token ID</span>
                      <span className="font-bold text-lg">#{localAuction.tokenId.toString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-600">Seller</span>
                      <span className="font-mono text-sm text-gray-800">{localAuction.seller.slice(0, 10)}...{localAuction.seller.slice(-8)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">Price & Status</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Starting Price</span>
                      <span className="font-medium text-lg text-gray-600">{formatEther(localAuction.startingPrice)} STT</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Current Bid</span>
                      <span className="font-bold text-2xl text-blue-600">{formatEther(localAuction.currentBid)} STT</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Highest Bidder</span>
                      <span className="font-mono text-sm text-gray-600">
                        {localAuction.highestBidder === '0x0000000000000000000000000000000000000000' 
                          ? 'No bids yet' 
                          : `${localAuction.highestBidder.slice(0, 10)}...${localAuction.highestBidder.slice(-8)}`
                        }
                      </span>
                    </div>
                    
                    {localAuction.isFinalized && (
                      <div className="flex justify-between items-center pt-4 border-t border-blue-200 mt-4 bg-green-50 p-3 rounded-lg">
                        <span className="text-green-800 font-bold">Winner</span>
                        <span className="font-mono text-sm text-green-800 font-bold">
                          {localAuction.highestBidder === '0x0000000000000000000000000000000000000000'
                            ? 'No Winner'
                            : `${localAuction.highestBidder.slice(0, 10)}...${localAuction.highestBidder.slice(-8)}`
                          }
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t border-blue-200 mt-4">
                      <span className="text-gray-600">Time Remaining</span>
                      <span className={`font-bold text-xl ${isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {formatTimeRemaining(localAuction.endTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4">
                  {isActive && !isSeller && (
                    <button
                      onClick={() => setShowBidModal(true)}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg transform hover:-translate-y-0.5"
                    >
                      Place Bid
                    </button>
                  )}

                  {canFinalize && isSeller && (
                    <button
                      onClick={handleFinalize}
                      className="w-full bg-purple-600 text-white py-4 px-6 rounded-xl hover:bg-purple-700 transition-all shadow-lg font-bold text-lg"
                    >
                      Finalize Auction
                    </button>
                  )}

                  {localAuction.isFinalized && isHighestBidder && (
                    <button
                      onClick={handleImportNFT}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-6 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg flex items-center justify-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Import NFT to Wallet
                    </button>
                  )}

                  {hasBid && !isHighestBidder && !isActive && (
                    <button
                      onClick={handleClaimRefund}
                      className="w-full bg-gray-600 text-white py-4 px-6 rounded-xl hover:bg-gray-700 transition-all shadow-lg font-bold text-lg"
                    >
                      Claim Refund
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column - Bids */}
              <div className="flex flex-col h-full">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  Bid History 
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">{localBids.length}</span>
                </h3>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex-1 overflow-hidden flex flex-col">
                  <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                    {localBids.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No bids placed yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {localBids.map((bid, index) => (
                          <div key={index} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center text-blue-600 font-bold">
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="font-mono font-medium text-gray-900">
                                    {bid.bidder.slice(0, 10)}...{bid.bidder.slice(-8)}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(Number(bid.timestamp) * 1000).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-gray-900">{formatEther(bid.amount)} STT</div>
                                {bid.refunded && (
                                  <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">Refunded</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-transparent bg-blur flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
              <h3 className="text-2xl font-bold">Place Your Bid</h3>
              <p className="opacity-90 mt-1">Join the auction for Token #{localAuction.tokenId.toString()}</p>
            </div>
            
            <div className="p-8">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bid Amount (STT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full text-slate-700 pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                  />
                  <div className="absolute right-4 top-3.5 text-gray-400 font-medium">STT</div>
                </div>
                <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex justify-between mb-1">
                    <span>Current Bid:</span>
                    <span className="font-medium">{formatEther(localAuction.currentBid)} STT</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>Minimum Bid:</span>
                    <span className="font-bold">
                      {formatEther(localAuction.currentBid > localAuction.startingPrice 
                        ? localAuction.currentBid + BigInt(parseEther('0.01')) 
                        : localAuction.startingPrice)} STT
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowBidModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceBid}
                  disabled={isSubmitting || !bidAmount}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-bold shadow-md"
                >
                  {isSubmitting ? 'Placing...' : 'Confirm Bid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
