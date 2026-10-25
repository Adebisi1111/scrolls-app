/**
 * Sample research article content.
 * In a real deployment, the creator would supply their own document here.
 */

export interface Article {
  docId: number
  title: string
  author: string
  affiliation: string
  date: string
  abstract: string[]
  body: string[]
}

export const ARTICLE: Article = {
  docId: 1,
  title: 'Stablecoin Settlement Latency in Cross-Chain DeFi Protocols',
  author: 'Dr. Elena Marchetti',
  affiliation: 'Institute for Distributed Finance Research',
  date: 'October 2026',
  abstract: [
    'This paper examines settlement latency and capital efficiency in cross-chain decentralized finance (DeFi) protocols with a particular focus on Circle\'s Cross-Chain Transfer Protocol (CCTP) and the emerging Arc chain architecture. We analyze 1.4 million USDC transfer events over a 90-day window spanning six EVM-compatible networks and identify four distinct latency regimes corresponding to validator set size, finality mechanism, and bridge architecture.',
    'Our key finding is that USDC-native chains — where the stablecoin serves as the native gas token — demonstrate 47–63% lower settlement variance compared to bridged-USDC deployments on existing L1/L2 networks. We introduce a novel metric, Effective Settlement Confidence (ESC), and derive analytical bounds for optimal liquidity rebalancing intervals under different demand volatility regimes.',
  ],
  body: [
    '## 1. Introduction',
    'The proliferation of USDC-settled DeFi protocols across more than forty EVM-compatible networks has created a rich landscape for studying the microstructure of stablecoin settlement. Unlike volatile-asset transfers, USDC transfers carry an implicit assumption of capital equivalence across all destination chains — an assumption that breaks down under conditions of congestion, attestation delay, or finality uncertainty.',
    'Prior work on cross-chain latency (Li et al., 2024; Nakamura & Osei, 2025) has focused primarily on Ethereum-settled L2 rollups, leaving the behavior of independently-finalized chains underexplored. This study fills that gap by examining Arc Testnet as a representative of the USDC-native-gas paradigm.',
    '## 2. Methodology',
    'We collected transfer event data from the USDC ERC-20 contract on each of the six target networks using parallel archival RPC nodes. Block timestamps were normalized using a GPS-synchronized reference clock to eliminate drift artifacts in our inter-chain comparisons. Transfer events were filtered to include only wallet-to-wallet transfers above 1 USDC to exclude dust and test transactions.',
    'Latency was defined as the wall-clock elapsed time between the transaction entering the mempool and the transaction receipt appearing in a finalized block. For chains with probabilistic finality, we used the 6-confirmation threshold conventionally applied by Circle\'s attestation service. For chains with deterministic finality (including Arc Testnet), a single confirmed block sufficed.',
    '## 3. Results',
    'Figure 1 shows the empirical CDF of settlement latency across all six chains. Arc Testnet (median: 0.8s, 99th percentile: 2.1s) significantly outperforms Ethereum Sepolia (median: 12.4s, 99th percentile: 68.3s) and is broadly comparable to Base Sepolia (median: 2.0s, 99th percentile: 4.8s), while offering materially lower variance.',
    'The Effective Settlement Confidence metric, defined as the proportion of transactions settling within a target window T at confidence level α, reveals that Arc Testnet achieves ESC(T=5s, α=0.99) = 0.997, compared to 0.831 for Ethereum Sepolia and 0.961 for Base Sepolia.',
    '## 4. Capital Efficiency Implications',
    'Lower variance in settlement latency directly improves capital efficiency for DeFi protocols that maintain cross-chain liquidity buffers. Under our queuing-theoretic model, a protocol with ESC ≥ 0.99 at T = 5 seconds can safely reduce its idle reserve ratio by 18–24% relative to a protocol constrained to an ESC = 0.96 environment — a meaningful reduction given that idle reserves represent foregone yield.',
    '## 5. Conclusion',
    'This study provides the first systematic comparison of USDC settlement latency across USDC-native and bridged-USDC chains at scale. The data supports the hypothesis that unifying the gas and payment token eliminates a structurally distinct source of latency variance. Future work will examine how this finding interacts with CCTP v2 attestation service upgrades and optimistic batch finality schemes.',
    'We release the complete dataset and reproducibility scripts at the companion repository.',
    '## References',
    'Li, W., Shen, A., & Torres, M. (2024). Latency analysis of Ethereum L2 rollups under congestion. *Proceedings of Financial Cryptography*, 12(3), 441–459.',
    'Nakamura, T., & Osei, K. (2025). Attestation delay in cross-chain USDC transfers. *Journal of DeFi Research*, 4(1), 77–102.',
  ],
}
