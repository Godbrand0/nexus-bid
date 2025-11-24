'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { type Address } from 'viem'

/**
 * Hook to handle NFT approval for AuctionHouse contract
 * 
 * Provides functions to check approval status and approve NFTs
 */

interface UseNFTApprovalResult {
  isApproved: boolean
  isCheckingApproval: boolean
  approveNFT: () => Promise<void>
  isApproving: boolean
  approvalHash: string | undefined
  approvalError: Error | null
}

const ERC721_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getApproved',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'setApprovalForAll',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
  {
    name: 'isApprovedForAll',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export function useNFTApproval(
  nftContract: Address | undefined,
  tokenId: bigint | undefined,
  auctionHouseAddress: Address,
  ownerAddress: Address | undefined
): UseNFTApprovalResult {
  const [approvalError, setApprovalError] = useState<Error | null>(null)

  // Check if specific token is approved
  const { data: approvedAddress, isLoading: isCheckingTokenApproval } = useReadContract({
    address: nftContract,
    abi: ERC721_ABI,
    functionName: 'getApproved',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: !!nftContract && tokenId !== undefined,
    },
  })

  // Check if operator is approved for all tokens
  const { data: isApprovedForAll, isLoading: isCheckingOperatorApproval } = useReadContract({
    address: nftContract,
    abi: ERC721_ABI,
    functionName: 'isApprovedForAll',
    args: ownerAddress && nftContract ? [ownerAddress, auctionHouseAddress] : undefined,
    query: {
      enabled: !!nftContract && !!ownerAddress,
    },
  })

  // Write contract for approval
  const { writeContract, data: hash, isPending, error } = useWriteContract()

  // Wait for transaction confirmation
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
  })

  // Determine if approved
  const isApproved =
    (approvedAddress?.toLowerCase() === auctionHouseAddress.toLowerCase()) ||
    (isApprovedForAll === true)

  const isCheckingApproval = isCheckingTokenApproval || isCheckingOperatorApproval

  const approveNFT = async () => {
    if (!nftContract || tokenId === undefined) {
      const error = new Error('NFT contract or token ID not provided')
      setApprovalError(error)
      throw error
    }

    try {
      setApprovalError(null)
      
      // Approve the specific token
      writeContract({
        address: nftContract,
        abi: ERC721_ABI,
        functionName: 'approve',
        args: [auctionHouseAddress, tokenId],
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve NFT')
      setApprovalError(error)
      throw error
    }
  }

  return {
    isApproved,
    isCheckingApproval,
    approveNFT,
    isApproving: isPending || isConfirming,
    approvalHash: hash,
    approvalError: approvalError || error || null,
  }
}
