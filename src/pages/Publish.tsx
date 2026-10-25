import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import {
  PenLine, CheckCircle, Loader2, ArrowRight,
  UploadCloud, FileText, X, AlertCircle,
} from 'lucide-react'
import { arcTestnet } from '@/config'
import { reserveDocId, publishArticle } from '@/lib/api'
import { CONTENT_PAYWALL_ADDRESS, CONTENT_PAYWALL_ABI } from '@/contract'

const CHAIN_ID = arcTestnet.id

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 4px 24px rgba(18,45,69,0.07), inset 0 1px 0 rgba(255,255,255,0.55)',
}

const ACCEPTED_TYPES = '.pdf,.txt,.md,.doc,.docx'
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_SIZE_MB = 20

type Step = 'form' | 'switching' | 'reserving' | 'awaiting_wallet' | 'confirming' | 'saving' | 'done'

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'switching',      label: 'Switching network' },
  { key: 'reserving',      label: 'Preparing doc ID' },
  { key: 'awaiting_wallet', label: 'Awaiting wallet approval' },
  { key: 'confirming',     label: 'Confirming on-chain' },
  { key: 'saving',         label: 'Saving article' },
]

function FileIcon({ mime }: { mime: string }) {
  if (mime === 'application/pdf') return <span className="text-xs font-bold" style={{ color: 'var(--danger)' }}>PDF</span>
  if (mime.startsWith('text/')) return <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>TXT</span>
  return <FileText size={14} style={{ color: 'var(--muted)' }} />
}

export default function Publish() {
  const navigate = useNavigate()
  const { address, isConnected, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('form')
  const [docId, setDocId] = useState<number | null>(null)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [form, setForm] = useState({ title: '', author_name: '', abstract: '', body: '' })

  // We use writeContractAsync so the whole flow lives in one async function
  // with explicit error handling at every step — no derived state gaps.
  const { writeContractAsync } = useWriteContract()

  // Track the tx hash so we can poll for confirmation
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined)
  const { isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash,
      // Poll every 3 s — Arc Testnet block time is ~1 s but propagation across
      // RPC nodes can lag several seconds. 3 s avoids hammering while still
      // confirming quickly.
      pollingInterval: 3_000,
      // Retry up to 20 times (60 s total) before giving up.
      retryCount: 20,
      confirmations: 1,
    })

  // After on-chain confirmation: save to DB
  const pendingSaveRef = useRef<{
    docId: number; title: string; author_name: string; author_wallet: string
    abstract: string; body: string; file: File | null
  } | null>(null)

  useEffect(() => {
    if (!isConfirmed || !pendingSaveRef.current) return
    const pending = pendingSaveRef.current
    pendingSaveRef.current = null
    console.log('[Publish] tx confirmed — saving to DB', pending.docId)
    setStep('saving')
    publishArticle({
      doc_id: pending.docId,
      title: pending.title,
      author_name: pending.author_name,
      author_wallet: pending.author_wallet,
      abstract: pending.abstract,
      body: pending.body,
      file: pending.file,
    })
      .then((article) => {
        setDocId(article.doc_id)
        setShareLink(`${window.location.origin}/read/${article.doc_id}`)
        setStep('done')
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        toast.error(
          `Article registered on-chain but save failed: ${msg}. Doc ID is #${pending.docId} — note it down.`,
          { duration: 10000 }
        )
        setStep('form')
      })
  }, [isConfirmed])

  // ── File handling ────────────────────────────────────────────────────────────
  function acceptFile(file: File | null | undefined) {
    if (!file) return
    if (!ACCEPTED_MIME.has(file.type) && !file.name.match(/\.(pdf|txt|md|doc|docx)$/i)) {
      toast.error('Only PDF, TXT, MD, DOC, and DOCX files are accepted.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_SIZE_MB} MB.`)
      return
    }
    setSelectedFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0])
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0])
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  // ── Submit — entire flow in one async function ───────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    console.log('[Publish] submit clicked', { isConnected, address, chainId, CHAIN_ID, CONTENT_PAYWALL_ADDRESS })

    // Guard: wallet must be connected
    if (!isConnected || !address) {
      toast.error('Connect your wallet first.')
      return
    }

    // Guard: contract address must be set
    if (!CONTENT_PAYWALL_ADDRESS) {
      toast.error('Contract address not configured. Please refresh and try again.')
      return
    }

    // Guard: form validation
    const bodyRequired = !selectedFile
    if (!form.title.trim() || !form.author_name.trim() || !form.abstract.trim() || (bodyRequired && !form.body.trim())) {
      toast.error(bodyRequired
        ? 'Please fill in all required fields (title, author, abstract, body).'
        : 'Please fill in title, author name, and abstract.')
      return
    }

    try {
      // Step 1: Switch network if needed
      if (chainId !== CHAIN_ID) {
        console.log('[Publish] wrong chain — switching', { chainId, CHAIN_ID })
        setStep('switching')
        try {
          await switchChainAsync({ chainId: CHAIN_ID })
          console.log('[Publish] chain switched')
        } catch (switchErr) {
          console.error('[Publish] chain switch failed', switchErr)
          toast.error('Please switch to Arc Testnet in your wallet and try again.')
          setStep('form')
          return
        }
      }

      // Step 2: Reserve a doc ID from the backend (fast, no file upload)
      console.log('[Publish] reserving doc ID')
      setStep('reserving')
      let nextId: number
      try {
        nextId = await reserveDocId()
        console.log('[Publish] reserved doc ID', nextId)
      } catch (err) {
        console.error('[Publish] reserveDocId failed', err)
        toast.error(`Could not reserve a document ID: ${err instanceof Error ? err.message : 'Server error. Is the backend running?'}`)
        setStep('form')
        return
      }

      // Stash everything the post-confirmation effect will need
      pendingSaveRef.current = {
        docId: nextId,
        title: form.title.trim(),
        author_name: form.author_name.trim(),
        author_wallet: address,
        abstract: form.abstract.trim(),
        body: form.body.trim(),
        file: selectedFile,
      }

      // Step 3: Trigger wallet approval — MetaMask/wallet prompt opens here
      console.log('[Publish] calling registerDoc', { contract: CONTENT_PAYWALL_ADDRESS, docId: nextId, author: address })
      setStep('awaiting_wallet')
      let hash: `0x${string}`
      try {
        hash = await writeContractAsync({
          address: CONTENT_PAYWALL_ADDRESS,
          abi: CONTENT_PAYWALL_ABI,
          functionName: 'registerDoc',
          args: [BigInt(nextId), address],
          chainId: CHAIN_ID,
        })
        console.log('[Publish] tx submitted', hash)
      } catch (err) {
        pendingSaveRef.current = null
        console.error('[Publish] registerDoc tx failed', err)
        const msg = (err instanceof Error ? err.message : '').toLowerCase()
        if (msg.includes('user rejected') || msg.includes('4001') || msg.includes('denied')) {
          toast.error('Transaction cancelled — you can try again.')
        } else if (msg.includes('onlyowner') || msg.includes('unauthorized') || msg.includes('access')) {
          toast.error('Permission denied: your wallet is not authorized to register documents on this contract. The contract may need redeployment.')
        } else {
          toast.error(`Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
        setStep('form')
        return
      }

      // Step 4: Wait for on-chain confirmation (wagmi hook handles this via txHash)
      setTxHash(hash)
      setStep('confirming')
      console.log('[Publish] awaiting confirmation for', hash)
      // DB save happens in the useEffect above once isConfirmed flips

    } catch (err) {
      // Catch-all — ensures spinner never gets stuck
      console.error('[Publish] unexpected error', err)
      toast.error(`Unexpected error: ${err instanceof Error ? err.message : 'Please try again.'}`)
      pendingSaveRef.current = null
      setStep('form')
    }
  }

  const isBusy = step !== 'form'

  function ctaLabel() {
    if (step === 'switching')       return <><Loader2 size={16} className="animate-spin" /> Switching network…</>
    if (step === 'reserving')       return <><Loader2 size={16} className="animate-spin" /> Preparing…</>
    if (step === 'awaiting_wallet') return <><Loader2 size={16} className="animate-spin" /> Awaiting wallet approval…</>
    if (step === 'confirming')      return <><Loader2 size={16} className="animate-spin" /> Confirming on-chain…</>
    if (step === 'saving')          return <><Loader2 size={16} className="animate-spin" /> Saving article…</>
    return <><PenLine size={16} /> Publish Article</>
  }

  const isWrongChain = isConnected && chainId !== CHAIN_ID

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (step === 'done' && shareLink && docId != null) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8">
        <div className="rounded-2xl p-8 text-center" style={glassCard}>
          <div className="mb-4 mx-auto h-1 w-12 rounded-full" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />
          <CheckCircle size={36} className="mx-auto mb-4" style={{ color: 'var(--success)' }} />
          <h2 className="display mb-2 text-xl font-bold" style={{ color: 'var(--ink)' }}>Paper published!</h2>
          <p className="mb-1 text-sm" style={{ color: 'var(--muted)' }}>Article #{docId} is live on Scrolls.</p>
          <p className="mb-5 text-xs" style={{ color: 'var(--subtle)' }}>
            Readers pay $0.50 USDC to unlock it. 98% comes directly to your wallet.
            {selectedFile && ' Your uploaded file is gated behind the paywall.'}
          </p>

          <div className="mb-5 rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Share link</p>
            <p className="mono break-all text-sm" style={{ color: 'var(--ink)' }}>{shareLink}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              onClick={() => { void navigator.clipboard.writeText(shareLink); toast.success('Link copied!') }}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold min-h-[44px]"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Copy link
            </button>
            <button
              onClick={() => { void navigate(`/read/${docId}`) }}
              className="flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold min-h-[44px]"
              style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              View article <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <div className="mb-6">
        <h1 className="display mb-1 text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>Publish a paper</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Fill in your article details. Connect your wallet — payments go directly to it.</p>
      </div>

      {!isConnected ? (
        <div className="rounded-2xl p-6 text-center" style={glassCard}>
          <PenLine size={28} className="mx-auto mb-3" style={{ color: 'var(--accent)' }} />
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to receive payments as author.</p>
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button onClick={show} className="rounded-xl px-5 py-2.5 text-sm font-semibold min-h-[44px]" style={{ background: 'var(--accent)', color: 'white' }}>
                Connect Wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      ) : (
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
          {/* Article details */}
          <div className="rounded-2xl p-6 space-y-4" style={glassCard}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Title *</label>
              <input
                name="title" value={form.title} onChange={handleChange}
                required disabled={isBusy}
                placeholder="e.g. The Economics of Onchain Publishing"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Author Name *</label>
              <input
                name="author_name" value={form.author_name} onChange={handleChange}
                required disabled={isBusy}
                placeholder="e.g. Dr. Alice Chen"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(18,45,69,0.04)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Payment wallet</p>
              <p className="mono mt-0.5 text-xs" style={{ color: 'var(--ink-2)' }}>{address}</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>98% of every $0.50 unlock goes here</p>
            </div>
          </div>

          {/* Abstract */}
          <div className="rounded-2xl p-6" style={glassCard}>
            <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Abstract * <span style={{ color: 'var(--subtle)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(visible to everyone for free)</span>
            </label>
            <textarea
              name="abstract" value={form.abstract} onChange={handleChange}
              required disabled={isBusy} rows={4}
              placeholder="A brief summary of your research (2–3 sentences). This is shown publicly before readers pay."
              className="w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 disabled:opacity-60"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
          </div>

          {/* File upload */}
          <div className="rounded-2xl p-6 space-y-3" style={glassCard}>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Upload Document{' '}
                <span style={{ color: 'var(--subtle)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional — becomes the primary gated content)</span>
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>PDF, TXT, MD, DOC, DOCX · Max {MAX_SIZE_MB} MB · When uploaded, body text below becomes optional</p>
            </div>

            {selectedFile ? (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(95,190,255,0.08)', border: '1px solid rgba(95,190,255,0.25)' }}>
                <FileIcon mime={selectedFile.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>{selectedFile.name}</p>
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>{(selectedFile.size / 1024).toFixed(0)} KB · gated behind paywall</p>
                </div>
                <button type="button" onClick={() => setSelectedFile(null)} disabled={isBusy}
                  className="rounded-lg p-1.5" style={{ color: 'var(--muted)' }} aria-label="Remove file">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                role="button" tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl px-4 py-8 text-center transition-colors"
                style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, background: dragOver ? 'rgba(95,190,255,0.06)' : 'var(--surface-muted)' }}
              >
                <UploadCloud size={24} style={{ color: dragOver ? 'var(--accent)' : 'var(--subtle)' }} />
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  <span className="font-semibold" style={{ color: 'var(--accent)' }}>Click to upload</span> or drag and drop
                </p>
                <p className="text-xs" style={{ color: 'var(--subtle)' }}>PDF, TXT, MD, DOC, DOCX up to {MAX_SIZE_MB} MB</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileInput} className="sr-only" disabled={isBusy} />
          </div>

          {/* Body — required only when no file */}
          <div className="rounded-2xl p-6" style={glassCard}>
            <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Full Article Body{!selectedFile ? ' *' : ''}{' '}
              <span style={{ color: 'var(--subtle)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                {selectedFile ? '(optional — uploaded file is the primary document)' : '(unlocked after payment)'}
              </span>
            </label>
            <textarea
              name="body" value={form.body} onChange={handleChange}
              required={!selectedFile} disabled={isBusy}
              rows={selectedFile ? 5 : 12}
              placeholder={selectedFile
                ? 'Optional — add a text summary or excerpt. Readers see this after unlocking.'
                : 'Write your full article here. This content is blurred until a reader pays $0.50 USDC to unlock it.'}
              className="w-full resize-y rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 disabled:opacity-60"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)', minHeight: selectedFile ? 80 : 200, opacity: selectedFile ? 0.75 : 1 }}
            />
          </div>

          {/* Network warning (idle only) */}
          {isWrongChain && !isBusy && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(186,43,76,0.07)', border: '1px solid rgba(186,43,76,0.2)' }}>
              <AlertCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--danger)' }}>Switch to Arc Testnet to publish.</span>
              <button
                type="button"
                onClick={() => { void switchChainAsync({ chainId: CHAIN_ID }).catch(() => toast.error('Switch failed — please switch manually in your wallet.')) }}
                className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'var(--danger)', color: 'white' }}
              >
                Switch
              </button>
            </div>
          )}

          {/* Progress tracker (shown while busy) */}
          {isBusy && (
            <div className="rounded-xl px-4 py-4" style={{ background: 'rgba(95,190,255,0.06)', border: '1px solid rgba(95,190,255,0.18)' }}>
              <div className="flex flex-col gap-2">
                {STEP_LABELS.map(({ key, label }) => {
                  const order: Step[] = ['switching', 'reserving', 'awaiting_wallet', 'confirming', 'saving']
                  const thisIdx = order.indexOf(key)
                  const curIdx  = order.indexOf(step)
                  const done    = thisIdx < curIdx
                  const active  = thisIdx === curIdx
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {done
                        ? <CheckCircle size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                        : active
                        ? <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                        : <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ background: 'var(--border)' }} />}
                      <span style={{ color: active ? 'var(--ink)' : done ? 'var(--success)' : 'var(--subtle)', fontWeight: active ? 600 : 400 }}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold min-h-[44px] transition-all"
            style={{
              background: isBusy ? 'var(--surface-muted)' : 'var(--accent)',
              color: isBusy ? 'var(--muted)' : 'white',
              border: isBusy ? '1px solid var(--border)' : 'none',
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {ctaLabel()}
          </button>
        </form>
      )}
    </div>
  )
}
