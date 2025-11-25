'use client'

import { ExternalLink, ImageIcon } from 'lucide-react'
import { type NFT } from '@/lib/nft-utils'
import { formatNFTName, getPlaceholderImage, shortenAddress } from '@/lib/nft-utils'

interface NFTCardProps {
  nft: NFT
  onClick?: () => void
  onCreateAuction?: () => void
}

export default function NFTCard({ nft, onClick, onCreateAuction }: NFTCardProps) {
  console.log('🔍 DEBUG: NFTCard received nft:', nft)
  console.log('🔍 DEBUG: NFTCard nft.tokenId:', nft?.tokenId)
  console.log('🔍 DEBUG: NFTCard nft.contractAddress:', nft?.contractAddress)
  
  // Simple image URL - use metadata image or placeholder (matching AuctionList approach)
  const imageUrl = nft.metadata?.image || getPlaceholderImage()
  
  console.log(`🔍 NFTCard: Image URL for NFT ${nft.tokenId}:`, imageUrl)

  const nftName = formatNFTName(nft.metadata || null, nft.tokenId)
  const explorerUrl = `https://shannon-explorer.somnia.network/address/${nft.contractAddress}`


  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      {/* NFT Image */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={nftName}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        
          crossOrigin="anonymous"
        />
        
       
      </div>

      {/* NFT Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900 truncate" title={nftName}>
          {nftName}
        </h3>
        
        <div className="mt-2 space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Token ID:</span>
            <span className="font-mono text-gray-900">#{nft.tokenId}</span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Contract:</span>
            <span className="font-mono text-gray-900 text-xs" title={nft.contractAddress}>
              {shortenAddress(nft.contractAddress, 3)}
            </span>
          </div>
        </div>

        {/* Description (if available) */}
        {nft.metadata?.description && (
          <p className="mt-3 text-sm text-gray-600 line-clamp-2" title={nft.metadata.description}>
            {nft.metadata.description}
          </p>
        )}

        {/* Attributes (if available) */}
        {nft.metadata?.attributes && nft.metadata.attributes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {nft.metadata.attributes.slice(0, 3).map((attr, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                title={`${attr.trait_type}: ${attr.value}`}
              >
                {attr.trait_type}
              </span>
            ))}
            {nft.metadata.attributes.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{nft.metadata.attributes.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCreateAuction?.()
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2.5 px-4 rounded-md hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-medium shadow-md hover:shadow-lg"
          >
            Create Auction
          </button>
          
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <ExternalLink size={14} />
            View on Explorer
          </a>
        </div>
      </div>
    </div>
  )
}