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
    <div className="min-h-screen bg-cream py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/" className="text-royal-blue hover:text-oxford-blue flex items-center gap-2 font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="uppercase tracking-wide text-sm">Back to Catalogue</span>
          </Link>
        </div>

        <div className="bg-white rounded-sm shadow-xl overflow-hidden border border-gray-200">
          <div className="p-8 md:p-12">
            <div className="flex justify-between items-start mb-10 border-b border-gray-100 pb-6">
              <div>
                <h1 className="text-4xl font-serif font-bold text-charcoal mb-3">Lot #{localAuction.tokenId.toString()}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="font-mono bg-gray-50 px-3 py-1 rounded border border-gray-200 text-charcoal">ID: {localAuction.auctionId.slice(0, 8)}...</span>
                  <button 
                    onClick={() => copyToClipboard(localAuction.auctionId, 'Auction ID')}
                    className="text-royal-blue hover:text-oxford-blue p-1 transition-colors"
                    title="Copy Auction ID"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className={`px-6 py-2 rounded-sm font-serif font-bold uppercase tracking-widest text-sm border ${
                localAuction.isFinalized ? 'bg-blue-50 text-royal-blue border-royal-blue' :
                isEnded ? 'bg-gray-100 text-gray-600 border-gray-300' :
                'bg-green-50 text-british-green border-british-green'
              }`}>
                {status}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Left Column - NFT Display */}
              <div className="space-y-8">
                <div className="bg-white p-4 shadow-lg border border-gray-100 rotate-1 hover:rotate-0 transition-transform duration-500">
                  <div className="relative aspect-square bg-gray-50 border border-gray-200">
                    {metadataLoading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-royal-blue"></div>
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
                </div>
                <div className="prose prose-lg max-w-none">
                  <h2 className="text-3xl font-serif font-bold text-charcoal mb-4 border-b border-gray-200 pb-2">
                    {formatNFTName(nftMetadata?.metadata || null, localAuction?.tokenId?.toString() || '')}
                  </h2>
                  {nftMetadata?.metadata?.description && (
                    <p className="text-gray-700 font-serif leading-relaxed italic">
                      "{nftMetadata.metadata.description}"
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column - Auction Info */}
              <div className="space-y-10">
                <div className="bg-cream rounded-sm p-8 border border-gray-200 shadow-inner">
                  <h3 className="text-xl font-serif font-bold text-charcoal mb-6 uppercase tracking-widest border-b border-gray-300 pb-2">Provenance & Details</h3>
                  <div className="space-y-4 font-serif">
                    <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                      <span className="text-gray-600 italic">Contract Address</span>
                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://shannon-explorer.somnia.network/address/${localAuction.nftContract}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-royal-blue hover:underline flex items-center gap-1 text-sm"
                        >
                          {localAuction.nftContract.slice(0, 10)}...{localAuction.nftContract.slice(-8)}
                        </a>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                      <span className="text-gray-600 italic">Token ID</span>
                      <span className="font-bold text-charcoal">#{localAuction.tokenId.toString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                      <span className="text-gray-600 italic">Seller</span>
                      <span className="font-mono text-sm text-charcoal">{localAuction.seller.slice(0, 10)}...{localAuction.seller.slice(-8)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-sm p-8 border-2 border-royal-blue/10 shadow-lg">
                  <h3 className="text-xl font-serif font-bold text-royal-blue mb-6 uppercase tracking-widest text-center">Current Valuation</h3>
                  <div className="space-y-6 text-center">
                    <div>
                      <span className="block text-gray-500 text-sm uppercase tracking-wide mb-1">Current Bid</span>
                      <span className="block font-serif font-bold text-5xl text-charcoal">{formatEther(localAuction.currentBid)} <span className="text-2xl text-gray-400">STT</span></span>
                    </div>
                    
                    <div className="flex justify-center gap-8 text-sm border-t border-gray-100 pt-6">
                      <div>
                        <span className="block text-gray-500 mb-1">Starting Price</span>
                        <span className="font-bold text-charcoal">{formatEther(localAuction.startingPrice)} STT</span>
                      </div>
                      <div className="w-px bg-gray-200"></div>
                      <div>
                        <span className="block text-gray-500 mb-1">Highest Bidder</span>
                        <span className="font-mono text-charcoal">
                          {localAuction.highestBidder === '0x0000000000000000000000000000000000000000' 
                            ? 'No bids' 
                            : `${localAuction.highestBidder.slice(0, 6)}...${localAuction.highestBidder.slice(-4)}`
                          }
                        </span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <span className="block text-gray-500 text-sm uppercase tracking-wide mb-2">Time Remaining</span>
                      <span className={`font-mono font-bold text-2xl ${isActive ? 'text-british-green' : 'text-burgundy'}`}>
                        {formatTimeRemaining(localAuction.endTime)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4 pt-2">
                  {isActive && !isSeller && (
                    <button
                      onClick={() => setShowBidModal(true)}
                      className="w-full bg-british-green text-white py-4 px-6 rounded-sm hover:bg-green-900 transition-all shadow-md hover:shadow-lg font-serif font-bold text-xl uppercase tracking-widest border border-green-900"
                    >
                      Place Bid
                    </button>
                  )}

                  {canFinalize && isSeller && (
                    <button
                      onClick={handleFinalize}
                      className="w-full bg-royal-blue text-white py-4 px-6 rounded-sm hover:bg-blue-900 transition-all shadow-md font-serif font-bold text-xl uppercase tracking-widest"
                    >
                      Finalize Auction
                    </button>
                  )}

                  {localAuction.isFinalized && isHighestBidder && (
                    <button
                      onClick={handleImportNFT}
                      className="w-full bg-gold text-white py-4 px-6 rounded-sm hover:bg-yellow-600 transition-all shadow-md font-serif font-bold text-xl uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Acquire Asset
                    </button>
                  )}

                  {hasBid && !isHighestBidder && !isActive && (
                    <button
                      onClick={handleClaimRefund}
                      className="w-full bg-charcoal text-white py-4 px-6 rounded-sm hover:bg-gray-800 transition-all shadow-md font-serif font-bold text-xl uppercase tracking-widest"
                    >
                      Claim Refund
                    </button>
                  )}
                </div>
              </div>

              {/* Bids Section - Full Width below */}
              <div className="lg:col-span-2 mt-8">
                <h3 className="text-2xl font-serif font-bold text-charcoal mb-6 border-b-2 border-gray-200 pb-2 flex justify-between items-end">
                  <span>Bid History</span>
                  <span className="text-base font-sans font-normal text-gray-500">{localBids.length} Bids Placed</span>
                </h3>
                
                <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider font-sans">Bidder</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider font-sans">Time</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider font-sans text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {localBids.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic font-serif">
                              No bids have been recorded for this lot yet.
                            </td>
                          </tr>
                        ) : (
                          localBids.map((bid, index) => (
                            <tr key={index} className="hover:bg-cream/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-sm ${index === 0 ? 'bg-gold text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    {index + 1}
                                  </div>
                                  <span className="font-mono text-charcoal">{bid.bidder.slice(0, 10)}...</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                                {new Date(Number(bid.timestamp) * 1000).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className="font-bold text-charcoal font-serif text-lg">{formatEther(bid.amount)} STT</span>
                                {bid.refunded && (
                                  <span className="ml-2 text-xs font-medium text-royal-blue bg-blue-50 px-2 py-0.5 rounded-full">Refunded</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-sm shadow-2xl max-w-md w-full overflow-hidden border-t-4 border-gold">
            <div className="bg-royal-blue p-8 text-white text-center">
              <h3 className="text-3xl font-serif font-bold mb-2">Place Your Bid</h3>
              <p className="opacity-80 font-sans text-sm uppercase tracking-wide">Lot #{localAuction.tokenId.toString()}</p>
            </div>
            
            <div className="p-8">
              <div className="mb-8">
                <label className="block text-sm font-bold text-charcoal mb-2 uppercase tracking-wide">
                  Bid Amount (STT)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full text-black pl-4 pr-16 py-4 border-2 border-gray-200 rounded-sm focus:outline-none focus:border-royal-blue text-2xl font-serif font-bold placeholder-gray-300"
                  />
                  <div className="absolute right-4 top-4 text-gray-400 font-bold font-serif text-xl">STT</div>
                </div>
                <div className="mt-4 flex justify-between items-center text-sm border-t border-gray-100 pt-3">
                  <span className="text-gray-600">Minimum Bid Required:</span>
                  <span className="font-bold text-british-green font-serif text-lg">
                    {formatEther(localAuction.currentBid > localAuction.startingPrice 
                      ? localAuction.currentBid + BigInt(parseEther('0.01')) 
                      : localAuction.startingPrice)} STT
                  </span>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowBidModal(false)}
                  className="flex-1 bg-gray-100 text-gray-600 py-3 px-4 rounded-sm hover:bg-gray-200 transition-colors font-bold uppercase tracking-wide text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePlaceBid}
                  disabled={isSubmitting || !bidAmount}
                  className="flex-1 bg-royal-blue text-white py-3 px-4 rounded-sm hover:bg-blue-900 disabled:bg-gray-400 transition-colors font-bold uppercase tracking-wide text-sm shadow-md"
                >
                  {isSubmitting ? 'Processing...' : 'Confirm Bid'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
