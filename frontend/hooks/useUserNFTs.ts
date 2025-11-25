'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePublicClient, useAccount } from 'wagmi'
import { type Address } from 'viem'
import { NFT, fetchNFTMetadata, cacheMetadata, getCachedMetadata } from '@/lib/nft-utils'

/**
 * Hook to fetch user's NFTs from Somnia blockchain using Blockscout API
 * 
 * Uses the Blockscout API to get current NFT holdings directly,
 * which is much faster than scanning blockchain events
 */

interface UseUserNFTsResult {
  nfts: NFT[]
  loading: boolean
  error: string | null
  refetch: () => void
}

// Blockscout API base URL for Somnia network
const BLOCKSCOUT_API_BASE = 'https://shannon-explorer.somnia.network/api/v1'

export function useUserNFTs(): UseUserNFTsResult {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  
  const [nfts, setNfts] = useState<NFT[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNFTs = useCallback(async () => {
    if (!address || !publicClient) {
      setNfts([])
      return
    }

    setLoading(true)
    setError(null)

    try {

      // Fetch ERC-721 tokens using Blockscout API
      const response = await fetch(
        `${BLOCKSCOUT_API_BASE}?module=account&action=tokenlist&address=${address}&page=1&offset=100`
      )

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.status !== '1') {
        throw new Error(data.message || 'API returned error status')
      }


      // Filter for ERC-721 tokens only
      const erc721Tokens = data.result.filter((token: any) => token.type === 'ERC-721')

      const nftArray: NFT[] = []

      // For each ERC-721 contract, get the specific token IDs
      for (const token of erc721Tokens) {
        try {
          // Get NFT transfer events to find specific token IDs owned by the user
          const transferResponse = await fetch(
            `${BLOCKSCOUT_API_BASE}?module=account&action=tokennfttx&contractaddress=${token.contractAddress}&address=${address}&page=1&offset=1000`
          )

          if (!transferResponse.ok) {
            continue
          }

          const transferData = await transferResponse.json()
          
          if (transferData.status !== '1') {
            continue
          }

          // Process transfers to find current ownership
          const tokenOwnership = new Map<string, 'owned' | 'sent'>()

          for (const tx of transferData.result) {
            const tokenId = tx.tokenID
            const from = tx.from.toLowerCase()
            const to = tx.to.toLowerCase()
            const userAddress = address.toLowerCase()

            if (from === userAddress) {
              // User sent this token
              tokenOwnership.set(tokenId, 'sent')
            } else if (to === userAddress) {
              // User received this token
              tokenOwnership.set(tokenId, 'owned')
            }
          }

          // Add only tokens currently owned by the user
          for (const [tokenId, status] of tokenOwnership.entries()) {
            if (status === 'owned') {
              console.log('🔍 DEBUG: Creating NFT object for tokenId:', tokenId)
              console.log('🔍 DEBUG: Token contract address:', token.contractAddress)
              
              const nft: NFT = {
                tokenId,
                contractAddress: token.contractAddress,
                owner: address,
              }
              
              console.log('🔍 DEBUG: Created NFT object:', nft)

              // Try to get cached metadata first
              let metadata = getCachedMetadata(token.contractAddress, tokenId)
              console.log(`🔍 useUserNFTs: Cached metadata for ${token.contractAddress}:${tokenId}:`, metadata)

              // If not cached, fetch token URI and metadata
              if (!metadata) {
                try {
                  console.log(`🔍 useUserNFTs: Fetching tokenURI for ${token.contractAddress}:${tokenId}`)
                  // Fetch token URI
                  const tokenURI = await publicClient.readContract({
                    address: token.contractAddress as Address,
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
                  console.log(`🔍 useUserNFTs: Got tokenURI for ${token.contractAddress}:${tokenId}:`, tokenURI)

                  // Fetch metadata
                  metadata = await fetchNFTMetadata(tokenURI)
                  console.log(`🔍 useUserNFTs: Fetched metadata for ${token.contractAddress}:${tokenId}:`, metadata)
                  if (metadata) {
                    cacheMetadata(token.contractAddress, tokenId, metadata)
                    console.log(`🔍 useUserNFTs: Cached metadata for ${token.contractAddress}:${tokenId}`)
                  } else {
                    console.log(`🔍 useUserNFTs: Failed to fetch metadata for ${token.contractAddress}:${tokenId}`)
                  }
                } catch (err) {
                  console.error(`🔍 useUserNFTs: Error fetching metadata for ${token.contractAddress}:${tokenId}:`, err)
                }
              }

              if (metadata) {
                nft.metadata = metadata
              }
              // Don't set fallback metadata with empty image - let NFTCard handle missing metadata
              console.log(`🔍 useUserNFTs: Final metadata for ${token.contractAddress}:${tokenId}:`, nft.metadata)
              nftArray.push(nft)
            }
          }
        } catch (err) {
        }
      }

      setNfts(nftArray)
    } catch (err) {
      
      // Provide more specific error messages
      let errorMessage = 'Failed to fetch NFTs'
      if (err instanceof Error) {
        if (err.message.includes('API request failed')) {
          errorMessage = 'Unable to connect to the blockchain explorer. Please try again later.'
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
  }, [address, publicClient])

  useEffect(() => {
    fetchNFTs()
  }, [fetchNFTs])

  return {
    nfts,
    loading,
    error,
    refetch: fetchNFTs,
  }
}
