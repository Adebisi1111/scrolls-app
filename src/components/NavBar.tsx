import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ConnectKitButton } from 'connectkit'
import { BookOpen, PenLine, AlertTriangle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { useAccount, useChainId } from 'wagmi'
import { ARC_GOOD_RPC } from '@/useRepairChain'

const ARC_TESTNET_ID = 5042002 // arc-studio-allow-onchain-literal

export default function NavBar() {
  const { pathname } = useLocation()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  // Show the banner when connected to Arc Testnet but RPC error is possible.
  // The RPC error comes from MetaMask's own stored URL — we can't change it
  // programmatically; user must update it in MetaMask Settings.
  const onArcTestnet = chainId === ARC_TESTNET_ID
  const showBanner = isConnected && onArcTestnet

  function copyRpc() {
    void navigator.clipboard.writeText(ARC_GOOD_RPC).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <BookOpen size={20} style={{ color: 'var(--accent)' }} />
            <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>
              Scrolls
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/publish"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors min-h-[44px]"
              style={{
                background: pathname === '/publish' ? 'var(--surface-muted)' : 'transparent',
                color: 'var(--ink-2)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
              }}
            >
              <PenLine size={14} />
              Publish
            </Link>

            <ConnectKitButton.Custom>
              {({ isConnected: ck, show, address }) => (
                <button
                  onClick={show}
                  className="rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]"
                  style={{
                    background: ck ? 'var(--surface-muted)' : 'var(--accent)',
                    color: ck ? 'var(--ink)' : 'white',
                    border: ck ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {ck && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Connect Wallet'}
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        </div>
      </header>

      {/* RPC fix banner — only shown when on Arc Testnet (where the stale RPC matters) */}
      {showBanner && (
        <div style={{ background: '#fefce8', borderBottom: '1px solid #fde047' }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm text-left"
            style={{ color: '#854d0e' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span className="font-medium">Getting RPC errors?</span>
              <span className="hidden sm:inline" style={{ color: '#a16207' }}>
                — Update Arc Testnet RPC in MetaMask to fix them.
              </span>
            </div>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {expanded && (
            <div
              className="px-4 pb-4 text-sm"
              style={{ color: '#78350f' }}
            >
              <p className="mb-3">
                MetaMask stores its own RPC URL for each network and uses it for transaction signing,
                even when the app specifies a different one. If you see{' '}
                <code className="px-1 rounded text-xs" style={{ background: '#fef08a' }}>
                  HTTP request failed. URL: https://rpc.testnet.arc.network/
                </code>
                , MetaMask has a stale RPC saved. Fix it in 3 steps:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 mb-3">
                <li>Open MetaMask → click the network dropdown (top-left)</li>
                <li>Find <strong>Arc Testnet</strong> → click the three-dot menu → <strong>Edit</strong></li>
                <li>
                  Replace the RPC URL with:
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#fef9c3', border: '1px solid #fde047' }}>
                    <code className="flex-1 text-xs break-all" style={{ color: '#713f12' }}>{ARC_GOOD_RPC}</code>
                    <button
                      onClick={copyRpc}
                      className="flex-shrink-0 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium"
                      style={{ background: copied ? '#86efac' : '#fde047', color: '#713f12' }}
                    >
                      {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                </li>
              </ol>
              <p style={{ color: '#a16207' }}>
                After saving, MetaMask will use this RPC for all Arc Testnet transactions and the error will stop.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
