'use client'

const BRACKET_SIZE = 22  // px

const bracketStyle = (corner: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: BRACKET_SIZE,
    height: BRACKET_SIZE,
    borderColor: '#00ccff',
    borderStyle: 'solid',
    opacity: 0.75,
    boxShadow: '0 0 6px rgba(0,204,255,0.5)',
  }
  switch (corner) {
    case 'tl': return { ...base, top: 14, left: 14, borderWidth: '2px 0 0 2px' }
    case 'tr': return { ...base, top: 14, right: 14, borderWidth: '2px 2px 0 0' }
    case 'bl': return { ...base, bottom: 14, left: 14, borderWidth: '0 0 2px 2px' }
    case 'br': return { ...base, bottom: 14, right: 14, borderWidth: '0 2px 2px 0' }
    default:   return base
  }
}

export default function CornerBrackets() {
  return (
    <>
      <div style={bracketStyle('tl')} />
      <div style={bracketStyle('tr')} />
      <div style={bracketStyle('bl')} />
      <div style={bracketStyle('br')} />
    </>
  )
}
