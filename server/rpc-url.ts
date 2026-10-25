/**
 * Shared helper: resolve the Arc Testnet RPC URL for server-side use.
 * Prefers the provisioned Arc Studio proxy; falls back to the public endpoint.
 */
export function arcTestnetRpcUrl(): string {
  const base = process.env.RPC_PROXY_BASE_URL
  const token = process.env.RPC_PROXY_TOKEN
  const chains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map((s) => s.trim())
  if (base && token && chains.includes('Arc_Testnet')) {
    return `${base}/api/rpc/Arc_Testnet?_rpc_token=${token}`
  }
  return 'https://rpc.testnet.arc.io' // arc-studio-allow-onchain-literal
}
