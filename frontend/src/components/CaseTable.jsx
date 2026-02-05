import React, { useState } from 'react'
import SLAIndicator from './SLAIndicator'

export default function CaseTable({ cases }) {
  const [sortConfig, setSortConfig] = useState({
    key: 'sla_minutes_left',
    direction: 'asc'
  })

  const sortedCases = [...cases].sort((a, b) => {
    let aVal = a[sortConfig.key]
    let bVal = b[sortConfig.key]

    // Handle null values - push to end
    if (aVal === null || aVal === undefined) return 1
    if (bVal === null || bVal === undefined) return -1

    // String comparison for text fields
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }

    if (sortConfig.direction === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    }
  })

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const formatTimeLeft = (minutes) => {
    if (minutes === null || minutes === undefined) return 'N/A'
    if (minutes < 0) {
      const absMin = Math.abs(minutes)
      if (absMin >= 60) {
        return `Breached (${Math.floor(absMin / 60)}h ${absMin % 60}m ago)`
      }
      return `Breached (${absMin}m ago)`
    }
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440)
      const hours = Math.floor((minutes % 1440) / 60)
      return `${days}d ${hours}h`
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hours}h ${mins}m`
    }
    return `${minutes}m`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    try {
      const date = new Date(dateStr)
      return date.toLocaleString()
    } catch {
      return dateStr
    }
  }

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return ''
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className="case-table-container">
      <table className="case-table">
        <thead>
          <tr>
            <th onClick={() => handleSort('sla_status')}>SLA{getSortIndicator('sla_status')}</th>
            <th onClick={() => handleSort('number')}>Case #{getSortIndicator('number')}</th>
            <th onClick={() => handleSort('short_description')}>Description{getSortIndicator('short_description')}</th>
            <th onClick={() => handleSort('priority')}>Priority{getSortIndicator('priority')}</th>
            <th onClick={() => handleSort('sub_state')}>State{getSortIndicator('sub_state')}</th>
            <th onClick={() => handleSort('sla_minutes_left')}>Time Left{getSortIndicator('sla_minutes_left')}</th>
            <th onClick={() => handleSort('sys_updated_on')}>Updated{getSortIndicator('sys_updated_on')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedCases.map(caseItem => (
            <tr key={caseItem.number} className={`row-${caseItem.sla_status}`}>
              <td>
                <SLAIndicator status={caseItem.sla_status} />
              </td>
              <td className="case-number">
                <span title="Click to copy">
                  {caseItem.number}
                </span>
              </td>
              <td className="description" title={caseItem.short_description || ''}>
                {caseItem.short_description
                  ? caseItem.short_description.length > 60
                    ? caseItem.short_description.substring(0, 60) + '...'
                    : caseItem.short_description
                  : '-'
                }
              </td>
              <td className={`priority priority-${caseItem.priority_level || 0}`}>
                {caseItem.priority || '-'}
              </td>
              <td>{caseItem.sub_state || '-'}</td>
              <td className={`time-left time-${caseItem.sla_status}`}>
                {formatTimeLeft(caseItem.sla_minutes_left)}
              </td>
              <td className="updated">
                {formatDate(caseItem.sys_updated_on)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedCases.length === 0 && (
        <div className="no-cases">No cases match the current filters</div>
      )}
    </div>
  )
}
