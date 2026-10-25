import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi } from 'viem'
import { arcTestnet } from '@/config'
import { toast } from 'sonner'
import { Lock, Unlock, CheckCircle, AlertCircle, Loader2, ExternalLink, Download } from 'lucide-react'
import { fetchArticle, gatedFileUrl, type ArticleFull } from '@/lib/api'
import { CONTENT_PAYWALL_ADDRESS, CONTENT_PAYWALL_ABI } from '@/contract'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { parseAmount, formatUsdc } from '@/onchain-money'

const CHAIN_ID = arcTestnet.id
const USDC_ADDRESS = getUsdc(CHAIN_ID)!.address as `0x${string}`

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 4px 24px rgba(18,45,69,0.07), inset 0 1px 0 rgba(255,255,255,0.55)',
}

function parseOnchainError(error: unknown): string {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (msg.includes('user rejected') || msg.includes('4001')) return 'Transaction cancelled.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('reverted')) return 'Transaction failed. Please try again.'
  return 'Something went wrong. Please try again.'
}

export default function Read() {
  const { docId: docIdStr } = useParams<{ docId: string }>()
  const docId = Number(docIdStr)

  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongChain = isConnected && chainId !== CHAIN_ID

  type ArticleState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ok'; article: ArticleFull }

  const isValidDocId = docId != null && !isNaN(docId) && docId > 0
  const [articleState, setArticleState] = useState<ArticleState>(
    isValidDocId ? { status: 'loading' } : { status: 'error', message: 'Invalid article link.' }
  )

  // Load article from DB
  useEffect(() => {
    if (!isValidDocId) return
    fetchArticle(docId)
      .then((a) => setArticleState({ status: 'ok', article: a }))
      .catch((e: unknown) => setArticleState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to load' }))
  }, [docId, isValidDocId])

  // On-chain unlock status
  const { data: chainUnlocked, refetch: refetchUnlocked } = useReadContract({
    address: CONTENT_PAYWALL_ADDRESS,
    abi: CONTENT_PAYWALL_ABI,
    functionName: 'isUnlocked',
    args: [BigInt(docId || 0), address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address) && !isNaN(docId) && docId > 0 },
  })

  // USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(address) },
  })

  // Approve
  const { writeContract: writeApprove, data: approveTxHash, isPending: isApprovePending, reset: resetApprove, error: approveError } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  // Unlock
  const { writeContract: writeUnlock, data: unlockTxHash, isPending: isUnlockPending, reset: resetUnlock, error: unlockError } = useWriteContract()
  // stable ref so the effect below can call writeUnlock without listing it as a dependency
  const writeUnlockRef = { current: writeUnlock }
  writeUnlockRef.current = writeUnlock

  const { isLoading: isUnlockConfirming, isSuccess: isUnlockSuccess } = useWaitForTransactionReceipt({ hash: unlockTxHash })

  // Error toasts
  useEffect(() => {
    if (approveError) { toast.error(parseOnchainError(approveError)); resetApprove() }
  }, [approveError, resetApprove])

  useEffect(() => {
    if (unlockError) { toast.error(parseOnchainError(unlockError)); resetUnlock() }
  }, [unlockError, resetUnlock])

  // Chain approve → unlock
  useEffect(() => {
    if (!isApproveSuccess) return
    writeUnlockRef.current({
      address: CONTENT_PAYWALL_ADDRESS,
      abi: CONTENT_PAYWALL_ABI,
      functionName: 'unlockDocument',
      args: [BigInt(docId)],
      chainId: CHAIN_ID,
    })
  }, [isApproveSuccess, docId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch on-chain state after unlock
  useEffect(() => {
    if (isUnlockSuccess) void refetchUnlocked()
  }, [isUnlockSuccess, refetchUnlocked])

  const isDocUnlocked = chainUnlocked === true || isUnlockSuccess
  const isBusy = isApprovePending || isApproveConfirming || isUnlockPending || isUnlockConfirming
  const formattedBalance = usdcBalance != null ? formatUsdc(usdcBalance) : null

  function ctaLabel() {
    if (isApprovePending) return 'Confirm allowance in wallet…'
    if (isApproveConfirming) return 'Confirming allowance…'
    if (isUnlockPending) return 'Confirm payment in wallet…'
    if (isUnlockConfirming) return 'Confirming payment…'
    return 'Pay $0.50 USDC to Unlock'
  }

  function handleUnlock() {
    if (!address) return
    writeApprove({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONTENT_PAYWALL_ADDRESS, parseAmount(CHAIN_ID, '0.50').raw],
      chainId: CHAIN_ID,
    })
  }

  if (articleState.status === 'loading') {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-20 text-center">
        <Loader2 size={28} className="mx-auto animate-spin" style={{ color: 'var(--subtle)' }} />
        <p className="mt-3 text-sm" style={{ color: 'var(--subtle)' }}>Loading article…</p>
      </div>
    )
  }

  if (articleState.status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
        <p className="text-base font-semibold" style={{ color: 'var(--danger)' }}>{articleState.message}</p>
      </div>
    )
  }

  const article = articleState.article

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      {isWrongChain && (
        <div className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)' }}>
          <AlertCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <span className="text-sm" style={{ color: 'var(--danger)' }}>Switch to Arc Testnet to unlock.</span>
          <button
            onClick={() => switchChain({ chainId: CHAIN_ID })}
            disabled={isSwitching}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold min-h-[44px]"
            style={{ background: 'var(--danger)', color: 'white', opacity: isSwitching ? 0.7 : 1 }}
          >
            {isSwitching ? 'Switching…' : 'Switch'}
          </button>
        </div>
      )}

      <article className="rounded-2xl p-8" style={glassCard}>
        {/* Meta */}
        <div className="mb-6">
          <span className="mb-3 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--surface-muted)', color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Article #{article.doc_id}
          </span>
          <h1 className="display mb-3 text-2xl font-bold leading-tight text-balance" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {article.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--ink-2)' }}>{article.author_name}</span>
            <span className="mono text-xs">{article.author_wallet.slice(0, 8)}…{article.author_wallet.slice(-4)}</span>
            <span>{new Date(article.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="mb-6 h-px" style={{ background: 'var(--border)' }} />

        {/* Abstract — always free */}
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Abstract</h2>
          <p className="text-base leading-relaxed text-pretty" style={{ color: 'var(--ink-2)' }}>{article.abstract}</p>
        </section>

        {/* Body — gated */}
        <section className="relative">
          <div style={{ filter: isDocUnlocked ? 'none' : 'blur(5px)', userSelect: isDocUnlocked ? 'auto' : 'none', pointerEvents: isDocUnlocked ? 'auto' : 'none', transition: 'filter 0.5s ease' }}>
            <h2 className="mb-3 text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>Full Article</h2>
            {article.body.split('\n\n').filter(Boolean).map((para, i) => (
              <p key={i} className="mb-4 text-base leading-relaxed text-pretty" style={{ color: 'var(--ink-2)' }}>{para}</p>
            ))}
          </div>

          {/* Paywall overlay */}
          {!isDocUnlocked && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
              style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,253,0.88) 25%, rgba(255,255,253,0.97) 50%, #fffcf7 100%)' }}
            >
              <div className="rounded-2xl p-6 text-center w-full" style={{ background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.7)', maxWidth: 360 }}>
                <div className="mb-4 mx-auto h-1 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />
                <Lock size={28} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
                <p className="display mb-1 text-lg font-bold" style={{ color: 'var(--ink)' }}>Full article locked</p>
                <p className="mb-1 text-sm" style={{ color: 'var(--muted)' }}>Support {article.author_name} with a one-time payment.</p>
                <p className="mb-2 text-xs" style={{ color: 'var(--subtle)' }}>Payment goes directly to the author. No subscription.</p>
                {article.has_file && (
                  <div className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ background: 'rgba(95,190,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(95,190,255,0.25)' }}>
                    <Download size={11} />
                    Includes downloadable file
                  </div>
                )}

                <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <span className="display text-2xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>$0.50</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
                </div>

                {isConnected && formattedBalance != null && (
                  <p className="mb-3 text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>Balance: {formattedBalance} USDC</p>
                )}

                {!isConnected ? (
                  <ConnectKitButton.Custom>
                    {({ show }) => (
                      <button onClick={show} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold min-h-[44px]" style={{ background: 'var(--accent)', color: 'white' }}>
                        Connect Wallet to Unlock
                      </button>
                    )}
                  </ConnectKitButton.Custom>
                ) : isWrongChain ? (
                  <button onClick={() => switchChain({ chainId: CHAIN_ID })} disabled={isSwitching} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold min-h-[44px]" style={{ background: 'var(--danger)', color: 'white', opacity: isSwitching ? 0.7 : 1 }}>
                    Switch to Arc Testnet
                  </button>
                ) : (
                  <button onClick={handleUnlock} disabled={isBusy} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all min-h-[44px]" style={{ background: isBusy ? 'var(--surface-muted)' : 'var(--accent)', color: isBusy ? 'var(--muted)' : 'white', cursor: isBusy ? 'not-allowed' : 'pointer', border: isBusy ? '1px solid var(--border)' : 'none' }}>
                    {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                    <span>{ctaLabel()}</span>
                  </button>
                )}

                {isBusy && (
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs" style={{ color: 'var(--subtle)' }}>
                    <span className="flex items-center gap-1">
                      {(isApproveSuccess || isUnlockPending || isUnlockConfirming)
                        ? <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                        : <Loader2 size={12} className="animate-spin" />}
                      Approve USDC
                    </span>
                    <span style={{ opacity: 0.4 }}>→</span>
                    <span className="flex items-center gap-1">
                      {(isUnlockPending || isUnlockConfirming)
                        ? <Loader2 size={12} className="animate-spin" />
                        : <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />}
                      Unlock Article
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success banner */}
          {isDocUnlocked && unlockTxHash && (
            <div className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(26,128,71,0.07)', border: '1px solid rgba(26,128,71,0.2)' }}>
              <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>Article unlocked! Enjoy reading.</span>
              <a
                href={buildTxExplorerUrl(CHAIN_ID, unlockTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs"
                style={{ color: 'var(--muted)', textDecoration: 'none' }}
              >
                View tx <ExternalLink size={10} />
              </a>
            </div>
          )}

          {/* Gated file download — only shown after on-chain unlock */}
          {isDocUnlocked && address && article.has_file && (
            <div className="mt-4 rounded-xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <Download size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                    {article.file_name ?? 'Document'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>Full document included with this article</p>
                </div>
                <a
                  href={gatedFileUrl(article.doc_id, address)}
                  download={article.file_name ?? 'document'}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold min-h-[40px] flex-shrink-0"
                  style={{ background: 'var(--accent)', color: 'white', textDecoration: 'none' }}
                >
                  <Download size={13} />
                  Download
                </a>
              </div>
            </div>
          )}
        </section>
      </article>
    </div>
  )
}
