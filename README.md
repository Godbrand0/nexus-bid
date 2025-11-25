# NexusBid 🎯

> Real-time NFT auctions powered by blockchain security and Somnia Data Streams

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-blue)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.0-black)](https://nextjs.org/)

## 🌟 Overview

**NexusBid** is a cutting-edge NFT auction platform that bridges the gap between blockchain security and real-time user experience. While traditional on-chain marketplaces suffer from 3-5 second delays and stale state updates, NexusBid leverages **Somnia Data Streams** to deliver instant auction updates without compromising on decentralization.

### The Problem

- ⏱️ **Slow Feedback**: Traditional NFT auctions have 3-5 second delays per bid
- 😕 **Poor UX**: Users don't know if they're winning until transactions confirm
- 🔄 **Stale State**: Auction data is often outdated, leading to failed bids
- 💸 **Gas Waste**: Users waste gas on bids that are already outbid

### The Solution

NexusBid combines:
- ✅ **On-chain Security**: All critical operations (bids, transfers, settlements) are on-chain
- ⚡ **Real-time Updates**: Somnia Data Streams provide instant state synchronization
- 🎨 **Premium UX**: Smooth, responsive interface with live auction updates
- 💰 **Efficient Deposits**: Bidders can increment their deposits without multiple transactions

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auction List │  │ Create Form  │  │  NFT Gallery │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─────────────┬──────────────────┐
             │             │                  │
             ▼             ▼                  ▼
    ┌────────────┐  ┌─────────────┐  ┌──────────────┐
    │   Wagmi    │  │ RainbowKit  │  │Somnia Streams│
    │  (Web3)    │  │  (Wallet)   │  │ (Real-time)  │
    └─────┬──────┘  └──────┬──────┘  └──────┬───────┘
          │                │                 │
          └────────────────┼─────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  AuctionHouse Contract │
              │    (Solidity 0.8.20)   │
              └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │    Blockchain (EVM)    │
              │   - NFT Transfers      │
              │   - Bid Deposits       │
              │   - Settlements        │
              └────────────────────────┘
```

## ✨ Features

### For Bidders
- 🔴 **Live Auction Updates**: See new bids instantly without refreshing
- 💵 **Incremental Deposits**: Add to your bid without creating a new transaction
- 🔄 **Automatic Refunds**: Losing bidders can claim refunds after auction ends
- 📊 **Bid History**: View complete bid history for any auction
- 🎯 **Smart Validation**: Frontend prevents invalid bids before wasting gas

### For Sellers
- 🎨 **NFT Showcase**: Beautiful gallery view of your NFTs
- ⚙️ **Flexible Auctions**: Set starting price and duration (5 min - 30 days)
- 💰 **Platform Fees**: Transparent 2% platform fee on winning bids
- 🔒 **Secure Escrow**: NFTs are safely held by the contract during auctions
- ❌ **Cancellation**: Cancel auctions with no bids

### For Developers
- 📝 **Clean Smart Contracts**: Well-documented, auditable Solidity code
- 🔌 **Modern Stack**: Next.js 16, React 19, TypeScript, Tailwind CSS
- 🌊 **Real-time Integration**: Somnia Data Streams for live updates
- 🎨 **Premium UI**: British auction house aesthetic with glassmorphism
- 🔐 **Security First**: ReentrancyGuard, proper access controls

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Foundry (for smart contracts)
- MetaMask or compatible Web3 wallet

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/nexus-bid.git
cd nexus-bid
```

2. **Install frontend dependencies**
```bash
cd frontend
npm install
```

3. **Install contract dependencies**
```bash
cd ../contract
forge install
```

4. **Set up environment variables**
```bash
cd ../frontend
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=your_rpc_url
NEXT_PUBLIC_SOMNIA_STREAM_URL=your_stream_url
```

### Running Locally

1. **Start the development server**
```bash
cd frontend
npm run dev
```

2. **Open your browser**
```
http://localhost:3000
```

### Deploying Contracts

1. **Compile contracts**
```bash
cd contract
forge build
```

2. **Run tests**
```bash
forge test
```

3. **Deploy to network**
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## 📖 Usage Guide

### Creating an Auction

1. **Connect your wallet** using the "Connect Wallet" button
2. **Navigate to your profile** to view your NFTs
3. **Approve the AuctionHouse contract** to transfer your NFT
4. **Click "Create Auction"** and fill in:
   - NFT contract address
   - Token ID
   - Starting price (in ETH)
   - Duration (5 minutes to 30 days)
5. **Confirm the transaction** in your wallet

### Placing a Bid

1. **Browse active auctions** on the home page
2. **Click on an auction** to view details
3. **Enter your bid amount** (must exceed current bid)
4. **Send ETH** to place your bid
5. **Watch real-time updates** as other bids come in

### Finalizing an Auction

1. **Wait for auction to end** (anyone can finalize)
2. **Click "Finalize Auction"**
3. **Winner receives the NFT** automatically
4. **Seller receives payment** minus 2% platform fee
5. **Losing bidders can claim refunds**

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Web3**: Wagmi 2.x, Viem 2.x
- **Wallet**: RainbowKit 2.x
- **Real-time**: Somnia Data Streams
- **Icons**: Lucide React

### Smart Contracts
- **Language**: Solidity ^0.8.20
- **Framework**: Foundry
- **Libraries**: OpenZeppelin Contracts
- **Standards**: ERC-721 (NFTs)

### Blockchain
- **Network**: EVM-compatible chains
- **Data Streams**: Somnia Network
- **Wallet Support**: MetaMask, WalletConnect, Coinbase Wallet, etc.

## 📁 Project Structure

```
nexus-bid/
├── frontend/                 # Next.js application
│   ├── app/                 # App router pages
│   │   ├── page.tsx        # Home page with auction list
│   │   ├── auctions/       # Auction detail pages
│   │   └── profile/        # User profile & NFTs
│   ├── components/          # React components
│   │   ├── AuctionCard.tsx # Individual auction display
│   │   ├── AuctionList.tsx # Auction grid/list view
│   │   ├── CreateAuction.tsx # Auction creation form
│   │   ├── MyNFTs.tsx      # NFT gallery
│   │   └── Navbar.tsx      # Navigation bar
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuctionHouse.ts # Contract interactions
│   │   └── useAuctionNFTMetadata.ts # NFT metadata
│   ├── lib/                # Utilities
│   │   ├── streams-server.ts # Somnia integration
│   │   └── wagmi.ts        # Web3 configuration
│   └── contracts/          # Contract ABIs
│
├── contract/               # Foundry project
│   ├── src/
│   │   └── AuctionHouse.sol # Main auction contract
│   ├── test/               # Contract tests
│   └── script/             # Deployment scripts
│
└── auction-house-abi.json  # Contract ABI
```

## 🔐 Smart Contract Overview

### AuctionHouse.sol

The core contract handles all auction logic:

**Key Functions:**
- `createAuction()` - List an NFT for auction
- `placeBid()` - Place or increment a bid with ETH deposit
- `finalizeAuction()` - Settle auction and transfer NFT
- `claimRefund()` - Losing bidders claim their deposits
- `cancelAuction()` - Seller cancels auction (no bids only)
- `withdrawFees()` - Owner withdraws platform fees

**Security Features:**
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Ownable for admin functions
- ✅ Proper access controls (seller, bidder, owner)
- ✅ Safe ERC721 transfers
- ✅ Deposit tracking to prevent double-spending

**Events (Somnia Data Streams):**
- `AuctionCreated` - New auction listed
- `BidPlaced` - New bid received
- `AuctionFinalized` - Auction settled
- `BidRefunded` - Deposit refunded

## 🎨 Design Philosophy

NexusBid's UI is inspired by traditional British auction houses:

- **Typography**: Playfair Display (serif) for headings, Inter (sans-serif) for body
- **Colors**: Royal Blue, British Racing Green, Gold accents on Cream background
- **Style**: High contrast, premium feel, glassmorphism effects
- **UX**: Clear hierarchy, immediate feedback, smooth animations

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write tests for new features
- Follow the existing code style
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Somnia Network** - For Data Streams technology
- **OpenZeppelin** - For secure smart contract libraries
- **Foundry** - For blazing fast contract development
- **RainbowKit** - For beautiful wallet connection UX

## 📞 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/nexus-bid/issues)
- **Documentation**: [Full docs](https://docs.nexusbid.io) (coming soon)
- **Twitter**: [@NexusBid](https://twitter.com/nexusbid) (coming soon)

---

**Built with ❤️ for the Web3 community**

*Making NFT auctions feel alive, one bid at a time.*
