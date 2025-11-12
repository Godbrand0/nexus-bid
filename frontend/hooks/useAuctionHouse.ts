import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { AUCTION_HOUSE_ABI, AUCTION_HOUSE_ADDRESS } from '@/contracts'
import { parseEther, formatEther } from 'viem'

export function useCreateAuction() {
  const { writeContract, data, error, isPending } = useWriteContract()
  
  const createAuction = async (
    nftContract: string,
    tokenId: bigint,
    startingPrice: string,
    duration: number
  ) => {
    const priceInWei = parseEther(startingPrice)
    
    return writeContract({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'createAuction',
      args: [nftContract as `0x${string}`, tokenId, priceInWei, BigInt(duration)]
    })
  }
  
  return { createAuction, data: data as any, error, isPending }
}

export function usePlaceBid() {
  const { writeContract, data, error, isPending } = useWriteContract()
  
  const placeBid = async (auctionId: string, bidAmount: string) => {
    const bidInWei = parseEther(bidAmount)
    
    return writeContract({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'placeBid',
      args: [auctionId as `0x${string}`],
      value: bidInWei
    })
  }
  
  return { placeBid, data, error, isPending }
}

export function useFinalizeAuction() {
  const { writeContract, data, error, isPending } = useWriteContract()
  
  const finalizeAuction = async (auctionId: string) => {
    return writeContract({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'finalizeAuction',
      args: [auctionId as `0x${string}`]
    })
  }
  
  return { finalizeAuction, data, error, isPending }
}

export function useClaimRefund() {
  const { writeContract, data, error, isPending } = useWriteContract()
  
  const claimRefund = async (auctionId: string) => {
    return writeContract({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'claimRefund',
      args: [auctionId as `0x${string}`]
    })
  }
  
  return { claimRefund, data, error, isPending }
}

export function useCancelAuction() {
  const { writeContract, data, error, isPending } = useWriteContract()
  
  const cancelAuction = async (auctionId: string) => {
    return writeContract({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'cancelAuction',
      args: [auctionId as `0x${string}`]
    })
  }
  
  return { cancelAuction, data, error, isPending }
}

export function useWithdrawFees() {
  const { writeContract, data, error, isPending } = useWriteContract()
  
  const withdrawFees = async () => {
    return writeContract({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'withdrawFees'
    })
  }
  
  return { withdrawFees, data, error, isPending }
}

// Read hooks
export function useAuction(auctionId: string) {
  const { data, error, isLoading } = useReadContract({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    functionName: 'auctions',
    args: [auctionId as `0x${string}`]
  })
  
  return { auction: data, error, isLoading }
}

export function useAuctionBids(auctionId: string) {
  const { data, error, isLoading } = useReadContract({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    functionName: 'getAuctionBids',
    args: [auctionId as `0x${string}`]
  })
  
  return { bids: data, error, isLoading }
}

export function useBidderDeposit(auctionId: string, bidder: string) {
  const { data, error, isLoading } = useReadContract({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    functionName: 'getBidderDeposit',
    args: [auctionId as `0x${string}`, bidder as `0x${string}`]
  })
  
  return { deposit: data, error, isLoading }
}

export function useAccumulatedFees() {
  const { data, error, isLoading } = useReadContract({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    functionName: 'accumulatedFees'
  })
  
  return { fees: data, error, isLoading }
}

// Utility function to format wei to ether
export const formatWei = (wei: bigint) => formatEther(wei)