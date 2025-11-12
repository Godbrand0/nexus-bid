# Nexus Auction House - Frontend Integration

This document outlines the integration of the AuctionHouse smart contract with a Next.js frontend using Web3 technologies and Somnia Data Streams.

## Architecture Overview

### Smart Contract Integration
- **AuctionHouse.sol**: Core auction contract with bid deposits, refunds, and platform fees
- **Fixed Issue**: Added contract balance check in `withdrawFees()` function to prevent withdrawal failures
- **ABI**: Extracted and available in `frontend/contracts/auction-house-abi.json`

### Web3 Stack
- **Wagmi**: React hooks for Ethereum interactions
- **Viem**: TypeScript interface for Ethereum
- **RainbowKit**: Wallet connection UI
- **TanStack Query**: Data fetching and caching

### Somnia Data Streams Integration
- **Real-time Updates**: Live auction events and bid notifications
- **Schema Registration**: Structured data storage for auctions and bids
- **Event Streaming**: Instant notifications for auction activities

## File Structure

```
frontend/
├── contracts/
│   ├── index.ts              # Contract ABI and configuration
│   └── auction-house-abi.json # Contract ABI
├── lib/
│   ├── wagmi.ts             # Web3 provider configuration
│   └── streams.ts           # Somnia Data Streams integration
├── hooks/
│   └── useAuctionHouse.ts   # Custom React hooks for contract interactions
├── components/
│   ├── AuctionCard.tsx        # Single auction display component
│   ├── CreateAuction.tsx      # Auction creation form
│   └── WalletConnect.tsx      # Wallet connection component
├── app/
│   ├── layout.tsx            # Root layout with providers
│   └── page.tsx             # Main application page
└── .env.local              # Environment variables
```

## Key Features

### 1. Auction Management
- Create new NFT auctions
- Set starting price and duration
- Cancel auctions (no bids only)

### 2. Bidding System
- Place ETH bids on active auctions
- Automatic bid validation
- Real-time bid updates

### 3. Auction Finalization
- Finalize ended auctions
- Automatic NFT transfer to winner
- Platform fee collection (2%)

### 4. Refund System
- Automatic refund for losing bids
- Manual refund claims
- Deposit tracking

### 5. Real-time Updates
- Live bid notifications via Somnia Data Streams
- Instant auction status updates
- Event-driven UI updates

## Environment Setup

1. Install dependencies:
```bash
npm install @somnia-chain/streams dotenv --legacy-peer-deps
```

2. Configure environment variables in `.env.local`:
```bash
NEXT_PUBLIC_SOMNIA_RPC_URL=https://dream-rpc.somnia.network
NEXT_PUBLIC_SOMNIA_WS_URL=wss://dream-rpc.somnia.network
NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS=0x... # Contract address after deployment
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

3. Start development server:
```bash
npm run dev
```

## Contract Deployment

1. Compile the contract:
```bash
cd contract && forge build
```

2. Deploy to Somnia Testnet:
```bash
forge script script/Deploy.s.s.sol --rpc-url https://dream-rpc.somnia.network --broadcast
```

3. Update `NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS` in `.env.local`

## Somnia Data Streams Schema

### Auction Schema
```typescript
{
  id: 'auction',
  schema: 'bytes32 auctionId, address nftContract, uint256 tokenId, address seller, uint256 startingPrice, uint256 currentBid, address highestBidder, uint64 startTime, uint64 endTime, bool isActive, bool isFinalized'
}
```

### Bid Schema
```typescript
{
  id: 'bid',
  schema: 'bytes32 auctionId, address bidder, uint256 amount, uint64 timestamp, bool refunded'
}
```

### Event Types
- `AuctionCreated`: New auction created
- `BidPlaced`: New bid placed
- `AuctionFinalized`: Auction ended and finalized
- `BidRefunded`: Bid refunded to loser

## Security Considerations

1. **Contract Balance Check**: Added validation in `withdrawFees()` to ensure sufficient balance
2. **Reentrancy Protection**: All state-changing functions use `nonReentrant` modifier
3. **Access Control**: Owner-only functions protected by `onlyOwner` modifier
4. **Input Validation**: All user inputs validated before contract interaction

## Testing

### Smart Contract Tests
```bash
cd contract && forge test -vvv
```

### Frontend Testing
```bash
cd frontend && npm run dev
```

## Future Enhancements

1. **NFT Integration**: Direct NFT viewing and metadata
2. **Advanced Filtering**: Sort and filter auctions by various criteria
3. **Gas Optimization**: Batch operations for better UX
4. **Mobile Responsive**: Enhanced mobile experience
5. **Notifications**: Browser notifications for auction events

## Troubleshooting

### Common Issues

1. **Withdrawal Failed**: Fixed by adding contract balance check
2. **Connection Issues**: Verify RPC URL and network configuration
3. **Schema Registration**: Ensure schemas are registered before use
4. **Event Subscription**: Check WebSocket connection for real-time updates

### Debug Steps

1. Check browser console for errors
2. Verify contract address is correct
3. Ensure wallet is connected to Somnia Testnet
4. Check environment variables are properly set