'use client'

import React, { useState, useEffect } from 'react'
import { useCreateAuction } from '@/hooks/useAuctionHouse'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'

interface CreateAuctionProps {
  prefillData?: {
    nftContract: string
    tokenId: string
  }
  onClose?: () => void
}

export default function CreateAuction({ prefillData, onClose }: CreateAuctionProps) {
  const [nftContract, setNftContract] = useState(prefillData?.nftContract || '')
  const [tokenId, setTokenId] = useState(prefillData?.tokenId || '')
  const [startingPrice, setStartingPrice] = useState('')
  const [duration, setDuration] = useState('3600') // 1 hour default
  const [isCreating, setIsCreating] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isApproved, setIsApproved] = useState(false)

  const { createAuction } = useCreateAuction()
  const { address: currentAddress } = useAccount()
  const publicClient = usePublicClient()
  const { data: txData, isPending: isTxLoading, writeContract } = useWriteContract()
  const { data: receipt, isLoading: isReceiptLoading, isSuccess: isReceiptSuccess } = useWaitForTransactionReceipt({
    hash: txData,
  })

  // Check NFT ownership directly from blockchain
  const checkNFTOwnership = async () => {
    console.log('Checking NFT ownership for:', { nftContract, tokenId, currentAddress })
    
    if (!nftContract || !tokenId || !currentAddress || !publicClient) return false
    
    try {
      const owner = await publicClient.readContract({
        address: nftContract as `0x${string}`,
        abi: [
          {
            name: 'ownerOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'tokenId', type: 'uint256' }],
            outputs: [{ name: 'owner', type: 'address' }],
          },
        ],
        functionName: 'ownerOf',
        args: [BigInt(tokenId)],
      })
      
      const isOwner = owner.toLowerCase() === currentAddress.toLowerCase()
      console.log('NFT ownership check result:', { owner, currentAddress, isOwner })
      return isOwner
    } catch (error) {
      console.error('Error checking NFT ownership:', error)
      return false
    }
  }

  // ERC721 ABI for approve function
  const ERC721_ABI = [
    {
      inputs: [
        { internalType: 'address', name: 'to', type: 'address' },
        { internalType: 'uint256', name: 'tokenId', type: 'uint256' }
      ],
      name: 'approve',
      outputs: [
        { internalType: 'bool', name: '', type: 'bool' }
      ],
      stateMutability: 'nonpayable',
      type: 'function'
    }
  ] as const

  // Approve NFT for auction
  const handleApproveNFT = async () => {
    console.log('Starting NFT approval process...')
    
    if (!nftContract || !tokenId || !currentAddress) {
      console.error('Missing required fields for approval:', { nftContract, tokenId, currentAddress })
      alert('Please enter NFT contract and token ID, and connect your wallet')
      return
    }

    const auctionHouseAddress = process.env.NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS
    console.log('Auction House Address:', auctionHouseAddress)
    
    if (!auctionHouseAddress) {
      console.error('Auction House address is not defined in environment variables')
      alert('Auction House address is not configured. Please contact support.')
      return
    }

    setIsApproving(true)
    try {
      console.log('Approving NFT with params:', {
        nftContract,
        tokenId: BigInt(tokenId),
        auctionHouseAddress
      })
      
      // Use wagmi to approve the NFT directly from the client
      writeContract({
        address: nftContract as `0x${string}`,
        abi: ERC721_ABI,
        functionName: 'approve',
        args: [
          auctionHouseAddress as `0x${string}`,
          BigInt(tokenId)
        ]
      })
    } catch (error) {
      console.error('Error approving NFT:', error)
      alert('Failed to approve NFT')
    } finally {
      setIsApproving(false)
    }
  }

  // Handle transaction success
  useEffect(() => {
    if (isReceiptSuccess && receipt) {
      console.log('Approval transaction successful:', receipt)
      setIsApproved(true)
      alert('NFT approved successfully!')
    }
  }, [isReceiptSuccess, receipt])

  // Check if NFT is already approved on component mount or when NFT details change
  useEffect(() => {
    const checkApproval = async () => {
      if (nftContract && tokenId && currentAddress) {
        try {
          console.log('Checking if NFT is already approved...')
          const response = await fetch('/api/nft/approve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contract: nftContract,
              tokenId,
              userAddress: currentAddress,
              auctionHouseAddress: process.env.NEXT_PUBLIC_AUCTION_HOUSE_ADDRESS
            })
          })
          
          const data = await response.json()
          console.log('Approval check result:', data)
          
          if (data.success && data.alreadyApproved) {
            setIsApproved(true)
          }
        } catch (error) {
          console.error('Error checking NFT approval:', error)
        }
      }
    }
    
    checkApproval()
  }, [nftContract, tokenId, currentAddress])

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Starting auction creation with params:', {
      nftContract,
      tokenId,
      startingPrice,
      duration,
      isApproved
    })
    
    if (!nftContract || !tokenId || !startingPrice || !duration) {
      console.error('Missing required fields:', { nftContract, tokenId, startingPrice, duration })
      alert('Please fill in all fields')
      return
    }

    if (parseFloat(startingPrice) <= 0) {
      console.error('Invalid starting price:', startingPrice)
      alert('Starting price must be greater than 0')
      return
    }

    if (parseInt(duration) < 300 || parseInt(duration) > 2592000) {
      console.error('Invalid duration:', duration)
      alert('Duration must be between 5 minutes and 30 days')
      return
    }

    // Check if user owns the NFT
    const ownsNFT = await checkNFTOwnership()
    if (!ownsNFT) {
      console.error('User does not own the NFT')
      alert('You do not own this NFT')
      return
    }

    // Check if NFT is approved
    if (!isApproved) {
      console.error('NFT is not approved')
      alert('Please approve the NFT first')
      return
    }

    setIsCreating(true)
    try {
      console.log('Calling createAuction contract function...')
      // Contract will emit AuctionCreated event which Somnia Data Streams will capture
      const auctionId = await createAuction(
        nftContract,
        BigInt(tokenId),
        startingPrice,
        parseInt(duration)
      )

      console.log('Auction created with ID:', auctionId)

      if (auctionId !== null && auctionId !== undefined) {
        // Reset form
        setNftContract('')
        setTokenId('')
        setStartingPrice('')
        setDuration('3600')
        setIsApproved(false)

        alert('Auction created successfully!')
        
        // Close modal if onClose function is provided
        if (onClose) {
          onClose()
        }
      }
    } catch (error) {
      console.error('Error creating auction:', error)
      alert('Failed to create auction')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="bg-white rounded-sm shadow-lg p-8 border border-gray-200">
      <h3 className="text-2xl font-serif font-bold text-charcoal mb-6 border-b border-gray-200 pb-2">Create New Lot</h3>
      <form onSubmit={handleCreateAuction} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-charcoal mb-1 uppercase tracking-wide">
            NFT Contract Address
          </label>
          <input
            type="text"
            value={nftContract}
            onChange={(e) => setNftContract(e.target.value)}
            placeholder="0x..."
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-sm text-black focus:outline-none focus:border-royal-blue focus:ring-1 focus:ring-royal-blue font-mono text-sm"
            disabled={isCreating || isApproving}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-charcoal mb-1 uppercase tracking-wide">
            Token ID
          </label>
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="1"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-sm text-black focus:outline-none focus:border-royal-blue focus:ring-1 focus:ring-royal-blue font-mono text-sm"
            disabled={isCreating || isApproving}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-charcoal mb-1 uppercase tracking-wide">
            Starting Price (STT)
          </label>
          <input
            type="text"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            placeholder="1.0"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-sm text-black focus:outline-none focus:border-royal-blue focus:ring-1 focus:ring-royal-blue font-serif text-lg"
            disabled={isCreating || isApproving}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-charcoal mb-1 uppercase tracking-wide">
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-sm text-black focus:outline-none focus:border-royal-blue focus:ring-1 focus:ring-royal-blue font-sans"
            disabled={isCreating || isApproving}
          >
            <option value="3600">1 Hour</option>
            <option value="21600">6 Hours</option>
            <option value="86400">24 Hours</option>
            <option value="259200">3 Days</option>
            <option value="604800">7 Days</option>
          </select>
        </div>

        {/* NFT Approval Section */}
        {nftContract && tokenId && !isApproved && (
          <div className="border-t border-gray-100 pt-4 mt-2">
            <div className="bg-cream p-4 rounded-sm border border-gold/30 mb-4">
              <h4 className="text-sm font-bold text-charcoal mb-2 font-serif uppercase tracking-wide">Approval Required</h4>
              <p className="text-sm text-gray-600 mb-3 font-serif italic">
                Authorization is required to transfer this asset upon auction completion.
              </p>
              <button
                type="button"
                onClick={handleApproveNFT}
                disabled={isApproving || isTxLoading}
                className="w-full bg-gold text-white py-2 px-4 rounded-sm hover:bg-yellow-600 disabled:bg-gray-300 transition-colors font-bold uppercase tracking-wide text-sm"
              >
                {(isApproving || isTxLoading) ? 'Authorizing...' : 'Authorize Asset Transfer'}
              </button>
            </div>
          </div>
        )}

        {/* Approval Status */}
        {isApproved && (
          <div className="bg-green-50 p-3 rounded-sm mb-4 border border-british-green/20">
            <p className="text-sm text-british-green font-bold flex items-center gap-2">
              <span>✓</span> Asset Authorized for Auction
            </p>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-royal-blue text-white py-3 px-4 rounded-sm hover:bg-blue-900 transition-colors font-serif font-bold uppercase tracking-widest text-lg shadow-md mt-2"
          disabled={isCreating || isApproving}
        >
          {isCreating ? 'Creating Lot...' : 'Create Auction Lot'}
        </button>
      </form>
    </div>
  )
}
