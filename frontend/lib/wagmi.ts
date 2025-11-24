import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { somniaTestnet } from 'wagmi/chains'
import "@rainbow-me/rainbowkit/styles.css";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

export const config = getDefaultConfig({
  appName: 'Nexus Auction House',
  projectId: projectId,
  chains: [somniaTestnet],

})

