'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AskEaterPage() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Hello Kavya! I am Ask Eater, your conversational campus food & spend assistant. You can ask me anything about your recorded meals, daily protein progress, canteen spending habits, or budget remaining.',
      metrics: null,
      sql: null
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const samplePrompts = [
    'How much did I spend this week?',
    'Did I reach my protein goal today?',
    'Which canteen do I spend the most at?',
    'What were my 5 most recent meals?',
    'How much budget do I have left this month?'
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAsk = async (textToSend) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    // Append user query to conversation
    const userMsg = { sender: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/ask-eater', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });
      if (!res.ok) throw new Error('Query failed');
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer,
          metrics: data.metrics,
          sql: data.sql_explanation
        }
      ]);
    } catch (err) {
      console.error(err);
      showToast('Could not process question', 'error');
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: 'I ran into an issue analyzing that question. Try asking about your spending, protein targets, or canteen records.',
          metrics: null,
          sql: null
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ask Eater — Natural-Language Assistant</h1>
          <p className="page-subtitle">
            Query your campus dining, spending logs, and nutritional milestones using conversational natural English.
          </p>
        </div>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => setMessages([
              {
                sender: 'assistant',
                text: 'Chat history cleared. How can I assist you with your campus food records?',
                metrics: null,
                sql: null
              }
            ])}
          >
            Clear Conversation
          </button>
        </div>
      </div>

      {/* Suggested Quick Question Pills */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Suggested Inquiries
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleAsk(p)}
              disabled={loading}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-full)',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.background = 'var(--accent-primary-tint)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Feed */}
      <div
        className="card"
        style={{
          minHeight: '440px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px', overflowY: 'auto' }}>
          {messages.map((m, idx) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                {!isUser && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--accent-primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13px',
                    flexShrink: 0
                  }}>
                    E
                  </div>
                )}

                <div
                  style={{
                    maxWidth: '75%',
                    background: isUser ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px 20px',
                    fontSize: '14px',
                    lineHeight: 1.6
                  }}
                >
                  <div>{m.text}</div>

                  {/* Structured Key Metrics */}
                  {m.metrics && m.metrics.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px',
                      marginTop: '14px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border-subtle)'
                    }}>
                      {m.metrics.map((met, i) => (
                        <div
                          key={i}
                          style={{
                            background: '#ffffff',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '8px 10px'
                          }}
                        >
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {met.label}
                          </div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '2px' }}>
                            {met.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SQL & Model Transparency */}
                  {m.sql && (
                    <div style={{
                      marginTop: '10px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      fontFamily: 'monospace'
                    }}>
                      Query Source: {m.sql}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
              <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
              <span>Querying database logs...</span>
            </div>
          )}
        </div>

        {/* Query Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          style={{ display: 'flex', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}
        >
          <input
            type="text"
            className="form-input"
            placeholder="Ask a question about your food, budget, or protein (e.g. 'How much did I spend yesterday?')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !query.trim()}
          >
            Ask Eater
          </button>
        </form>
      </div>
    </div>
  );
}
