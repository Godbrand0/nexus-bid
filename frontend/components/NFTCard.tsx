'use client'

import { useState } from 'react'
import { ExternalLink, ImageIcon } from 'lucide-react'
import { type NFT } from '@/lib/nft-utils'
import { formatNFTName, getPlaceholderImage, shortenAddress } from '@/lib/nft-utils'

interface NFTCardProps {
  nft: NFT
  onClick?: () => void
  onCreateAuction?: () => void
}

export default function NFTCard({ nft, onClick, onCreateAuction }: NFTCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [currentGatewayIndex, setCurrentGatewayIndex] = useState(0)

  // IPFS gateways for fallback
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://dweb.link/ipfs/',
  ]

  const getImageUrl = () => {
    if (imageError) {
      return getPlaceholderImage()
    }
    
    const image = nft.metadata?.image || getPlaceholderImage()
    
    // If it's already an HTTP URL, return as is
    if (image.startsWith('http://') || image.startsWith('https://')) {
      return image
    }
    
    // If it's an IPFS URI, convert using current gateway
    if (image.startsWith('ipfs://')) {
      const hash = image.replace('ipfs://', '')
      return `${IPFS_GATEWAYS[currentGatewayIndex]}${hash}`
    }
    
    // If it's just a hash, use current gateway
    if (image.startsWith('Qm') || image.startsWith('baf')) {
      return `${IPFS_GATEWAYS[currentGatewayIndex]}${image}`
    }
    
    return image
  }

  const imageUrl = getImageUrl()
  const nftName = formatNFTName(nft.metadata || null, nft.tokenId)
  const explorerUrl = `https://shannon-explorer.somnia.network/address/${nft.contractAddress}`


  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={onClick}
    >
      {/* NFT Image */}
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        <img
          src={imageUrl}
          alt={nftName}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          }`}
          onLoad={() => {
            console.log(`🖼️ Image loaded successfully: ${imageUrl}`)
            setImageLoading(false)
          }}
          onError={(e) => {
            console.error(`❌ Image failed to load: ${imageUrl}`, e)
            
            // Try next IPFS gateway if available
            if (currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
              console.log(`🔄 Trying next IPFS gateway: ${currentGatewayIndex + 1}`)
              setCurrentGatewayIndex(currentGatewayIndex + 1)
            } else {
              console.error('❌ All IPFS gateways failed, using placeholder')
              setImageError(true)
              setImageLoading(false)
            }
          }}
          crossOrigin="anonymous"
        />
        
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <ImageIcon className="w-12 h-12 text-white" />
          </div>
        </div>
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