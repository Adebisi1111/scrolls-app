/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, fallback, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet as _arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { ARC_GOOD_RPC } from './useRepairChain'

// Public endpoints. Blockdaemon/drpc/quicknode serve proper CORS headers.
// rpc.testnet.arc.io is the primary Arc node (same one MetaMask broadcasts to)
// — included as last fallback for receipt polling; may CORS-block write calls.
const ARC_ALL_RPCS = _arcTestnet.rpcUrls.default.http  // [arc.io, blockdaemon, drpc, quicknode]
const ARC_CORS_RPCS = ARC_ALL_RPCS.slice(1)            // blockdaemon, drpc, quicknode (CORS-safe)

// Override rpcUrls so wallet_addEthereumChain sends ARC_GOOD_RPC to MetaMask.
export const arcTestnet = {
  ..._arcTestnet,
  rpcUrls: {
    default: { http: ARC_CORS_RPCS },
    public:  { http: ARC_CORS_RPCS },
  },
} as const

registerChain(arcTestnet.id, ARC_GOOD_RPC)

console.log('[Scrolls] wagmi primary RPC:', ARC_GOOD_RPC)

// Transports for wagmi's own reads (balance, receipt polling, simulations):
//   1-3. blockdaemon, drpc, quicknode — CORS-friendly, used for write simulations
//   4.   rpc.testnet.arc.io — same node MetaMask broadcasts to, best for receipt polling
const arcTestnetTransport = fallback(
  ARC_ALL_RPCS.map((url) => http(url, { retryCount: 3, retryDelay: 1000 })),
)

export const config = createConfig({
  chains: [arcTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: arcTestnetTransport,
    [mainnet.id]: http(),
  },
})
