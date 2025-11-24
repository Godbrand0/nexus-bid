# Somnia Data Streams - Issues & Fixes

## ❌ Issues Found in `lib/streams.ts`

### 1. **WebSocket Not Used for Subscriptions** (CRITICAL)
**Problem**: The file creates a `wsClient` but never uses it. The SDK is initialized with HTTP transport only.

**Impact**: Real-time subscriptions won't work properly. HTTP polling is used instead of WebSocket push notifications.

**Location**: Lines 14-17 (wsClient created but unused)

---

### 2. **Server-Side Functions in Client Code** (CRITICAL)
**Problem**: Functions requiring `PRIVATE_KEY` are exported for client use:
- `getServerSDK()` - Requires private key
- `registerSchemas()` - Requires wallet
- `publishAuctionData()` - Requires wallet
- `publishBidData()` - Requires wallet
- `emitAuctionEvent()` - Requires wallet

**Impact**: These functions will fail in the browser with "PRIVATE_KEY not set" error.

**Current Usage**:
- `hooks/useAuctionHouse.ts` - imports `publishBidData`, `publishAuctionData`, `emitAuctionEvent`
- `components/AuctionDetail.tsx` - imports `publishBidData`, `emitAuctionEvent`
- `components/CreateAuction.tsx` - imports `publishAuctionData`, `emitAuctionEvent`

---

### 3. **Incorrect Subscription Implementation**
**Problem**: `subscribeToAuctionEvents()` uses read-only SDK with HTTP transport instead of WebSocket.

**Impact**: Won't receive real-time updates. Will need to poll instead.

---

## ✅ Fixes Implemented

### 1. Split into Two Files

#### `lib/streams.ts` (Client-Side)
- ✅ Uses WebSocket SDK for subscriptions
- ✅ Only exports client-safe functions
- ✅ Proper WebSocket configuration with reconnection
- ✅ Helper functions for common subscription patterns

**Exports**:
```typescript
- getReadOnlySDK() - HTTP SDK for reading
- getWebSocketSDK() - WebSocket SDK for subscriptions
- subscribeToContractEvent() - Generic event subscription
- subscribeToAuctionEvents() - Auction-specific subscriptions
- subscribeToBids() - Bid-specific subscriptions
- unsubscribe() - Clean up subscriptions
```

#### `lib/streams-server.ts` (Server-Side)
- ✅ Requires PRIVATE_KEY (only works server-side)
- ✅ Schema registration
- ✅ Data publishing
- ✅ Event emission

**Exports**:
```typescript
- getServerSDK() - Server SDK with wallet
- registerSchemas() - Register SDS schemas
- publishAuctionData() - Publish auction to streams
- publishBidData() - Publish bid to streams
- emitAuctionEvent() - Emit custom events
- getAuctionData() - Read auction from streams
- getBidData() - Read bid from streams
```

---

### 2. WebSocket Configuration
```typescript
const wsClient = createPublicClient({ 
  chain: somniaTestnet, 
  transport: webSocket(WS_URL, {
    reconnect: {
      attempts: 5,      // Retry 5 times
      delay: 1000,      // 1 second between retries
    },
    timeout: 30000,     // 30 second timeout
  })
})
```

---

## 🔧 Required Changes to Your Code

### Option 1: Remove Publishing from Client (Recommended)

**Why**: Publishing should happen automatically via contract events, not manually from client.

**Changes**:
1. Remove `publishBidData`, `publishAuctionData`, `emitAuctionEvent` calls from client components
2. Let the blockchain events trigger the streams automatically
3. Only use subscriptions in client code

**Files to Update**:
- `hooks/useAuctionHouse.ts` - Remove publish calls
- `components/AuctionDetail.tsx` - Remove publish calls
- `components/CreateAuction.tsx` - Remove publish calls

---

### Option 2: Move Publishing to API Routes

**Why**: If you need manual publishing, do it server-side via API routes.

**Implementation**:

1. **Create API Route**: `/app/api/streams/publish-bid/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { publishBidData } from '@/lib/streams-server'

export async function POST(request: NextRequest) {
  try {
    const bidData = await request.json()
    const result = await publishBidData(bidData)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

2. **Call from Client**:
```typescript
// In useAuctionHouse.ts or components
const publishBid = async (bidData) => {
  const response = await fetch('/api/streams/publish-bid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bidData)
  })
  return response.json()
}
```

---

## 📋 Recommended Architecture

### Client Components (Browser)
```
User Action → Contract Transaction → Wait for Confirmation
                                    ↓
                        Subscribe to Contract Events
                                    ↓
                            Update UI in Real-time
```

### Server (Optional - for custom data)
```
Contract Event → Webhook/Listener → API Route → Publish to SDS
```

### Real-time Updates
```
Contract emits event → Somnia Data Streams → WebSocket → Client receives update
```

---

## 🚀 Usage Examples

### Client-Side: Subscribe to Bids
```typescript
import { subscribeToBids, unsubscribe } from '@/lib/streams'
import { AUCTION_HOUSE_ADDRESS } from '@/contracts'

// In your component
useEffect(() => {
  const subscription = await subscribeToBids(
    AUCTION_HOUSE_ADDRESS,
    auctionId,
    (bidData) => {
      console.log('New bid:', bidData)
      // Update UI
      setCurrentBid(bidData.amount)
      setHighestBidder(bidData.bidder)
    },
    (error) => {
      console.error('Subscription error:', error)
    }
  )

  return () => unsubscribe(subscription)
}, [auctionId])
```

### Server-Side: Register Schemas (One-time setup)
```typescript
// In /app/api/setup/route.ts
import { registerSchemas } from '@/lib/streams-server'

export async function POST() {
  try {
    await registerSchemas()
    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

---

## ⚠️ Important Notes

1. **PRIVATE_KEY Security**
   - Never expose PRIVATE_KEY in client code
   - Only use in server-side code (API routes, server components)
   - Add to `.env.local` (not `.env` which might be committed)

2. **WebSocket Limits**
   - Browsers limit WebSocket connections
   - Reuse subscriptions when possible
   - Always unsubscribe on component unmount

3. **Schema Registration**
   - Only needs to be done once per deployment
   - Can be done via API route or deployment script
   - Requires PRIVATE_KEY

4. **Data Publishing**
   - Usually not needed if contract events are properly configured
   - Somnia Data Streams can auto-index contract events
   - Only publish custom data not in contract events

---

## 🎯 Next Steps

1. **Decide on Architecture**:
   - Option A: Remove manual publishing (simpler, recommended)
   - Option B: Create API routes for publishing (more control)

2. **Update Components**:
   - Remove server-side imports from client components
   - Use only subscription functions
   - Add proper cleanup (unsubscribe)

3. **Test Subscriptions**:
   - Verify WebSocket connections work
   - Test real-time bid updates
   - Check reconnection on network issues

4. **Register Schemas**:
   - Create setup API route
   - Run once to register schemas
   - Verify registration succeeded

---

## 📝 Summary

**Before**: Mixed client/server code, HTTP-only, will fail in browser  
**After**: Separated concerns, WebSocket for real-time, client-safe

**Key Changes**:
- ✅ WebSocket SDK for subscriptions
- ✅ Separated client/server code
- ✅ Proper error handling
- ✅ Reconnection logic
- ✅ Type-safe interfaces
- ✅ Clear documentation

**Result**: Proper Somnia Data Streams integration with real-time updates! 🎉
