import { useState, useEffect, useCallback } from 'react'
import {
  getRegistry,
  verifyDataPoint,
  updateDataPoint,
  addCustomDataPoint,
  deleteCustomDataPoint,
  getStaleStatus,
  CATEGORIES,
} from '../utils/dataRegistry'
import { useFlashFeedback } from '../hooks/useFlashFeedback'
import ActionFeedback from './ActionFeedback'

const STATUS_BADGE = {
  verified: { label: 'Verified', cls: 'dm-badge-ok' },
  stale: { label: 'Stale', cls: 'dm-badge-warn' },
  unverified: { label: 'Unverified', cls: 'dm-badge-err' },
}

function resolveRegistryFilter(filterCat, linkedTopicId) {
  if (filterCat === 'every') return null
  if (filterCat !== 'all') return filterCat
  if (linkedTopicId && CATEGORIES[linkedTopicId]) return linkedTopicId
  return null
}

export default function DataManager({ linkedTopicId = null }) {
  const [registry, setRegistry] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editClaim, setEditClaim] = useState('')
  const [editSource, setEditSource] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newId, setNewId] = useState('')
  const [newClaim, setNewClaim] = useState('')
  const [newSource, setNewSource] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newCategory, setNewCategory] = useState('cursor')
  const { msg: actionMsg, flashOk, flashErr } = useFlashFeedback()

  useEffect(() => {
    setRegistry(getRegistry())
  }, [])

  function refresh() {
    setRegistry(getRegistry())
  }

  function handleEdit(id, dp) {
    setEditingId(id)
    setEditClaim(dp.claim)
    setEditSource(dp.source)
    setEditUrl(dp.sourceUrl || '')
  }

  function handleSave(id) {
    updateDataPoint(id, { claim: editClaim, source: editSource, sourceUrl: editUrl })
    verifyDataPoint(id)
    setEditingId(null)
    refresh()
    flashOk('Data point saved and marked verified.')
  }

  function handleVerify(id) {
    verifyDataPoint(id)
    refresh()
    flashOk('Marked as verified.')
  }

  function handleAdd() {
    if (!newId.trim() || !newClaim.trim()) {
      flashErr('Enter an ID and claim text before adding.')
      return
    }
    const safeId = newId.trim().toLowerCase().replace(/\s+/g, '_')
    addCustomDataPoint(safeId, {
      claim: newClaim,
      source: newSource,
      sourceUrl: newUrl,
      category: newCategory,
    })
    setNewId('')
    setNewClaim('')
    setNewSource('')
    setNewUrl('')
    setShowAdd(false)
    refresh()
    flashOk(`Added "${safeId}" to the registry.`)
  }

  function handleDelete(id) {
    deleteCustomDataPoint(id)
    refresh()
    flashOk('Custom data point removed.')
  }

  const entries = Object.entries(registry)
  const registryKey = resolveRegistryFilter(filterCat, linkedTopicId)
  const filtered =
    registryKey == null ? entries : entries.filter(([, dp]) => dp.category === registryKey)

  const stats = {
    total: filtered.length,
    verified: filtered.filter(([, dp]) => getStaleStatus(dp) === 'verified').length,
    stale: filtered.filter(([, dp]) => getStaleStatus(dp) === 'stale').length,
    unverified: filtered.filter(([, dp]) => getStaleStatus(dp) === 'unverified').length,
  }

  return (
    <section className="data-manager fade-in-up">
      <h2 className="section-title">Data Registry</h2>
      <p className="section-subtitle">
        Every data point used in posts is tracked here. Verify accuracy, update stale data, and add new sources.
        Unverified or stale data will be flagged before publishing.
      </p>

      <div className="dm-stats">
        <div className="dm-stat">
          <span className="dm-stat-value">{stats.total}</span>
          <span className="dm-stat-label">Total</span>
        </div>
        <div className="dm-stat dm-stat-ok">
          <span className="dm-stat-value">{stats.verified}</span>
          <span className="dm-stat-label">Verified</span>
        </div>
        <div className="dm-stat dm-stat-warn">
          <span className="dm-stat-value">{stats.stale}</span>
          <span className="dm-stat-label">Stale</span>
        </div>
        <div className="dm-stat dm-stat-err">
          <span className="dm-stat-value">{stats.unverified}</span>
          <span className="dm-stat-label">Unverified</span>
        </div>
      </div>

      <div className="dm-toolbar">
        <div className="dm-filters">
          <button
            className={`dm-filter ${filterCat === 'all' ? 'active' : ''}`}
            onClick={() => setFilterCat('all')}
            type="button"
          >
            {linkedTopicId && CATEGORIES[linkedTopicId] ? 'Match Create topic' : 'All'}
          </button>
          {linkedTopicId && CATEGORIES[linkedTopicId] && (
            <button
              className={`dm-filter ${filterCat === 'every' ? 'active' : ''}`}
              onClick={() => setFilterCat('every')}
              type="button"
            >
              All pillars
            </button>
          )}
          {Object.entries(CATEGORIES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`dm-filter ${filterCat === key ? 'active' : ''}`}
              onClick={() => setFilterCat(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="dm-add-btn" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add Data Point'}
        </button>
      </div>

      {showAdd && (
        <div className="dm-add-form">
          <input placeholder="ID (e.g. cursor_new_metric)" value={newId} onChange={(e) => setNewId(e.target.value)} />
          <input placeholder="Claim text" value={newClaim} onChange={(e) => setNewClaim(e.target.value)} />
          <input placeholder="Source (e.g. Gartner, 2026)" value={newSource} onChange={(e) => setNewSource(e.target.value)} />
          <input placeholder="Source URL (optional)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="dm-save-btn" onClick={handleAdd} disabled={!newId.trim() || !newClaim.trim()}>
            Add to Registry
          </button>
        </div>
      )}

      <ActionFeedback msg={actionMsg} />

      <div className="dm-list">
        {filtered.map(([id, dp]) => {
          const status = getStaleStatus(dp)
          const badge = STATUS_BADGE[status]
          const isEditing = editingId === id
          return (
            <div key={id} className={`dm-item ${badge.cls}`}>
              {isEditing ? (
                <div className="dm-edit-form">
                  <textarea value={editClaim} onChange={(e) => setEditClaim(e.target.value)} rows={2} />
                  <input placeholder="Source" value={editSource} onChange={(e) => setEditSource(e.target.value)} />
                  <input placeholder="Source URL" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                  <div className="dm-edit-actions">
                    <button className="dm-save-btn" onClick={() => handleSave(id)}>Save & Verify</button>
                    <button className="dm-cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="dm-item-content">
                    <div className="dm-item-header">
                      <span className={`dm-status-badge ${badge.cls}`}>{badge.label}</span>
                      <span className="dm-item-cat">{CATEGORIES[dp.category] || dp.category}</span>
                    </div>
                    <p className="dm-item-claim">{dp.claim}</p>
                    <div className="dm-item-meta">
                      <span className="dm-item-source">{dp.source}</span>
                      {dp.verifiedAt && (
                        <span className="dm-item-verified">
                          Verified: {new Date(dp.verifiedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dm-item-actions">
                    <button className="dm-verify-btn" onClick={() => handleVerify(id)} title="Mark as verified now">
                      ✓ Verify
                    </button>
                    <button className="dm-edit-btn" onClick={() => handleEdit(id, dp)} title="Edit this data point">
                      Edit
                    </button>
                    {dp.custom && (
                      <button className="dm-delete-btn" onClick={() => handleDelete(id)} title="Remove custom data point">
                        ✕
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
