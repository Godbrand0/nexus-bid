/**
 * NFT Utility Functions
 * 
 * Handles NFT metadata fetching, IPFS resolution, and data formatting
 */

export interface NFTMetadata {
  name: string
  description: string
  image: string
  attributes?: Array<{
    trait_type: string
    value: string | number
  }>
  external_url?: string
}

export interface NFT {
  tokenId: string
  contractAddress: string
  owner: string
  metadata?: NFTMetadata
  tokenURI?: string
}

// IPFS gateways with fallbacks
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
]

/**
 * Convert IPFS URI to HTTP URL
 */
export function ipfsToHttp(uri: string, gatewayIndex = 0): string {
  if (!uri) return ''
  
  // Trim whitespace
  uri = uri.trim()
  
  // Already HTTP
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri
  }
  
  // IPFS protocol
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '')
    return `${IPFS_GATEWAYS[gatewayIndex]}${hash}`
  }
  
  // Just the hash (CIDv0 starts with Qm, CIDv1 starts with bafy/bafk/bafz)
  if (uri.startsWith('Qm') || uri.startsWith('baf')) {
    return `${IPFS_GATEWAYS[gatewayIndex]}${uri}`
  }
  
  // If it looks like a CID but doesn't match above patterns, assume it's a CID
  // CIDs are typically 46+ characters and alphanumeric
  if (uri.length > 40 && /^[a-zA-Z0-9]+$/.test(uri)) {
    return `${IPFS_GATEWAYS[gatewayIndex]}${uri}`
  }
  
  return uri
}

/**
 * Fetch NFT metadata from URI with fallback gateways
 */
export async function fetchNFTMetadata(tokenURI: string): Promise<NFTMetadata | null> {
  if (!tokenURI) return null
  
  
  // Try each IPFS gateway
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    try {
      const url = ipfsToHttp(tokenURI, i)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
      
      if (!response.ok) {
        continue
      }
      
      const metadata: NFTMetadata = await response.json()
      
      // Convert image IPFS URI to HTTP if needed
      if (metadata.image) {
        const originalImage = metadata.image
        metadata.image = ipfsToHttp(metadata.image, i)
      }
      
      return metadata
    } catch (error) {
      // Try next gateway
      continue
    }
  }
  
  return null
}

/**
 * Cache metadata in localStorage
 */
export function cacheMetadata(contractAddress: string, tokenId: string, metadata: NFTMetadata): void {
  try {
    const key = `nft_metadata_${contractAddress}_${tokenId}`
    localStorage.setItem(key, JSON.stringify({
      metadata,
      timestamp: Date.now(),
    }))
  } catch (error) {
  }
}

/**
 * Get cached metadata from localStorage
 */
export function getCachedMetadata(contractAddress: string, tokenId: string): NFTMetadata | null {
  try {
    const key = `nft_metadata_${contractAddress}_${tokenId}`
    const cached = localStorage.getItem(key)
    
    if (!cached) return null
    
    const { metadata, timestamp } = JSON.parse(cached)
    
    // Cache expires after 24 hours
    const CACHE_DURATION = 24 * 60 * 60 * 1000
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key)
      return null
    }
    
    return metadata
  } catch (error) {
    return null
  }
}

/**
 * Format NFT display name
 */
export function formatNFTName(metadata: NFTMetadata | null, tokenId: string): string {
  if (metadata?.name) {
    return metadata.name
  }
  return `NFT #${tokenId}`
}

/**
 * Get placeholder image for failed loads
 */
export function getPlaceholderImage(): string {
  // SVG placeholder
  return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af"%3ENFT%3C/text%3E%3C/svg%3E'
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!isValidAddress(address)) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
