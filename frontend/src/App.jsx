import React, { useState, useEffect, useCallback } from 'react'
import Dashboard from './components/Dashboard'
import UploadZone from './components/UploadZone'
import SettingsModal from './components/SettingsModal'
import { fetchOverviewStats, fetchCases, uploadCSV, resetDatabase } from './services/api'

export default function App() {
  const [stats, setStats] = useState(null)
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [statsData, casesData] = await Promise.all([
        fetchOverviewStats(),
        fetchCases()
      ])
      setStats(statsData)
      setCases(casesData.cases)
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Failed to load data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFileUpload = async (file) => {
    try {
      setUploadStatus({ type: 'uploading', message: 'Uploading CSV...' })
      const result = await uploadCSV(file)
      setUploadStatus({
        type: 'success',
        message: `Uploaded ${result.case_count} cases (${result.new_cases} new, ${result.updated_cases} updated)`
      })
      // Reload data after upload
      await loadData()
      // Clear status after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000)
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to delete ALL data? This cannot be undone.')) {
      return
    }
    try {
      setLoading(true)
      const result = await resetDatabase()
      setUploadStatus({
        type: 'success',
        message: `Database reset. Deleted: ${result.deleted.cases} cases, ${result.deleted.history} history records`
      })
      // Reload data after reset
      await loadData()
      setTimeout(() => setUploadStatus(null), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  return (
    <div className="app">
      <header className="app-header">
        <h1>ServiceNow Case Tracker</h1>
        <div className="header-actions">
          {lastRefresh && (
            <span className="last-refresh">
              Last refresh: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button onClick={loadData} className="btn-secondary" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={() => setShowSettings(true)} className="btn-secondary">
            Settings
          </button>
          <button onClick={handleReset} className="btn-danger" disabled={loading}>
            Reset DB
          </button>
        </div>
      </header>

      <main>
        {/* Upload Zone */}
        <UploadZone onUpload={handleFileUpload} status={uploadStatus} />

        {/* Error Display */}
        {error && (
          <div className="alert-banner critical" style={{ marginTop: '1rem' }}>
            <span className="alert-icon">!</span>
            <span>Error: {error}</span>
          </div>
        )}

        {/* Dashboard */}
        {loading && !stats ? (
          <div className="loading">Loading...</div>
        ) : stats ? (
          <Dashboard stats={stats} cases={cases} onRefresh={loadData} />
        ) : (
          <div className="loading">
            Upload a CSV file from ServiceNow to get started
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
