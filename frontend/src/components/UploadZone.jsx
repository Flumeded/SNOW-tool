import React, { useState, useRef } from 'react'

export default function UploadZone({ onUpload, status }) {
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        onUpload(file)
      } else {
        alert('Please upload a CSV file')
      }
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      onUpload(file)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      className={`upload-zone ${dragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept=".csv,text/csv"
        onChange={handleFileSelect}
      />

      {status ? (
        <div className={`upload-status ${status.type}`}>
          {status.type === 'uploading' && <span>Uploading...</span>}
          {status.type === 'success' && <span style={{ color: 'var(--success)' }}>{status.message}</span>}
          {status.type === 'error' && <span style={{ color: 'var(--danger)' }}>{status.message}</span>}
        </div>
      ) : (
        <>
          <h3>Drop CSV file here or click to upload</h3>
          <p>Export your ServiceNow case list as CSV and upload it here</p>
        </>
      )}
    </div>
  )
}
