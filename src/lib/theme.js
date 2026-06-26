export const card = {
  background: 'var(--noir-card)',
  border: '1px solid var(--noir-border)',
  borderRadius: '16px',
  padding: '16px',
}

export const input = {
  background: 'var(--noir-mid)',
  border: '1px solid var(--noir-border)',
  color: 'var(--text-primary)',
  borderRadius: '12px',
  padding: '10px 14px',
  fontSize: '14px',
  width: '100%',
}

export const btnPrimary = {
  background: 'linear-gradient(135deg, var(--violet), var(--accent))',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  padding: '12px',
  fontWeight: '600',
  width: '100%',
  fontSize: '14px',
}

export const btnSecondary = {
  background: 'var(--noir-mid)',
  color: 'var(--text-primary)',
  border: '1px solid var(--noir-border)',
  borderRadius: '12px',
  padding: '12px',
  fontWeight: '500',
  fontSize: '14px',
}

export const btnGhost = {
  background: 'transparent',
  color: 'var(--text-muted)',
  border: '1px solid var(--noir-border)',
  borderRadius: '10px',
  padding: '8px 14px',
  fontSize: '13px',
}

export const tag = (active) => ({
  background: active ? 'var(--violet)' : 'var(--noir-mid)',
  color: active ? 'white' : 'var(--text-muted)',
  border: `1px solid ${active ? 'var(--violet)' : 'var(--noir-border)'}`,
  borderRadius: '999px',
  padding: '6px 14px',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
})

export const badge = (type) => {
  const map = {
    blue: { bg: '#0D1B3E', color: '#60A5FA', border: '#1E3A6E' },
    green: { bg: '#0A2E1E', color: '#34D399', border: '#0F5132' },
    amber: { bg: '#1E1A00', color: '#FBBF24', border: '#44400A' },
    red: { bg: '#2E0A0A', color: '#F87171', border: '#6B1313' },
    purple: { bg: '#1A0A2E', color: '#C084FC', border: '#4C1D95' },
    muted: { bg: '#1A1033', color: '#A594D4', border: '#3D2E6B' },
  }
  const c = map[type] || map.muted
  return { background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: '999px', padding: '3px 10px', fontSize: '11px', fontWeight: '500' }
}

export const section = {
  color: 'var(--text-primary)',
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: '700',
  fontSize: '18px',
  marginBottom: '16px',
}
