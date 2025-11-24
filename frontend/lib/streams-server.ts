import { SDK } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from 'viem/chains'
import { AUCTION_SCHEMA_ID, AUCTION_SCHEMA, BID_SCHEMA_ID, BID_SCHEMA, AUCTION_EVENTS } from '@/contracts'

/**
 * Somnia Data Streams - Server Side
 * 
 * This file provides SERVER-SIDE stream functionality that requires a wallet:
 * - Schema registration
 * - Publishing auction/bid data
 * - Emitting custom events
 * 
 * IMPORTANT: Only use these functions in:
 * - API routes (/app/api/*)
 * - Server actions
 * - Server components
 * 
 * DO NOT import this file in client components!
 */

const RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'

// Public client for reading
const publicClient = createPublicClient({ 
  chain: somniaTestnet, 
  transport: http(RPC_URL) 
})

// Singleton server SDK
let serverSDK: SDK | null = null

/**
 * Get server-side SDK with wallet
 * Requires PRIVATE_KEY environment variable
 */
export function getServerSDK(): SDK {
  if (!serverSDK) {
    const privateKey = process.env.PRIVATE_KEY
    
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required for server-side operations')
    }
    
    const account = privateKeyToAccount(privateKey as `0x${string}`)
    const walletClient = createWalletClient({
      chain: somniaTestnet,
      account,
      transport: http(RPC_URL)
    })
    
    serverSDK = new SDK({
      public: publicClient,
      wallet: walletClient
    })
    
  }
  
  return serverSDK
}

/**
 * Register Somnia Data Streams schemas
 * Should be called once during deployment/setup
 */
export async function registerSchemas() {
  try {
    const sdk = getServerSDK()
    
    const auctionSchemaTx = await sdk.streams.registerDataSchemas([
      {
        id: AUCTION_SCHEMA_ID,
        schema: AUCTION_SCHEMA,
        parentSchemaId: '0x0000000000000000000000000000000000000000000000000000000000000000000'
      }
    ], true)

    const bidSchemaTx = await sdk.streams.registerDataSchemas([
      {
        id: BID_SCHEMA_ID,
        schema: BID_SCHEMA,
        parentSchemaId: '0x0000000000000000000000000000000000000000000000000000000000000000000'
      }
    ], true)

    await sdk.streams.registerEventSchemas(
      Object.values(AUCTION_EVENTS),
      [
        {
          params: [{ name: 'auctionId', paramType: 'bytes32', isIndexed: true }],
          eventTopic: 'AuctionCreated(bytes32 indexed auctionId, address indexed seller, address nftContract, uint256 tokenId, uint256 startingPrice, uint64 endTime)'
        },
        {
          params: [{ name: 'auctionId', paramType: 'bytes32', isIndexed: true }],
          eventTopic: 'BidPlaced(bytes32 indexed auctionId, address indexed bidder, uint256 amount, uint64 timestamp)'
        },
        {
          params: [{ name: 'auctionId', paramType: 'bytes32', isIndexed: true }],
          eventTopic: 'AuctionFinalized(bytes32 indexed auctionId, address indexed winner, uint256 winningBid, uint256 platformFee)'
        },
        {
          params: [{ name: 'auctionId', paramType: 'bytes32', isIndexed: true }],
          eventTopic: 'BidRefunded(bytes32 indexed auctionId, address indexed bidder, uint256 amount)'
        }
      ]
    )

    return { success: true }
  } catch (error) {
    throw error
  }
}

/**
 * Publish auction data to streams
 */
export async function publishAuctionData(auctionData: {
  auctionId: string
  nftContract: string
  tokenId: bigint
  seller: string
  startingPrice: bigint
  currentBid: bigint
  highestBidder: string
  startTime: bigint
  endTime: bigint
  isActive: boolean
  isFinalized: boolean
}) {
  try {
    const sdk = getServerSDK()
    const schemaId = await sdk.streams.idToSchemaId(AUCTION_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Auction schema not registered. Call registerSchemas() first.')
    }
    
    const tx = await sdk.streams.set([{
      id: auctionData.auctionId as `0x${string}`,
      schemaId: schemaId,
      data: auctionData as any
    }])
    
    return tx
  } catch (error) {
    throw error
  }
}

/**
 * Publish bid data to streams
 */
export async function publishBidData(bidData: {
  auctionId: string
  bidder: string
  amount: bigint
  timestamp: bigint
  refunded: boolean
}) {
  try {
    const sdk = getServerSDK()
    const schemaId = await sdk.streams.idToSchemaId(BID_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Bid schema not registered. Call registerSchemas() first.')
    }
    
    const tx = await sdk.streams.set([{
      id: `${bidData.auctionId}-${bidData.bidder}` as `0x${string}`,
      schemaId: schemaId,
      data: bidData as any
    }])
    
    return tx
  } catch (error) {
    throw error
  }
}

/**
 * Emit custom auction event
 */
export async function emitAuctionEvent(
  eventType: string,
  data: { auctionId: string }
) {
  try {
    const sdk = getServerSDK()
    
    const tx = await sdk.streams.emitEvents([{
      id: eventType,
      argumentTopics: [data.auctionId as `0x${string}`],
      data: '0x'
    }])
    
    return tx
  } catch (error) {
    throw error
  }
}

/**
 * Get auction data from streams
 */
export async function getAuctionData(auctionId: string) {
  try {
    const sdk = getServerSDK()
    const schemaId = await sdk.streams.idToSchemaId(AUCTION_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Auction schema not registered')
    }
    
    const data = await sdk.streams.getByKey(
      schemaId,
      '0x0000000000000000000000000000000000000000000' as `0x${string}`,
      auctionId as `0x${string}`
    )
    return data
  } catch (error) {
    return null
  }
}

/**
 * Get bid data from streams
 */
export async function getBidData(auctionId: string, bidder: string) {
  try {
    const sdk = getServerSDK()
    const schemaId = await sdk.streams.idToSchemaId(BID_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Bid schema not registered')
    }
    
    const data = await sdk.streams.getByKey(
      schemaId,
      '0x0000000000000000000000000000000000000000000' as `0x${string}`,
      `${auctionId}-${bidder}` as `0x${string}`
    )
    return data
  } catch (error) {
    return null
  }
}
