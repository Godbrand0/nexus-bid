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

// Single IPFS gateway for consistency (matching AuctionList approach)
const IPFS_GATEWAY = 'https://ipfs.io/ipfs/'

// Fallback gateways for error handling (kept for compatibility)
const FALLBACK_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
]

/**
 * Convert IPFS URI to HTTP URL using single primary gateway
 */
export function ipfsToHttp(uri: string, useFallback = false, fallbackIndex = 0): string {
  if (!uri) {
    console.log('🔍 ipfsToHttp: Empty URI provided')
    return ''
  }
  
  // Trim whitespace
  uri = uri.trim()
  
  // Select gateway based on fallback preference
  const gateway = useFallback ? FALLBACK_GATEWAYS[fallbackIndex] : IPFS_GATEWAY
  console.log(`🔍 ipfsToHttp: Processing URI "${uri}" with gateway: ${gateway}`)
  
  // Already HTTP
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    console.log(`🔍 ipfsToHttp: URI is already HTTP: ${uri}`)
    return uri
  }
  
  // IPFS protocol
  if (uri.startsWith('ipfs://')) {
    const hash = uri.replace('ipfs://', '')
    const result = `${gateway}${hash}`
    console.log(`🔍 ipfsToHttp: Converted IPFS URI "${uri}" to "${result}"`)
    return result
  }
  
  // Just the hash (CIDv0 starts with Qm, CIDv1 starts with bafy/bafk/bafz)
  if (uri.startsWith('Qm') || uri.startsWith('baf')) {
    const result = `${gateway}${uri}`
    console.log(`🔍 ipfsToHttp: Converted IPFS hash "${uri}" to "${result}"`)
    return result
  }
  
  // If it looks like a CID but doesn't match above patterns, assume it's a CID
  // CIDs are typically 46+ characters and alphanumeric
  if (uri.length > 40 && /^[a-zA-Z0-9]+$/.test(uri)) {
    const result = `${gateway}${uri}`
    console.log(`🔍 ipfsToHttp: Converted potential CID "${uri}" to "${result}"`)
    return result
  }
  
  console.log(`🔍 ipfsToHttp: Returning URI as-is: ${uri}`)
  return uri
}

/**
 * Get fallback gateway URL for error handling
 */
export function getFallbackIpfsUrl(uri: string, fallbackIndex: number): string {
  return ipfsToHttp(uri, true, fallbackIndex)
}

/**
 * Fetch NFT metadata from URI with primary gateway and fallbacks
 */
export async function fetchNFTMetadata(tokenURI: string): Promise<NFTMetadata | null> {
  if (!tokenURI) {
    console.log('🔍 fetchNFTMetadata: No tokenURI provided')
    return null
  }
  
  console.log(`🔍 fetchNFTMetadata: Fetching metadata for tokenURI:`, tokenURI)
  
  // Try primary gateway first
  try {
    const url = ipfsToHttp(tokenURI, false)
    console.log(`🔍 fetchNFTMetadata: Trying primary gateway:`, url)
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })
    
    if (response.ok) {
      const metadata: NFTMetadata = await response.json()
      console.log(`🔍 fetchNFTMetadata: Successfully fetched metadata from primary gateway:`, metadata)
      
      // Convert image IPFS URI to HTTP using primary gateway
      if (metadata.image) {
        const originalImage = metadata.image
        metadata.image = ipfsToHttp(metadata.image, false)
        console.log(`🔍 fetchNFTMetadata: Converted image URL from "${originalImage}" to "${metadata.image}"`)
      }
      
      return metadata
    } else {
      console.log(`🔍 fetchNFTMetadata: Primary gateway failed with status:`, response.status)
    }
  } catch (error) {
    console.log(`🔍 fetchNFTMetadata: Primary gateway error:`, error)
  }
  
  // Try fallback gateways if primary fails
  for (let i = 0; i < FALLBACK_GATEWAYS.length; i++) {
    try {
      const url = getFallbackIpfsUrl(tokenURI, i)
      console.log(`🔍 fetchNFTMetadata: Trying fallback gateway ${i}:`, url)
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })
      
      if (!response.ok) {
        console.log(`🔍 fetchNFTMetadata: Fallback gateway ${i} failed with status:`, response.status)
        continue
      }
      
      const metadata: NFTMetadata = await response.json()
      console.log(`🔍 fetchNFTMetadata: Successfully fetched metadata from fallback gateway ${i}:`, metadata)
      
      // Convert image IPFS URI to HTTP using the same fallback gateway
      if (metadata.image) {
        const originalImage = metadata.image
        metadata.image = getFallbackIpfsUrl(metadata.image, i)
        console.log(`🔍 fetchNFTMetadata: Converted image URL from "${originalImage}" to "${metadata.image}"`)
      }
      
      return metadata
    } catch (error) {
      console.log(`🔍 fetchNFTMetadata: Fallback gateway ${i} error:`, error)
      // Try next fallback gateway
      continue
    }
  }
  
  console.log(`🔍 fetchNFTMetadata: All gateways failed for tokenURI:`, tokenURI)
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
