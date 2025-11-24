'use client'
import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { AUCTION_HOUSE_ABI, AUCTION_HOUSE_ADDRESS } from '@/contracts'
import { parseEther, formatEther } from 'viem'
import { useWatchContractEvent } from 'wagmi'
import { useEffect, useState } from 'react'

export function useCreateAuction() {
  const { writeContractAsync, data, error, isPending } = useWriteContract()
  
  const createAuction = async (
    nftContract: string,
    tokenId: bigint,
    startingPrice: string,
    duration: number
  ) => {
    const priceInWei = parseEther(startingPrice)
    
    return writeContractAsync({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'createAuction',
      args: [nftContract as `0x${string}`, tokenId, priceInWei, BigInt(duration)]
    })
  }
  
  return { createAuction, data: data as any, error, isPending }
}

export function usePlaceBid() {
  const { writeContractAsync, data, error, isPending } = useWriteContract()
  
  const placeBid = async (auctionId: string, bidAmount: string, bidderAddress?: string) => {
    const bidInWei = parseEther(bidAmount)
    
    // Contract will emit BidPlaced event which Somnia Data Streams will capture
    return writeContractAsync({
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
  const { writeContractAsync, data, error, isPending } = useWriteContract()
  
  const finalizeAuction = async (auctionId: string) => {
    // Contract will emit AuctionFinalized event which Somnia Data Streams will capture
    return writeContractAsync({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'finalizeAuction',
      args: [auctionId as `0x${string}`]
    })
  }
  
  return { finalizeAuction, data, error, isPending }
}

export function useClaimRefund() {
  const { writeContractAsync, data, error, isPending } = useWriteContract()
  
  const claimRefund = async (auctionId: string) => {
    // Contract will emit BidRefunded event which Somnia Data Streams will capture
    return writeContractAsync({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'claimRefund',
      args: [auctionId as `0x${string}`]
    })
  }
  
  return { claimRefund, data, error, isPending }
}

export function useCancelAuction() {
  const { writeContractAsync, data, error, isPending } = useWriteContract()
  
  const cancelAuction = async (auctionId: string) => {
    return writeContractAsync({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'cancelAuction',
      args: [auctionId as `0x${string}`]
    })
  }
  
  return { cancelAuction, data, error, isPending }
}

export function useWithdrawFees() {
  const { writeContractAsync, data, error, isPending } = useWriteContract()
  
  const withdrawFees = async () => {
    return writeContractAsync({
      address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
      abi: AUCTION_HOUSE_ABI,
      functionName: 'withdrawFees'
    })
  }
  
  return { withdrawFees, data, error, isPending }
}

// Read hooks
export function useAuction(auctionId: string) {
  const isValidId = auctionId && auctionId.startsWith('0x') && auctionId.length === 66
  
  const { data, error, isLoading } = useReadContract({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    functionName: 'auctions',
    args: [isValidId ? auctionId as `0x${string}` : '0x0000000000000000000000000000000000000000000000000000'],
    query: {
      enabled: !!isValidId
    }
  })
  
  return { auction: data, error, isLoading }
}

export function useAuctionBids(auctionId: string) {
  const isValidId = auctionId && auctionId.startsWith('0x') && auctionId.length === 66

  const { data, error, isLoading } = useReadContract({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    functionName: 'getAuctionBids',
    args: [isValidId ? auctionId as `0x${string}` : '0x0000000000000000000000000000000000000000000000000000000'],
    query: {
      enabled: !!isValidId
    }
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

// Hook to fetch all auctions using Blockscout API
export function useAllAuctions() {
  const [auctions, setAuctions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Blockscout API base URL for Somnia network
  const BLOCKSCOUT_API_BASE = 'https://shannon-explorer.somnia.network/api/v1'

  // Watch for new auction events
  useWatchContractEvent({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    eventName: 'AuctionCreated',
    onLogs: (logs) => {
      // Refresh auctions when new events are detected
      fetchAuctions()
    }
  })

  // Watch for bid events to update current bids
  useWatchContractEvent({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    eventName: 'BidPlaced',
    onLogs: (logs) => {
      // Refresh auctions when new bids are placed
      fetchAuctions()
    }
  })

  // Watch for auction finalized events
  useWatchContractEvent({
    address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
    abi: AUCTION_HOUSE_ABI,
    eventName: 'AuctionFinalized',
    onLogs: (logs) => {
      // Refresh auctions when auctions are finalized
      fetchAuctions()
    }
  })

  const fetchAuctions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      
      console.log('🔍 Fetching auctions using Blockscout API')
      
      // First try to get all logs for the contract to see if there are any events at all
      console.log('📡 Trying to fetch all logs first...')
      const allLogsResponse = await fetch(
        `${BLOCKSCOUT_API_BASE}?module=logs&action=getLogs&address=${AUCTION_HOUSE_ADDRESS}&fromBlock=0&toBlock=latest&page=1&offset=100`
      )
      
      if (allLogsResponse.ok) {
        const allLogsData = await allLogsResponse.json()
        console.log('📦 All logs response:', allLogsData)
        if (allLogsData.status === '1' && allLogsData.result && allLogsData.result.length > 0) {
          console.log('📋 Found logs, examining topics...')
          allLogsData.result.forEach((log: any, index: number) => {
            console.log(`📝 Log ${index}:`, {
              topics: log.topics,
              data: log.data,
              blockNumber: log.blockNumber
            })
            console.log(`🔍 Topic 0 for log ${index}:`, log.topics[0])
          })
          
          const auctionCreatedEvents = allLogsData.result.filter((log: any) =>
            log.topics && log.topics.length > 0 && log.topics[0] === '0x18999c8eccda0f43c409cf151d5ab56113696cc968c33f17421b865f4934e27f'
          )
          console.log(`🎨 Found ${auctionCreatedEvents.length} AuctionCreated events`)
        }
      }
      
      // Now try with the specific event signature
      // AuctionCreated(bytes32 indexed auctionId, address indexed seller, address nftContract, uint256 tokenId, uint256 startingPrice, uint64 endTime)
      const topic0 = '0x18999c8eccda0f43c409cf151d5ab56113696cc968c33f17421b865f4934e27f'
      
      console.log('📡 Topic0:', topic0)
      console.log('📡 API URL:', `${BLOCKSCOUT_API_BASE}?module=logs&action=getLogs&address=${AUCTION_HOUSE_ADDRESS}&topic0=${topic0}&page=1&offset=1000`)
      
      // Fetch AuctionCreated events using Blockscout API
      const response = await fetch(
        `${BLOCKSCOUT_API_BASE}?module=logs&action=getLogs&address=${AUCTION_HOUSE_ADDRESS}&topic0=${topic0}&fromBlock=0&toBlock=latest&page=1&offset=1000`
      )

      console.log('📡 API Response status:', response.status)

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('📦 API Response:', data)
      
      if (data.status !== '1') {
        throw new Error(data.message || 'API returned error status')
      }

      
      const auctionEvents = data.result || []
      console.log(`🎨 Found ${auctionEvents.length} auction events`)
      
      // Fetch auction details for each event
      const { createPublicClient, http } = await import('viem')
      const { somniaTestnet } = await import('viem/chains')
      
      const publicClient = createPublicClient({
        chain: somniaTestnet,
        transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
      })
      
      const auctionPromises = auctionEvents.map(async (event: any) => {
        try {
          // Get auction ID from event data
          const auctionId = event.topics[1] // AuctionCreated event has auctionId as first indexed parameter
          
          if (!auctionId || auctionId.length !== 66) {
            return null
          }
          
          
          // Get auction details from contract
          const auctionData = await publicClient.readContract({
            address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
            abi: AUCTION_HOUSE_ABI,
            functionName: 'auctions',
            args: [auctionId as `0x${string}`]
          })
          
          // Get bids for this auction
          const bids = await publicClient.readContract({
            address: AUCTION_HOUSE_ADDRESS as `0x${string}`,
            abi: AUCTION_HOUSE_ABI,
            functionName: 'getAuctionBids',
            args: [auctionId as `0x${string}`]
          })
          
          return {
            auctionId,
            nftContract: auctionData[1] as string,
            tokenId: auctionData[2] as bigint,
            seller: auctionData[3] as string,
            startingPrice: auctionData[4] as bigint,
            currentBid: auctionData[5] as bigint,
            highestBidder: auctionData[6] as string,
            startTime: auctionData[7] as bigint,
            endTime: auctionData[8] as bigint,
            isActive: auctionData[9] as boolean,
            isFinalized: auctionData[10] as boolean,
            bids: bids
          }
        } catch (error) {
          return null
        }
      })
      
      const auctionResults = await Promise.all(auctionPromises)
      const validAuctions = auctionResults.filter(auction => auction !== null)
      
      setAuctions(validAuctions)
    } catch (err) {
      console.error('Error fetching auctions:', err)
      setError('Failed to fetch auctions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuctions()
  }, [])

  const refetch = () => fetchAuctions()

  return { auctions, isLoading, error, refetch }
}

// Utility function to format wei to ether
export const formatWei = (wei: bigint) => formatEther(wei)