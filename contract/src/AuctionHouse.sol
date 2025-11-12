// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";




/**
 * @title AuctionHouse
 * @notice On-chain auction contract with bid deposits, refunds, and platform fees
 * @dev Integrates with Somnia Data Streams for real-time updates
 */
contract AuctionHouse is ReentrancyGuard, Ownable {
    // Platform fee: 2% (200 basis points out of 10000)
    uint256 public constant PLATFORM_FEE_BPS = 200;
    uint256 public constant BASIS_POINTS = 10000;
    
    struct Auction {
        bytes32 auctionId;
        address nftContract;
        uint256 tokenId;
        address seller;
        uint256 startingPrice;
        uint256 currentBid;
        address highestBidder;
        uint64 startTime;
        uint64 endTime;
        bool isActive;
        bool isFinalized;
    }
    
    struct Bid {
        address bidder;
        uint256 amount;
        uint64 timestamp;
        bool refunded;
    }
    
    // Auction ID => Auction details
    mapping(bytes32 => Auction) public auctions;
    
    // Auction ID => Array of all bids
    mapping(bytes32 => Bid[]) public auctionBids;
    
    // Auction ID => Bidder => Deposited amount
    mapping(bytes32 => mapping(address => uint256)) public deposits;
    
    // Track accumulated platform fees
    uint256 public accumulatedFees;
    
    // Events for Somnia Data Streams integration
    event AuctionCreated(
        bytes32 indexed auctionId,
        address indexed seller,
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint64 endTime
    );
    
    event BidPlaced(
        bytes32 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint64 timestamp
    );
    
    event AuctionFinalized(
        bytes32 indexed auctionId,
        address indexed winner,
        uint256 winningBid,
        uint256 platformFee
    );
    
    event BidRefunded(
        bytes32 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Create a new NFT auction
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID to auction
     * @param startingPrice Minimum starting bid
     * @param duration Auction duration in seconds
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint64 duration
    ) external returns (bytes32) {
        require(startingPrice > 0, "Starting price must be > 0");
        require(duration >= 300, "Minimum 5 minutes duration");
        require(duration <= 30 days, "Maximum 30 days duration");
        
        // Verify NFT ownership and approval
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) || 
            nft.getApproved(tokenId) == address(this),
            "Contract not approved"
        );
        
        // Generate unique auction ID
        bytes32 auctionId = keccak256(
            abi.encodePacked(nftContract, tokenId, msg.sender, block.timestamp)
        );
        
        require(!auctions[auctionId].isActive, "Auction already exists");
        
        uint64 startTime = uint64(block.timestamp);
        uint64 endTime = startTime + duration;
        
        // Create auction
        auctions[auctionId] = Auction({
            auctionId: auctionId,
            nftContract: nftContract,
            tokenId: tokenId,
            seller: msg.sender,
            startingPrice: startingPrice,
            currentBid: 0,
            highestBidder: address(0),
            startTime: startTime,
            endTime: endTime,
            isActive: true,
            isFinalized: false
        });
        
        emit AuctionCreated(
            auctionId,
            msg.sender,
            nftContract,
            tokenId,
            startingPrice,
            endTime
        );
        
        return auctionId;
    }
    
    /**
     * @notice Place a bid with ETH deposit
     * @param auctionId ID of the auction to bid on
     */
    function placeBid(bytes32 auctionId) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.isActive, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(msg.sender != auction.seller, "Seller cannot bid");
        require(msg.value > 0, "Bid must be > 0");
        
        uint256 totalDeposit = deposits[auctionId][msg.sender] + msg.value;
        
        require(
            totalDeposit > auction.currentBid,
            "Bid must exceed current bid"
        );
        require(
            totalDeposit >= auction.startingPrice,
            "Bid below starting price"
        );
        
        // Update deposit
        deposits[auctionId][msg.sender] = totalDeposit;
        
        // Update auction state
        auction.currentBid = totalDeposit;
        auction.highestBidder = msg.sender;
        
        // Record bid
        auctionBids[auctionId].push(Bid({
            bidder: msg.sender,
            amount: totalDeposit,
            timestamp: uint64(block.timestamp),
            refunded: false
        }));
        
        emit BidPlaced(auctionId, msg.sender, totalDeposit, uint64(block.timestamp));
    }
    
    /**
     * @notice Finalize auction and distribute funds
     * @param auctionId ID of the auction to finalize
     */
    function finalizeAuction(bytes32 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.isActive, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.isFinalized, "Already finalized");
        
        auction.isActive = false;
        auction.isFinalized = true;
        
        address winner = auction.highestBidder;
        uint256 winningBid = auction.currentBid;
        
        if (winner != address(0) && winningBid > 0) {
            // Calculate platform fee (2%)
            uint256 platformFee = (winningBid * PLATFORM_FEE_BPS) / BASIS_POINTS;
            uint256 sellerAmount = winningBid - platformFee;
            
            // Accumulate platform fee
            accumulatedFees += platformFee;
            
            // Transfer NFT to winner
            IERC721(auction.nftContract).safeTransferFrom(
                auction.seller,
                winner,
                auction.tokenId
            );
            
            // Pay seller (minus platform fee)
            (bool sellerSuccess, ) = auction.seller.call{value: sellerAmount}("");
            require(sellerSuccess, "Seller payment failed");
            
            // Clear winner's deposit (already paid)
            deposits[auctionId][winner] = 0;
            
            emit AuctionFinalized(auctionId, winner, winningBid, platformFee);
        } else {
            emit AuctionFinalized(auctionId, address(0), 0, 0);
        }
    }
    
    /**
     * @notice Refund losing bids after auction finalization
     * @param auctionId ID of the auction
     * @param bidders Array of bidder addresses to refund
     */
    function refundBids(bytes32 auctionId, address[] calldata bidders) 
        external 
        nonReentrant 
    {
        Auction storage auction = auctions[auctionId];
        
        require(auction.isFinalized, "Auction not finalized");
        
        for (uint256 i = 0; i < bidders.length; i++) {
            address bidder = bidders[i];
            uint256 depositAmount = deposits[auctionId][bidder];
            
            // Skip if no deposit or if winner
            if (depositAmount == 0 || bidder == auction.highestBidder) {
                continue;
            }
            
            // Clear deposit
            deposits[auctionId][bidder] = 0;
            
            // Refund
            (bool success, ) = bidder.call{value: depositAmount}("");
            require(success, "Refund failed");
            
            emit BidRefunded(auctionId, bidder, depositAmount);
        }
    }
    
    /**
     * @notice Bidders can claim their refunds themselves
     * @param auctionId ID of the auction
     */
    function claimRefund(bytes32 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        require(auction.isFinalized, "Auction not finalized");
        require(msg.sender != auction.highestBidder, "Winner cannot claim refund");
        
        uint256 depositAmount = deposits[auctionId][msg.sender];
        require(depositAmount > 0, "No deposit to refund");
        
        // Clear deposit
        deposits[auctionId][msg.sender] = 0;
        
        // Refund
        (bool success, ) = msg.sender.call{value: depositAmount}("");
        require(success, "Refund failed");
        
        emit BidRefunded(auctionId, msg.sender, depositAmount);
    }
    
    /**
     * @notice Cancel auction (only if no bids placed)
     * @param auctionId ID of the auction to cancel
     */
    function cancelAuction(bytes32 auctionId) external {
        Auction storage auction = auctions[auctionId];
        
        require(auction.isActive, "Auction not active");
        require(msg.sender == auction.seller, "Only seller can cancel");
        require(auction.currentBid == 0, "Cannot cancel with bids");
        
        auction.isActive = false;
        auction.isFinalized = true;
    }
    
    /**
     * @notice Withdraw accumulated platform fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        
        uint256 contractBalance = address(this).balance;
        require(contractBalance >= amount, "Insufficient contract balance");
        
        accumulatedFees = 0;
        
        (bool success, ) = owner().call{value: amount}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @notice Get all bids for an auction
     * @param auctionId ID of the auction
     */
    function getAuctionBids(bytes32 auctionId) 
        external 
        view 
        returns (Bid[] memory) 
    {
        return auctionBids[auctionId];
    }
    
    /**
     * @notice Get bidder's deposit amount
     * @param auctionId ID of the auction
     * @param bidder Address of the bidder
     */
    function getBidderDeposit(bytes32 auctionId, address bidder) 
        external 
        view 
        returns (uint256) 
    {
        return deposits[auctionId][bidder];
    }
    
    /**
     * @notice Required for receiving NFTs
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}