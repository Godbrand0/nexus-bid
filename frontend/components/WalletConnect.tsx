'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'

export default function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })

  return (
    <RainbowKitProvider>
      <div className="flex items-center space-x-4">
        {isConnected && address ? (
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {address.slice(0, 6)}...{address.slice(-4)}
              </p>
              {balance && (
                <p className="text-sm text-gray-600">
                  {parseFloat(balance.formatted).toFixed(4)} ETH
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Connect your wallet to get started</p>
        )}
      
        <ConnectButton
          chainStatus="icon"
          showBalance={false}
          accountStatus="address"
        />
      </div>
    </RainbowKitProvider>
  )
}