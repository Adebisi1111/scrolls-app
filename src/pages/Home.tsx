import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ArrowRight, PenLine } from 'lucide-react'
import { listArticles, type ArticleMeta } from '@/lib/api'

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 4px 24px rgba(18,45,69,0.07), inset 0 1px 0 rgba(255,255,255,0.55)',
}

export default function Home() {
  const [articles, setArticles] = useState<ArticleMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listArticles()
      .then(setArticles)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: 'var(--surface-muted)', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          <BookOpen size={12} /> Research publishing on Arc
        </div>
        <h1 className="display mb-3 text-4xl font-bold text-balance" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Monetize your research,<br />one reader at a time.
        </h1>
        <p className="mx-auto mb-6 max-w-md text-base leading-relaxed text-pretty" style={{ color: 'var(--muted)' }}>
          Publish your paper. Readers pay $0.50 USDC to unlock the full text. 98% goes directly to you.
        </p>
        <Link
          to="/publish"
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold min-h-[44px]"
          style={{ background: 'var(--accent)', color: 'white', textDecoration: 'none' }}
        >
          <PenLine size={16} />
          Publish your paper
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Spectral strip */}
      <div className="mx-auto mb-8 h-0.5 max-w-xs rounded-full" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />

      {/* Article list */}
      <div>
        <h2 className="display mb-4 text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          {loading ? 'Loading…' : articles.length === 0 ? 'No papers yet' : 'Latest papers'}
        </h2>

        {error && (
          <p className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        {!loading && articles.length === 0 && !error && (
          <div className="rounded-2xl p-8 text-center" style={glassCard}>
            <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--subtle)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Be the first to publish on Scrolls.</p>
          </div>
        )}

        <div className="space-y-3">
          {articles.map((a) => (
            <Link
              key={a.doc_id}
              to={`/read/${a.doc_id}`}
              className="block rounded-2xl p-5 transition-all hover:shadow-md"
              style={{ ...glassCard, textDecoration: 'none' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="display mb-1 text-base font-semibold text-balance" style={{ color: 'var(--ink)' }}>
                    {a.title}
                  </h3>
                  <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
                    {a.author_name} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                  <p className="line-clamp-2 text-sm leading-relaxed" style={{ color: 'var(--ink-2)' }}>
                    {a.abstract}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <span className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tabular-nums" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
                    $0.50
                    <ArrowRight size={10} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
