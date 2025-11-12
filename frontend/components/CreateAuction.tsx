'use client'

import { useState } from 'react'
import { useCreateAuction } from '@/hooks/useAuctionHouse'
import { publishAuctionData, emitAuctionEvent } from '@/lib/streams'

export default function CreateAuction() {
  const [nftContract, setNftContract] = useState('')
  const [tokenId, setTokenId] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [duration, setDuration] = useState('86400') // 24 hours in seconds
  const [isCreating, setIsCreating] = useState(false)

  const { createAuction } = useCreateAuction()

  const handleCreateAuction = async () => {
    if (!nftContract || !tokenId || !startingPrice || !duration) {
      alert('Please fill in all fields')
      return
    }

    if (parseFloat(startingPrice) <= 0) {
      alert('Starting price must be greater than 0')
      return
    }

    if (parseInt(duration) < 300 || parseInt(duration) > 2592000) {
      alert('Duration must be between 5 minutes and 30 days')
      return
    }

    setIsCreating(true)
    try {
      const tx = await createAuction(
        nftContract,
        BigInt(tokenId),
        startingPrice,
        parseInt(duration)
      )

      if (tx !== null && tx !== undefined) {
        // Publish to Somnia Data Streams
        const auctionData = {
          auctionId: tx,
          nftContract,
          tokenId: BigInt(tokenId),
          seller: '', // Will be filled by contract
          startingPrice: BigInt(parseFloat(startingPrice) * 1e18),
          currentBid: BigInt(0),
          highestBidder: '0x0000000000000000000000000000000000000000000',
          startTime: BigInt(Math.floor(Date.now() / 1000)),
          endTime: BigInt(Math.floor(Date.now() / 1000) + parseInt(duration)),
          isActive: true,
          isFinalized: false
        }

        await publishAuctionData(auctionData)
        await emitAuctionEvent('AuctionCreated', { auctionId: tx })

        // Reset form
        setNftContract('')
        setTokenId('')
        setStartingPrice('')
        setDuration('86400')

        alert('Auction created successfully!')
      }
    } catch (error) {
      console.error('Error creating auction:', error)
      alert('Failed to create auction')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-xl font-bold mb-6 text-gray-900">Create New Auction</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="nftContract" className="block text-sm font-medium text-gray-700 mb-1">
            NFT Contract Address
          </label>
          <input
            id="nftContract"
            type="text"
            placeholder="0x..."
            value={nftContract}
            onChange={(e) => setNftContract(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreating}
          />
        </div>

        <div>
          <label htmlFor="tokenId" className="block text-sm font-medium text-gray-700 mb-1">
            Token ID
          </label>
          <input
            id="tokenId"
            type="number"
            placeholder="1"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreating}
          />
        </div>

        <div>
          <label htmlFor="startingPrice" className="block text-sm font-medium text-gray-700 mb-1">
            Starting Price (ETH)
          </label>
          <input
            id="startingPrice"
            type="number"
            step="0.01"
            placeholder="0.1"
            value={startingPrice}
            onChange={(e) => setStartingPrice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreating}
          />
        </div>

        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duration (seconds)
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isCreating}
          >
            <option value="300">5 minutes</option>
            <option value="900">15 minutes</option>
            <option value="1800">30 minutes</option>
            <option value="3600">1 hour</option>
            <option value="7200">2 hours</option>
            <option value="86400">24 hours</option>
            <option value="172800">48 hours</option>
            <option value="604800">7 days</option>
            <option value="2592000">30 days</option>
          </select>
        </div>

        <button
          onClick={handleCreateAuction}
          disabled={isCreating || !nftContract || !tokenId || !startingPrice || !duration}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isCreating ? 'Creating Auction...' : 'Create Auction'}
        </button>
      </div>
    </div>
  )
}