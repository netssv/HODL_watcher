import React from 'react';
import { Newspaper } from 'lucide-react';

const SENTIMENT_STYLE = {
  positive: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  negative: { bg: 'rgba(244,63,94,0.15)',  color: '#f43f5e' },
};

export function NewsSentimentCard({ news }) {
  if (!news?.length) return null;
  return (
    <section className="card">
      <div className="card-header">
        <h2><Newspaper className="w-4 h-4 text-blue-400" />News &amp; Sentiment</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {news.map((item, i) => {
          const s = SENTIMENT_STYLE[item.sentiment] ?? { bg: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' };
          return (
            <div key={i} style={{ borderBottom: i < news.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: i < news.length - 1 ? '0.5rem' : 0 }}>
              <a href={item.url} target="_blank" rel="noreferrer"
                style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', marginBottom: '0.2rem' }}>
                {item.title}
              </a>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {item.source} • {new Date(item.published_at).toLocaleString()}
                </span>
                {item.sentiment && item.sentiment !== 'null' && (
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', backgroundColor: s.bg, color: s.color }}>
                    {item.sentiment}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
