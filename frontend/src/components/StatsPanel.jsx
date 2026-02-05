import React, { useState, useEffect } from 'react'
import { fetchDailyStats, fetchWeeklyTrend } from '../services/api'

export default function StatsPanel({ stats }) {
  const [dailyStats, setDailyStats] = useState(null)
  const [trend, setTrend] = useState([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [daily, weekly] = await Promise.all([
          fetchDailyStats(),
          fetchWeeklyTrend()
        ])
        setDailyStats(daily)
        setTrend(weekly)
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    }
    loadStats()
  }, [])

  // Calculate max for scaling bars
  const maxValue = Math.max(
    ...trend.flatMap(d => [d.incoming || 0, d.handled || 0, d.new_cases || 0]),
    1
  )

  return (
    <div className="stats-panel">
      <h3>Today's Activity</h3>

      {dailyStats && (
        <div className="daily-stats">
          <div className="daily-stat">
            <span className="stat-icon">+</span>
            <span className="stat-value">{dailyStats.new_cases || 0}</span>
            <span className="stat-label">Locked</span>
          </div>
          <div className="daily-stat incoming">
            <span className="stat-icon">↓</span>
            <span className="stat-value">{dailyStats.incoming || 0}</span>
            <span className="stat-label">Incoming</span>
          </div>
          <div className="daily-stat handled">
            <span className="stat-icon">↑</span>
            <span className="stat-value">{dailyStats.handled || 0}</span>
            <span className="stat-label">Handled</span>
          </div>
        </div>
      )}

      <h4>7-Day Trend</h4>
      <div className="trend-chart">
        {trend.map((day, i) => {
          const incomingHeight = Math.max((day.incoming / maxValue) * 50, 2)
          const handledHeight = Math.max((day.handled / maxValue) * 50, 2)
          const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })

          return (
            <div key={day.date} className="trend-bar-group">
              <div className="trend-bars">
                <div
                  className="trend-bar incoming"
                  style={{ height: `${incomingHeight}px` }}
                  title={`Incoming: ${day.incoming || 0}`}
                />
                <div
                  className="trend-bar handled"
                  style={{ height: `${handledHeight}px` }}
                  title={`Handled: ${day.handled || 0}`}
                />
              </div>
              <span className="trend-label">{dayName}</span>
            </div>
          )
        })}
      </div>

      <div className="trend-legend">
        <span className="legend-item">
          <span className="legend-color incoming"></span> Incoming
        </span>
        <span className="legend-item">
          <span className="legend-color handled"></span> Handled
        </span>
      </div>

      {/* Needs Action */}
      {stats?.needs_action > 0 && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: 'rgba(233, 69, 96, 0.2)',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.needs_action}</span>
          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            cases need your action
          </span>
        </div>
      )}

      {/* Priority Breakdown */}
      {stats?.priority_breakdown && Object.keys(stats.priority_breakdown).length > 0 && (
        <>
          <h4>By Priority</h4>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {Object.entries(stats.priority_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([priority, count]) => (
                <div key={priority} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                  <span>{priority}</span>
                  <span>{count}</span>
                </div>
              ))
            }
          </div>
        </>
      )}

      {/* State Breakdown */}
      {stats?.state_breakdown && Object.keys(stats.state_breakdown).length > 0 && (
        <>
          <h4>By State</h4>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {Object.entries(stats.state_breakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([state, count]) => (
                <div key={state} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                  <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {state}
                  </span>
                  <span>{count}</span>
                </div>
              ))
            }
          </div>
        </>
      )}
    </div>
  )
}
