// ContentPaywall v2 contract address and ABI — Arc Testnet
export const CONTENT_PAYWALL_ADDRESS =
  (import.meta.env.VITE_CONTENT_PAYWALL_ADDRESS ?? '') as `0x${string}`

export const CONTENT_PAYWALL_ABI = [
  // --- Write functions ---
  {
    name: 'registerDoc',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'docId', type: 'uint256' },
      { name: 'author', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'unlockDocument',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'docId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'setPlatformTreasury',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_newTreasury', type: 'address' }],
    outputs: [],
  },
  {
    name: 'updateDocAuthor',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'docId', type: 'uint256' },
      { name: 'newAuthor', type: 'address' },
    ],
    outputs: [],
  },
  // --- View functions ---
  {
    name: 'isUnlocked',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'docId', type: 'uint256' },
      { name: 'reader', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'isDocumentUnlocked',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'docId', type: 'uint256' },
      { name: 'reader', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getAuthor',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'docId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'UNLOCK_PRICE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'platformTreasury',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'platformFeePercent',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // --- Events ---
  {
    name: 'DocumentUnlocked',
    type: 'event',
    inputs: [
      { name: 'docId', type: 'uint256', indexed: true },
      { name: 'reader', type: 'address', indexed: true },
      { name: 'author', type: 'address', indexed: true },
      { name: 'authorAmount', type: 'uint256', indexed: false },
      { name: 'platformAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'DocRegistered',
    type: 'event',
    inputs: [
      { name: 'docId', type: 'uint256', indexed: true },
      { name: 'author', type: 'address', indexed: true },
    ],
  },
  {
    name: 'PlatformTreasuryUpdated',
    type: 'event',
    inputs: [
      { name: 'oldTreasury', type: 'address', indexed: true },
      { name: 'newTreasury', type: 'address', indexed: true },
    ],
  },
] as const
