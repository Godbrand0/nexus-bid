// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../lib/forge-std/src/Test.sol";
import "../lib/forge-std/src/console.sol";
import "../AuctionHouse.sol";
import "./MockNFT.sol";

contract AuctionHouseTest is Test {
    AuctionHouse public auctionHouse;
    MockNFT public nft;
    
    address public owner;
    address public seller;
    address public bidder1;
    address public bidder2;
    address public bidder3;
    
    uint256 public tokenId;
    bytes32 public auctionId;
    
    uint256 public constant STARTING_PRICE = 1 ether;
    uint256 public constant DURATION = 1 days;
    
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
    
    function setUp() public {
        owner = address(this);
        seller = address(0x1);
        bidder1 = address(0x2);
        bidder2 = address(0x3);
        bidder3 = address(0x4);
        
        vm.deal(seller, 10 ether);
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);
        vm.deal(bidder3, 10 ether);
        
        auctionHouse = new AuctionHouse();
        nft = new MockNFT();
        
        vm.prank(seller);
        tokenId = nft.mint(seller);
        
        vm.prank(seller);
        nft.setApprovalForAll(address(auctionHouse), true);
    }
    
    function testCreateAuction() public {
        vm.prank(seller);
        bytes32 expectedAuctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Verify auction was created correctly
        (bytes32 returnedAuctionId, address nftContract, uint256 returnedTokenId, address returnedSeller,
         uint256 startingPrice, uint256 currentBid, address highestBidder,
         uint64 startTime, uint64 endTime, bool isActive, bool isFinalized) = auctionHouse.auctions(expectedAuctionId);
        
        assertEq(nftContract, address(nft), "NFT contract address mismatch");
        assertEq(returnedTokenId, tokenId, "Token ID mismatch");
        assertEq(returnedSeller, seller, "Seller address mismatch");
        assertEq(startingPrice, STARTING_PRICE, "Starting price mismatch");
        assertEq(currentBid, 0, "Current bid should be 0");
        assertEq(highestBidder, address(0), "Highest bidder should be zero address");
        assertEq(startTime, block.timestamp, "Start time mismatch");
        assertEq(endTime, block.timestamp + DURATION, "End time mismatch");
        assertTrue(isActive, "Auction should be active");
        assertFalse(isFinalized, "Auction should not be finalized");
    }
    
    function testCreateAuctionFailsWithInvalidParameters() public {
        // Test with zero starting price
        vm.prank(seller);
        vm.expectRevert("Starting price must be > 0");
        auctionHouse.createAuction(address(nft), tokenId, 0, uint64(DURATION));
        
        // Test with duration too short
        vm.prank(seller);
        vm.expectRevert("Minimum 5 minutes duration");
        auctionHouse.createAuction(address(nft), tokenId, STARTING_PRICE, uint64(299));
        
        // Test with duration too long
        vm.prank(seller);
        vm.expectRevert("Maximum 30 days duration");
        auctionHouse.createAuction(address(nft), tokenId, STARTING_PRICE, uint64(30 days + 1));
        
        // Test with non-owner
        vm.prank(bidder1);
        vm.expectRevert("Not NFT owner");
        auctionHouse.createAuction(address(nft), tokenId, STARTING_PRICE, uint64(DURATION));
        
        // Test without approval
        vm.prank(seller);
        nft.setApprovalForAll(address(auctionHouse), false);
        
        vm.prank(seller);
        vm.expectRevert("Contract not approved");
        auctionHouse.createAuction(address(nft), tokenId, STARTING_PRICE, uint64(DURATION));
    }
    
    function testPlaceBid() public {
        // Create auction first
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Place a bid
        vm.prank(bidder1);
        vm.expectEmit(true, true, true, true);
        emit BidPlaced(
            auctionId,
            bidder1,
            STARTING_PRICE,
            uint64(block.timestamp)
        );
        
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Verify bid was placed correctly
        assertEq(
            auctionHouse.getBidderDeposit(auctionId, bidder1),
            STARTING_PRICE,
            "Bidder deposit mismatch"
        );
        
        (,,,,,, address highestBidder,,,,) = auctionHouse.auctions(auctionId);
        assertEq(highestBidder, bidder1, "Highest bidder mismatch");
    }
    
    function testPlaceBidFailsWithInvalidConditions() public {
        // Create auction first
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Test with zero bid
        vm.prank(bidder1);
        vm.expectRevert("Bid must be > 0");
        auctionHouse.placeBid{value: 0}(auctionId);
        
        // Test with bid below starting price
        vm.prank(bidder1);
        vm.expectRevert("Bid below starting price");
        auctionHouse.placeBid{value: STARTING_PRICE - 1}(auctionId);
        
        // Test seller trying to bid
        vm.prank(seller);
        vm.expectRevert("Seller cannot bid");
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Place a valid bid first
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Test with lower bid
        vm.prank(bidder2);
        vm.expectRevert("Bid must exceed current bid");
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Test with same bid amount
        vm.prank(bidder2);
        vm.expectRevert("Bid must exceed current bid");
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
    }
    
    function testMultipleBids() public {
        // Create auction first
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // First bid
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Second bid (higher)
        vm.prank(bidder2);
        auctionHouse.placeBid{value: 2 ether}(auctionId);
        
        // Third bid (even higher)
        vm.prank(bidder3);
        auctionHouse.placeBid{value: 3 ether}(auctionId);
        
        // Verify highest bidder
        (,,,,,, address highestBidder,,,,) = auctionHouse.auctions(auctionId);
        assertEq(highestBidder, bidder3, "Highest bidder should be bidder3");
        
        // Verify deposits
        assertEq(
            auctionHouse.getBidderDeposit(auctionId, bidder1),
            STARTING_PRICE,
            "Bidder1 deposit mismatch"
        );
        assertEq(
            auctionHouse.getBidderDeposit(auctionId, bidder2),
            2 ether,
            "Bidder2 deposit mismatch"
        );
        assertEq(
            auctionHouse.getBidderDeposit(auctionId, bidder3),
            3 ether,
            "Bidder3 deposit mismatch"
        );
    }
    
    function testFinalizeAuction() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Place a bid
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Fast forward time
        vm.warp(block.timestamp + DURATION + 1);
        
        // Finalize auction
        uint256 expectedPlatformFee = (STARTING_PRICE * 200) / 10000; // 2%
        uint256 expectedSellerAmount = STARTING_PRICE - expectedPlatformFee;
        
        vm.expectEmit(true, true, true, true);
        emit AuctionFinalized(
            auctionId,
            bidder1,
            STARTING_PRICE,
            expectedPlatformFee
        );
        
        auctionHouse.finalizeAuction(auctionId);
        
        // Verify auction is finalized
        (,,,,,,,,, bool isActive, bool isFinalized) = auctionHouse.auctions(auctionId);
        assertFalse(isActive, "Auction should not be active");
        assertTrue(isFinalized, "Auction should be finalized");
        
        // Verify NFT ownership transferred
        assertEq(nft.ownerOf(tokenId), bidder1, "NFT should be owned by winner");
        
        // Verify accumulated fees
        assertEq(auctionHouse.accumulatedFees(), expectedPlatformFee, "Platform fee mismatch");
        
        // Verify winner's deposit is cleared
        assertEq(
            auctionHouse.getBidderDeposit(auctionId, bidder1),
            0,
            "Winner's deposit should be cleared"
        );
    }
    
    function testFinalizeAuctionWithNoBids() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Fast forward time
        vm.warp(block.timestamp + DURATION + 1);
        
        // Finalize auction
        vm.expectEmit(true, true, true, true);
        emit AuctionFinalized(auctionId, address(0), 0, 0);
        
        auctionHouse.finalizeAuction(auctionId);
        
        // Verify auction is finalized
        (,,,,,,,,, bool isActive, bool isFinalized) = auctionHouse.auctions(auctionId);
        assertFalse(isActive, "Auction should not be active");
        assertTrue(isFinalized, "Auction should be finalized");
        
        // Verify NFT ownership remains with seller
        assertEq(nft.ownerOf(tokenId), seller, "NFT should remain with seller");
    }
    
    function testFinalizeAuctionFailsWithInvalidConditions() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Test finalizing before auction ends
        vm.expectRevert("Auction not ended");
        auctionHouse.finalizeAuction(auctionId);
        
        // Fast forward time
        vm.warp(block.timestamp + DURATION + 1);
        
        // Finalize auction
        auctionHouse.finalizeAuction(auctionId);
        
        // Test finalizing again
        vm.expectRevert("Auction not active");
        auctionHouse.finalizeAuction(auctionId);
    }
    
    function testClaimRefund() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Place bids
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        vm.prank(bidder2);
        auctionHouse.placeBid{value: 2 ether}(auctionId);
        
        // Fast forward time
        vm.warp(block.timestamp + DURATION + 1);
        
        // Finalize auction
        auctionHouse.finalizeAuction(auctionId);
        
        // Claim refund for losing bidder
        uint256 bidder1BalanceBefore = bidder1.balance;
        
        vm.expectEmit(true, true, true, true);
        emit BidRefunded(auctionId, bidder1, STARTING_PRICE);
        
        vm.prank(bidder1);
        auctionHouse.claimRefund(auctionId);
        
        // Verify refund
        assertEq(
            bidder1.balance,
            bidder1BalanceBefore + STARTING_PRICE,
            "Refund amount mismatch"
        );
        
        // Verify deposit is cleared
        assertEq(
            auctionHouse.getBidderDeposit(auctionId, bidder1),
            0,
            "Deposit should be cleared after refund"
        );
    }
    
    function testClaimRefundFailsWithInvalidConditions() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Place bids
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        vm.prank(bidder2);
        auctionHouse.placeBid{value: 2 ether}(auctionId);
        
        // Fast forward time
        vm.warp(block.timestamp + DURATION + 1);
        
        // Finalize auction
        auctionHouse.finalizeAuction(auctionId);
        
        // Test winner trying to claim refund
        vm.prank(bidder2);
        vm.expectRevert("Winner cannot claim refund");
        auctionHouse.claimRefund(auctionId);
        
        // Test claiming refund twice
        vm.prank(bidder1);
        auctionHouse.claimRefund(auctionId);
        
        vm.prank(bidder1);
        vm.expectRevert("No deposit to refund");
        auctionHouse.claimRefund(auctionId);
    }
    
    function testCancelAuction() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Cancel auction
        vm.prank(seller);
        auctionHouse.cancelAuction(auctionId);
        
        // Verify auction is canceled
        (,,,,,,,,, bool isActive, bool isFinalized) = auctionHouse.auctions(auctionId);
        assertFalse(isActive, "Auction should not be active");
        assertTrue(isFinalized, "Auction should be finalized");
    }
    
    function testCancelAuctionFailsWithInvalidConditions() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Test non-seller trying to cancel
        vm.prank(bidder1);
        vm.expectRevert("Only seller can cancel");
        auctionHouse.cancelAuction(auctionId);
        
        // Place a bid
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Test canceling with bids
        vm.prank(seller);
        vm.expectRevert("Cannot cancel with bids");
        auctionHouse.cancelAuction(auctionId);
    }
    
    function testWithdrawFees() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Place a bid
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        // Check contract balance after bid
        uint256 contractBalanceAfterBid = address(auctionHouse).balance;
        console.log("Contract balance after bid:", contractBalanceAfterBid);
        
        // Fast forward time
        vm.warp(block.timestamp + DURATION + 1);
        
        // Finalize auction
        auctionHouse.finalizeAuction(auctionId);
        
        // Check contract balance after finalization
        uint256 contractBalanceAfterFinalization = address(auctionHouse).balance;
        console.log("Contract balance after finalization:", contractBalanceAfterFinalization);
        
        // Withdraw fees
        uint256 expectedPlatformFee = (STARTING_PRICE * 200) / 10000; // 2%
        uint256 ownerBalanceBefore = owner.balance;
        console.log("Owner balance before withdrawal:", ownerBalanceBefore);
        
        // Check if accumulated fees match expected
        assertEq(auctionHouse.accumulatedFees(), expectedPlatformFee, "Platform fee accumulation mismatch");
        console.log("Accumulated fees:", auctionHouse.accumulatedFees());
        
        vm.prank(owner);
        auctionHouse.withdrawFees();
        
        // Verify withdrawal
        assertEq(
            owner.balance,
            ownerBalanceBefore + expectedPlatformFee,
            "Withdrawal amount mismatch"
        );
        
        // Verify accumulated fees are reset
        assertEq(auctionHouse.accumulatedFees(), 0, "Accumulated fees should be reset");
    }
    
    function testWithdrawFeesFailsWithInvalidConditions() public {
        // Test withdrawing with no fees
        vm.prank(owner);
        vm.expectRevert("No fees to withdraw");
        auctionHouse.withdrawFees();
        
        // Test non-owner trying to withdraw
        vm.prank(seller);
        vm.expectRevert();
        auctionHouse.withdrawFees();
    }
    
    function testGetAuctionBids() public {
        // Create auction
        vm.prank(seller);
        auctionId = auctionHouse.createAuction(
            address(nft),
            tokenId,
            STARTING_PRICE,
            uint64(DURATION)
        );
        
        // Place bids
        vm.prank(bidder1);
        auctionHouse.placeBid{value: STARTING_PRICE}(auctionId);
        
        vm.prank(bidder2);
        auctionHouse.placeBid{value: 2 ether}(auctionId);
        
        // Get bids
        AuctionHouse.Bid[] memory bids = auctionHouse.getAuctionBids(auctionId);
        
        assertEq(bids.length, 2, "Should have 2 bids");
        assertEq(bids[0].bidder, bidder1, "First bidder mismatch");
        assertEq(bids[0].amount, STARTING_PRICE, "First bid amount mismatch");
        assertEq(bids[1].bidder, bidder2, "Second bidder mismatch");
        assertEq(bids[1].amount, 2 ether, "Second bid amount mismatch");
    }
    
    // Add payable fallback and receive functions to allow test contract to receive ETH
    receive() external payable {}
    fallback() external payable {}
}