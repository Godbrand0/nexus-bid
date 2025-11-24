'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useUserNFTs } from '@/hooks/useUserNFTs'
import { formatNFTName, getPlaceholderImage, shortenAddress } from '@/lib/nft-utils'
import NFTCard from './NFTCard'
import CreateAuction from './CreateAuction'

export default function MyNFTs() {
  const { address, isConnected } = useAccount()
  const { nfts, loading, error, refetch } = useUserNFTs()
  const [selectedNFT, setSelectedNFT] = useState<string | null>(null)
  const [showCreateAuction, setShowCreateAuction] = useState(false)
  const [auctionNFT, setAuctionNFT] = useState<{ contractAddress: string; tokenId: string } | null>(null)

  const handleCreateAuction = (contractAddress: string, tokenId: string) => {
    setAuctionNFT({ contractAddress, tokenId })
    setShowCreateAuction(true)
  }

  if (!isConnected) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-md mx-auto">
          <svg
            className="w-24 h-24 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-600">Please connect your wallet to view your NFT collection</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My NFTs</h2>
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
        
        {/* Loading Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg aspect-square mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <svg
              className="w-12 h-12 text-red-500 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading NFTs</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={refetch}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My NFTs</h2>
            <p className="text-sm text-gray-600 mt-1">
              {address && `Wallet: ${shortenAddress(address)}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {nfts.length} NFT{nfts.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={refetch}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="Refresh NFTs"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {nfts.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="w-24 h-24 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No NFTs Found</h3>
            <p className="text-gray-600 mb-4">
              You don't have any NFTs in your wallet yet.
            </p>
            <p className="text-sm text-gray-500">
              NFTs you own on Somnia testnet will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              <NFTCard
                key={`${nft.contractAddress}-${nft.tokenId}`}
                nft={nft}
                onClick={() => setSelectedNFT(`${nft.contractAddress}-${nft.tokenId}`)}
                onCreateAuction={() => handleCreateAuction(nft.contractAddress, nft.tokenId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Auction Modal */}
      {showCreateAuction && auctionNFT && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Create Auction</h3>
              <button
                onClick={() => setShowCreateAuction(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ✕
              </button>
            </div>
            
            <CreateAuction
              prefillData={{
                nftContract: auctionNFT.contractAddress,
                tokenId: auctionNFT.tokenId
              }}
              onClose={() => {
                setShowCreateAuction(false)
                setAuctionNFT(null)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}