import React, { useState } from 'react'
import CaseTable from './CaseTable'
import StatsPanel from './StatsPanel'

export default function Dashboard({ stats, cases, onRefresh }) {
  const [filter, setFilter] = useState({
    status: '',
    priority: '',
    slaStatus: ''
  })

  const filteredCases = cases.filter(c => {
    if (filter.status && c.sub_state !== filter.status) return false
    if (filter.priority && c.priority !== filter.priority) return false
    if (filter.slaStatus) {
      // Special handling for 'urgent' filter - includes both critical and breached
      if (filter.slaStatus === 'urgent') {
        if (c.sla_status !== 'critical' && c.sla_status !== 'breached') return false
      } else if (c.sla_status !== filter.slaStatus) {
        return false
      }
    }
    return true
  })

  const urgentCount = (stats?.sla_breakdown?.critical || 0) + (stats?.sla_breakdown?.breached || 0)
  const breachedCount = stats?.sla_breakdown?.breached || 0

  // Get unique values for filters
  const uniqueStates = [...new Set(cases.map(c => c.sub_state).filter(Boolean))]
  const uniquePriorities = [...new Set(cases.map(c => c.priority).filter(Boolean))]

  return (
    <div className="dashboard">
      {/* Alert Banner */}
      {urgentCount > 0 && (
        <div className="alert-banner critical">
          <span className="alert-icon">!</span>
          <span>
            {breachedCount > 0 && `${breachedCount} SLA BREACHED! `}
            {urgentCount > 0 && `${urgentCount} case${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} immediate attention`}
          </span>
        </div>
      )}

      {/* Stats Overview */}
      <div className="stats-row">
        <div className="stat-card total" onClick={() => setFilter({ status: '', priority: '', slaStatus: '' })}>
          <span className="stat-value">{stats?.total_active || 0}</span>
          <span className="stat-label">Active Cases</span>
        </div>
        <div
          className="stat-card critical"
          onClick={() => setFilter({ ...filter, slaStatus: filter.slaStatus === 'urgent' ? '' : 'urgent' })}
          style={{ opacity: filter.slaStatus === 'urgent' ? 1 : 0.8 }}
        >
          <span className="stat-value">{urgentCount}</span>
          <span className="stat-label">Urgent</span>
        </div>
        <div
          className="stat-card warning"
          onClick={() => setFilter({ ...filter, slaStatus: filter.slaStatus === 'warning' ? '' : 'warning' })}
          style={{ opacity: filter.slaStatus === 'warning' ? 1 : 0.8 }}
        >
          <span className="stat-value">{stats?.sla_breakdown?.warning || 0}</span>
          <span className="stat-label">Warning</span>
        </div>
        <div
          className="stat-card ok"
          onClick={() => setFilter({ ...filter, slaStatus: filter.slaStatus === 'ok' ? '' : 'ok' })}
          style={{ opacity: filter.slaStatus === 'ok' ? 1 : 0.8 }}
        >
          <span className="stat-value">{stats?.sla_breakdown?.ok || 0}</span>
          <span className="stat-label">OK</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Left: Case Table */}
        <div className="dashboard-main">
          <div className="section-header">
            <h2>Cases ({filteredCases.length})</h2>
            <div className="filters">
              <select
                value={filter.status}
                onChange={e => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">All States</option>
                {uniqueStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
              <select
                value={filter.priority}
                onChange={e => setFilter({ ...filter, priority: e.target.value })}
              >
                <option value="">All Priorities</option>
                {uniquePriorities.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button
                className="btn-clear-filters"
                onClick={() => setFilter({ status: '', priority: '', slaStatus: '' })}
              >
                Clear Filters
              </button>
            </div>
          </div>
          <CaseTable cases={filteredCases} />
        </div>

        {/* Right: Charts & Stats */}
        <div className="dashboard-sidebar">
          <StatsPanel stats={stats} />
        </div>
      </div>
    </div>
  )
}
