import React, { useState, useEffect } from 'react'
import { fetchSettings, updateSettings } from '../services/api'

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState({
    sla_critical_threshold: 30,
    sla_warning_threshold: 120,
    notification_cooldown: 300,
    enable_notifications: true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchSettings()
        setSettings(data)
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      await updateSettings(settings)
      setMessage({ type: 'success', text: 'Settings saved!' })
      setTimeout(() => onClose(), 1000)
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="form-group">
          <label>Critical SLA Threshold (minutes)</label>
          <input
            type="number"
            value={settings.sla_critical_threshold}
            onChange={e => handleChange('sla_critical_threshold', parseInt(e.target.value) || 0)}
            min="1"
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Cases with less time remaining will show as critical (red)
          </small>
        </div>

        <div className="form-group">
          <label>Warning SLA Threshold (minutes)</label>
          <input
            type="number"
            value={settings.sla_warning_threshold}
            onChange={e => handleChange('sla_warning_threshold', parseInt(e.target.value) || 0)}
            min="1"
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Cases with less time remaining will show as warning (yellow)
          </small>
        </div>

        <div className="form-group">
          <label>Notification Cooldown (seconds)</label>
          <input
            type="number"
            value={settings.notification_cooldown}
            onChange={e => handleChange('notification_cooldown', parseInt(e.target.value) || 0)}
            min="60"
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Time between repeated notifications for the same case
          </small>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.enable_notifications}
              onChange={e => handleChange('enable_notifications', e.target.checked)}
              style={{ width: 'auto' }}
            />
            Enable desktop notifications
          </label>
        </div>

        {message && (
          <div style={{
            padding: '0.5rem',
            borderRadius: '4px',
            background: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
            marginBottom: '1rem'
          }}>
            {message.text}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
