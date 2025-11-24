import { SDK } from '@somnia-chain/streams'
import { createPublicClient, http, webSocket } from 'viem'
import { somniaTestnet } from 'viem/chains'

/**
 * Somnia Data Streams Configuration (Client-Side)
 * 
 * This file provides CLIENT-SIDE stream functionality for:
 * - Subscribing to auction events
 * - Reading auction/bid data
 * 
 * NOTE: Publishing data and schema registration require server-side
 * operations (see /app/api routes for those)
 */

// Environment variables
const RPC_URL = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL || 'https://dream-rpc.somnia.network'
const WS_URL = process.env.NEXT_PUBLIC_SOMNIA_WS_URL || 'wss://dream-rpc.somnia.network/ws'

// Public HTTP client for reading data
const publicClient = createPublicClient({ 
  chain: somniaTestnet, 
  transport: http(RPC_URL) 
})

// WebSocket client for real-time subscriptions
const wsClient = createPublicClient({ 
  chain: somniaTestnet, 
  transport: webSocket(WS_URL, {
    reconnect: {
      attempts: 5,
      delay: 1000,
    },
    timeout: 30000,
  })
})

// Singleton SDK instances
let readOnlySDK: SDK | null = null
let wsSDK: SDK | null = null

/**
 * Get read-only SDK for data queries (HTTP)
 */
export function getReadOnlySDK(): SDK {
  if (!readOnlySDK) {
    readOnlySDK = new SDK({
      public: publicClient,
      wallet: undefined
    })
  }
  return readOnlySDK
}

/**
 * Get WebSocket SDK for real-time subscriptions
 */
export function getWebSocketSDK(): SDK {
  if (!wsSDK) {
    wsSDK = new SDK({
      public: wsClient,
      wallet: undefined
    })
  }
  return wsSDK
}

/**
 * Subscribe to contract events via WebSocket
 * 
 * @param contractAddress - Address of the contract to watch
 * @param eventName - Name of the event (e.g., 'BidPlaced')
 * @param onData - Callback for new events
 * @param onError - Optional error callback
 * @param args - Optional event filter arguments
 */
export async function subscribeToContractEvent(
  contractAddress: `0x${string}`,
  eventName: string,
  onData: (data: any) => void,
  onError?: (error: any) => void,
  args?: Record<string, any>
) {
  try {
    const sdk = getWebSocketSDK()
    
    // Note: WebSocket subscriptions may not be available on all Somnia endpoints
    // If this fails, dApp will continue to work with HTTP polling
    const subscription = await sdk.streams.subscribe({
      somniaStreamsEventId: eventName,
      ethCalls: [{
        to: contractAddress,
        data: '0x'
      }],
      onData: (data) => {
        onData(data)
      },
      onError: (error) => {
        // Silently handle WebSocket errors - they're expected if WS is unavailable
        console.warn('⚠️ WebSocket stream error (this is normal if WS endpoint is unavailable):', error.message || error)
        onError?.(error)
      },
      onlyPushChanges: true
    })
    
    return subscription
  } catch (error) {
    // WebSocket connection failed - this is expected if endpoint doesn't support WS
    console.warn('⚠️ WebSocket subscription unavailable - real-time updates disabled. The dApp will continue to work with manual refresh.')
    console.warn('   To enable real-time updates, ensure NEXT_PUBLIC_SOMNIA_WS_URL is correctly configured.')
    throw error
  }
}

/**
 * Subscribe to auction events (BidPlaced, AuctionCreated, etc.)
 * 
 * @param auctionHouseAddress - Address of the AuctionHouse contract
 * @param eventType - Event name ('BidPlaced', 'AuctionCreated', etc.)
 * @param onData - Callback for new events
 * @param onError - Optional error callback
 * @param auctionId - Optional: filter by specific auction ID
 */
export async function subscribeToAuctionEvents(
  auctionHouseAddress: `0x${string}`,
  eventType: 'BidPlaced' | 'AuctionCreated' | 'AuctionFinalized' | 'BidRefunded',
  onData: (data: any) => void,
  onError?: (error: any) => void,
  auctionId?: string
) {
  return subscribeToContractEvent(
    auctionHouseAddress,
    eventType,
    onData,
    onError,
    auctionId ? { auctionId } : undefined
  )
}

/**
 * Subscribe to bids for a specific auction
 * 
 * @param auctionHouseAddress - Address of the AuctionHouse contract
 * @param auctionId - The auction ID to watch
 * @param onBid - Callback when new bid is placed
 * @param onError - Optional error callback
 */
export async function subscribeToBids(
  auctionHouseAddress: `0x${string}`,
  auctionId: string,
  onBid: (bidData: {
    auctionId: string
    bidder: string
    amount: bigint
    timestamp: bigint
  }) => void,
  onError?: (error: any) => void
) {
  return subscribeToAuctionEvents(
    auctionHouseAddress,
    'BidPlaced',
    (data) => {
      // Parse the event data
      if (data.args && data.args.auctionId === auctionId) {
        onBid({
          auctionId: data.args.auctionId,
          bidder: data.args.bidder,
          amount: data.args.amount,
          timestamp: data.args.timestamp
        })
      }
    },
    onError,
    auctionId
  )
}

/**
 * Unsubscribe from a stream
 */
export function unsubscribe(subscription: any) {
  if (subscription && typeof subscription.unsubscribe === 'function') {
    subscription.unsubscribe()
  }
}

// Legacy export for backward compatibility
export const sdk = getReadOnlySDK()

/**
 * NOTE: The following functions require server-side execution
 * They should be called from API routes, not from client components
 * 
 * - registerSchemas() - Register data schemas (requires wallet)
 * - publishAuctionData() - Publish auction data (requires wallet)
 * - publishBidData() - Publish bid data (requires wallet)
 * - emitAuctionEvent() - Emit custom events (requires wallet)
 * 
 * See /app/api/streams/* for server-side implementations
 */