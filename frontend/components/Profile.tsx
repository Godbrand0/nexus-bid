'use client'

import { useAccount } from 'wagmi'
import { Copy, Wallet } from 'lucide-react'
import MyNFTs from './MyNFTs'

export default function Profile() {
  const { address, isConnected } = useAccount()

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      alert('Address copied to clipboard!')
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Wallet className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600">Please connect your wallet to view your profile and NFTs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto text-black p-6">
      {/* User Profile Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">Profile</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Wallet Address</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg">{formatAddress(address!)}</span>
              <button
                onClick={copyAddress}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                title="Copy address"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NFTs Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <MyNFTs />
      </div>
    </div>
  )
}