export default function BrandLogo({ size = 'md', subtitle = true }) {
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isLarge ? 'center' : 'flex-start',
      userSelect: 'none',
    }}>
      {/* SOLUSHAN Wordmark matching official logo */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        lineHeight: 1.1,
      }}>
        {/* Stylized Red S */}
        <span style={{
          color: '#A10F2B',
          fontWeight: 900,
          fontSize: isLarge ? '2.1rem' : isSmall ? '1.2rem' : '1.5rem',
          letterSpacing: '1px',
          fontFamily: "'Inter', sans-serif",
        }}>
          S
        </span>
        {/* OLUSHAN uppercase adapting to light and dark theme */}
        <span style={{
          color: 'var(--text-primary)',
          fontWeight: 800,
          fontSize: isLarge ? '2.1rem' : isSmall ? '1.2rem' : '1.5rem',
          letterSpacing: '2.5px',
          marginLeft: '1px',
          fontFamily: "'Inter', sans-serif",
        }}>
          OLUSHAN
        </span>
      </div>

      {/* TECHNOLOGIES Accent */}
      <div style={{
        fontSize: isLarge ? '0.85rem' : isSmall ? '0.62rem' : '0.72rem',
        fontWeight: 700,
        color: '#4F8EF7',
        letterSpacing: '3.5px',
        textTransform: 'uppercase',
        marginTop: '2px',
        fontFamily: "'Inter', sans-serif",
      }}>
        TECHNOLOGIES
      </div>

      {/* Optional Project Portal tag */}
      {subtitle && (
        <div style={{
          fontSize: isLarge ? '0.75rem' : isSmall ? '0.58rem' : '0.65rem',
          color: 'var(--text-muted, #94A3B8)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginTop: '2px',
        }}>
          Project Portal
        </div>
      )}
    </div>
  );
}
