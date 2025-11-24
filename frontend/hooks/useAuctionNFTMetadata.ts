'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePublicClient } from 'wagmi'
import { type Address } from 'viem'
import { NFT, fetchNFTMetadata, cacheMetadata, getCachedMetadata } from '@/lib/nft-utils'

/**
 * Hook to fetch NFT metadata for auction items using Blockscout API
 * 
 * This hook fetches NFT metadata for specific contract addresses and token IDs
 * using the Blockscout API for faster loading
 */

interface UseAuctionNFTMetadataResult {
  nftMetadata: NFT | null
  loading: boolean
  error: string | null
  refetch: () => void
}

// Blockscout API base URL for Somnia network
const BLOCKSCOUT_API_BASE = 'https://shannon-explorer.somnia.network/api/v1'

export function useAuctionNFTMetadata(contractAddress: string, tokenId: string): UseAuctionNFTMetadataResult {
  const publicClient = usePublicClient()
  
  const [nftMetadata, setNftMetadata] = useState<NFT | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetadata = useCallback(async () => {
    if (!contractAddress || !tokenId || !publicClient) {
      setNftMetadata(null)
      return
    }

    setLoading(true)
    setError(null)

    try {

      // Try to get cached metadata first
      let metadata = getCachedMetadata(contractAddress, tokenId)
      
      const nft: NFT = {
        tokenId,
        contractAddress,
        owner: '', // Not needed for auction display
      }

      // If not cached, fetch token URI and metadata
      if (!metadata) {
        try {
          // Fetch token URI from contract
          const tokenURI = await publicClient.readContract({
            address: contractAddress as Address,
            abi: [
              {
                name: 'tokenURI',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'tokenId', type: 'uint256' }],
                outputs: [{ name: '', type: 'string' }],
              },
            ],
            functionName: 'tokenURI',
            args: [BigInt(tokenId)],
          }) as string

          nft.tokenURI = tokenURI

          // Fetch metadata from token URI
          metadata = await fetchNFTMetadata(tokenURI)
          if (metadata) {
            cacheMetadata(contractAddress, tokenId, metadata)
          }
        } catch (err) {
          // Try to get basic info from Blockscout API as fallback
          try {
            const response = await fetch(
              `${BLOCKSCOUT_API_BASE}?module=account&action=tokennfttx&contractaddress=${contractAddress}&page=1&offset=10`
            )
            
            if (response.ok) {
              const data = await response.json()
              if (data.status === '1') {
                // Note: Blockscout doesn't provide image URLs, so we skip creating metadata here
                console.log(`🔍 useAuctionNFTMetadata: Found token in Blockscout but no image available`)
              }
            }
          } catch (apiErr) {
            console.error(`🔍 useAuctionNFTMetadata: Blockscout API error:`, apiErr)
          }
        }
      }

      if (metadata) {
        nft.metadata = metadata
      }
      // Don't set fallback metadata with empty image - let components handle missing metadata

      setNftMetadata(nft)
    } catch (err) {
      
      // Provide more specific error messages
      let errorMessage = 'Failed to fetch NFT metadata'
      if (err instanceof Error) {
        if (err.message.includes('API request failed')) {
          errorMessage = 'Unable to connect to blockchain explorer. Please try again later.'
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'Network error occurred while fetching NFT data. Please check your connection.'
        } else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [contractAddress, tokenId, publicClient])

  useEffect(() => {
    fetchMetadata()
  }, [fetchMetadata])

  return {
    nftMetadata,
    loading,
    error,
    refetch: fetchMetadata,
  }
}