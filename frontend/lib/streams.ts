import { SDK } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, webSocket } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { somniaTestnet } from 'viem/chains'
import { AUCTION_SCHEMA_ID, AUCTION_SCHEMA, BID_SCHEMA_ID, BID_SCHEMA, AUCTION_EVENTS } from '@/contracts'

// Public client for reading and subscribing
const publicClient = createPublicClient({ 
  chain: somniaTestnet, 
  transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network') 
})

// WebSocket client for real-time subscriptions
const wsClient = createPublicClient({ 
  chain: somniaTestnet, 
  transport: webSocket(process.env.NEXT_PUBLIC_SOMNIA_WS_URL || 'wss://dream-rpc.somnia.network') 
})

// SDK factory functions for different contexts
let serverSDK: SDK | null = null
let readOnlySDK: SDK | null = null

// Get server-side SDK with wallet (for backend operations)
export function getServerSDK() {
  if (!serverSDK) {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not set in environment variables')
    }
    
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
    const walletClient = createWalletClient({
      chain: somniaTestnet,
      account,
      transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network')
    })
    
    serverSDK = new SDK({
      public: publicClient,
      wallet: walletClient
    })
  }
  
  return serverSDK
}

// Get read-only SDK without wallet (for client-side operations)
export function getReadOnlySDK() {
  if (!readOnlySDK) {
    readOnlySDK = new SDK({
      public: publicClient,
      wallet: undefined
    })
  }
  
  return readOnlySDK
}

// Legacy export for backward compatibility (read-only)
export const sdk = getReadOnlySDK()

// Schema registration (uses server SDK with wallet)
export async function registerSchemas() {
  try {
    const serverSDK = getServerSDK()
    
    // Register auction schema
    const auctionSchemaTx = await serverSDK.streams.registerDataSchemas([
      {
        id: AUCTION_SCHEMA_ID,
        schema: AUCTION_SCHEMA,
        parentSchemaId: '0x0000000000000000000000000000000000000000000000000000000000000000000'
      }
    ], true)

    console.log('Auction schema registered:', auctionSchemaTx)

    // Register bid schema
    const bidSchemaTx = await serverSDK.streams.registerDataSchemas([
      {
        id: BID_SCHEMA_ID,
        schema: BID_SCHEMA,
        parentSchemaId: '0x0000000000000000000000000000000000000000000000000000000000000000000'
      }
    ], true)

    console.log('Bid schema registered:', bidSchemaTx)

    // Register event schemas
    await serverSDK.streams.registerEventSchemas(
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

    console.log('Event schemas registered')
  } catch (error) {
    console.error('Error registering schemas:', error)
  }
}

// Publish auction data to streams (uses server SDK with wallet)
export async function publishAuctionData(auctionData: any) {
  try {
    const serverSDK = getServerSDK()
    const schemaId = await serverSDK.streams.idToSchemaId(AUCTION_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Failed to get schema ID for auction')
    }
    
    const tx = await serverSDK.streams.set([{
      id: auctionData.auctionId as `0x${string}`,
      schemaId: schemaId,
      data: auctionData
    }])
    
    console.log('Auction data published:', tx)
    return tx
  } catch (error) {
    console.error('Error publishing auction data:', error)
    throw error
  }
}

// Publish bid data to streams (uses server SDK with wallet)
export async function publishBidData(bidData: any) {
  try {
    const serverSDK = getServerSDK()
    const schemaId = await serverSDK.streams.idToSchemaId(BID_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Failed to get schema ID for bid')
    }
    
    const tx = await serverSDK.streams.set([{
      id: `${bidData.auctionId}-${bidData.bidder}` as `0x${string}`,
      schemaId: schemaId,
      data: bidData
    }])
    
    console.log('Bid data published:', tx)
    return tx
  } catch (error) {
    console.error('Error publishing bid data:', error)
    throw error
  }
}

// Emit auction events (uses server SDK with wallet)
export async function emitAuctionEvent(eventType: string, data: any) {
  try {
    const serverSDK = getServerSDK()
    
    const tx = await serverSDK.streams.emitEvents([{
      id: eventType,
      argumentTopics: [data.auctionId as `0x${string}`],
      data: '0x'
    }])
    
    console.log('Auction event emitted:', tx)
    return tx
  } catch (error) {
    console.error('Error emitting auction event:', error)
    throw error
  }
}

// Subscribe to auction events (uses read-only SDK)
export async function subscribeToAuctionEvents(
  eventType: string,
  onData: (data: any) => void,
  onError?: (error: any) => void
) {
  try {
    const readOnlySDK = getReadOnlySDK()
    const subscription = await readOnlySDK.streams.subscribe({
      somniaStreamsEventId: eventType,
      ethCalls: [],
      onData,
      onError,
      onlyPushChanges: true
    })
    
    console.log(`Subscribed to ${eventType} with ID:`, subscription?.subscriptionId)
    return subscription
  } catch (error) {
    console.error(`Error subscribing to ${eventType}:`, error)
    throw error
  }
}

// Get auction data from streams (uses read-only SDK)
export async function getAuctionData(auctionId: string) {
  try {
    const readOnlySDK = getReadOnlySDK()
    const schemaId = await readOnlySDK.streams.idToSchemaId(AUCTION_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Failed to get schema ID for auction')
    }
    
    const data = await readOnlySDK.streams.getByKey(
      schemaId,
      '0x0000000000000000000000000000000000000000000' as `0x${string}`,
      auctionId as `0x${string}`
    )
    return data
  } catch (error) {
    console.error('Error getting auction data:', error)
    return null
  }
}

// Get bid data from streams (uses read-only SDK)
export async function getBidData(auctionId: string, bidder: string) {
  try {
    const readOnlySDK = getReadOnlySDK()
    const schemaId = await readOnlySDK.streams.idToSchemaId(BID_SCHEMA_ID)
    
    if (!schemaId) {
      throw new Error('Failed to get schema ID for bid')
    }
    
    const data = await readOnlySDK.streams.getByKey(
      schemaId,
      '0x0000000000000000000000000000000000000000000' as `0x${string}`,
      `${auctionId}-${bidder}` as `0x${string}`
    )
    return data
  } catch (error) {
    console.error('Error getting bid data:', error)
    return null
  }
}

// Initialize wallet client for streams
export function initializeWalletClient(privateKey: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`)
  const walletClient = createWalletClient({ 
    chain: somniaTestnet, 
    account, 
    transport: http(process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network') 
  })
  
  return new SDK({
    public: publicClient,
    wallet: walletClient
  })
}