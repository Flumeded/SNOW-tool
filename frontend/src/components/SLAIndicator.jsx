import React from 'react'

const statusConfig = {
  breached: { color: '#8b0000', label: 'Breached', pulse: true },
  critical: { color: '#dc3545', label: 'Critical', pulse: true },
  warning: { color: '#ffc107', label: 'Warning', pulse: false },
  ok: { color: '#28a745', label: 'OK', pulse: false },
  unknown: { color: '#6c757d', label: 'Unknown', pulse: false }
}

export default function SLAIndicator({ status, showLabel = false }) {
  const config = statusConfig[status] || statusConfig.unknown

  return (
    <span className="sla-indicator">
      <span
        className={`sla-dot ${config.pulse ? 'pulse' : ''}`}
        style={{ backgroundColor: config.color }}
        title={config.label}
      />
      {showLabel && <span className="sla-label">{config.label}</span>}
    </span>
  )
}
