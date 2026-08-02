'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Plus, Trash2, BoxArrowRight, Gear, Check2Circle, XCircle, Hourglass } from 'react-bootstrap-icons'

interface DemoApp {
  url: string
  secret: string
}

interface TestResult {
  url: string
  status: 'success' | 'error'
  statusCode?: number
  message?: string
}

export default function DemoConfigPage() {
  const router = useRouter()
  const [targets, setTargets] = useState<DemoApp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [showTestResults, setShowTestResults] = useState(false)

  // Form state for adding new app
  const [newUrl, setNewUrl] = useState('')
  const [newSecret, setNewSecret] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/demo-config')
      if (res.ok) {
        const data = await res.json()
        setTargets(data.targets || [])
      } else if (res.status === 401) {
        router.push('/admin/login')
      }
    } catch {
      setError('Failed to load configuration')
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    Promise.resolve().then(load)
  }, [load])

  const addApp = () => {
    if (!newUrl.trim() || !newSecret.trim()) {
      setError('App URL and Secret are required')
      return
    }

    // Basic URL validation
    try {
      new URL(newUrl)
    } catch {
      setError('Invalid URL format')
      return
    }

    setTargets([...targets, { url: newUrl.trim(), secret: newSecret.trim() }])
    setNewUrl('')
    setNewSecret('')
    setError('')
  }

  const removeApp = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index))
  }

  const saveConfig = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/demo-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      })

      if (res.ok) {
        setSuccess('Configuration saved successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else if (res.status === 401) {
        router.push('/admin/login')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save configuration')
      }
    } catch {
      setError('Error saving configuration')
    }
    setSaving(false)
  }

  const testApps = async () => {
    if (targets.length === 0) {
      setError('No apps configured')
      return
    }

    setTesting(true)
    setError('')
    setTestResults([])
    setShowTestResults(true)

    try {
      const res = await fetch('/api/admin/demo-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const data = await res.json()
        setTestResults(data.results || [])
      } else if (res.status === 401) {
        router.push('/admin/login')
      } else {
        setError('Failed to test apps')
      }
    } catch {
      setError('Error testing apps')
    }
    setTesting(false)
  }

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <span className="font-bold">ZPos Admin</span>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
            <BoxArrowRight size={15} /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Gear size={20} className="text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Demo Config</h1>
          </div>
          <p className="text-gray-600 text-sm">Manage demo reset targets and test endpoints</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Current Apps Table */}
            {targets.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="font-semibold text-gray-900">Configured Apps ({targets.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">App URL</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-700">Secret</th>
                        <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                        <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((app, idx) => {
                        const result = testResults.find(r => r.url === app.url)
                        return (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-6 py-4 text-gray-900 font-mono text-xs break-all">{app.url}</td>
                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">
                              {app.secret.substring(0, 10)}...
                            </td>
                            <td className="px-6 py-4 text-center">
                              {result ? (
                                result.status === 'success' ? (
                                  <div className="flex items-center justify-center gap-1 text-green-600">
                                    <Check2Circle size={16} />
                                    <span className="text-xs">OK</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1 text-red-600">
                                    <XCircle size={16} />
                                    <span className="text-xs">Error</span>
                                  </div>
                                )
                              ) : (
                                <div className="flex items-center justify-center gap-1 text-gray-400">
                                  <Hourglass size={16} />
                                  <span className="text-xs">—</span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => removeApp(idx)}
                                className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add New App Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">Add New App</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App URL</label>
                  <input
                    type="url"
                    placeholder="https://app.example.com"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Demo Reset Secret</label>
                  <input
                    type="password"
                    placeholder="Enter secret key"
                    value={newSecret}
                    onChange={e => setNewSecret(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>
                <button
                  onClick={addApp}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Add App
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={saveConfig}
                disabled={saving || targets.length === 0}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                onClick={testApps}
                disabled={testing || targets.length === 0}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing...' : 'Test All Apps'}
              </button>
            </div>

            {/* Test Results */}
            {showTestResults && testResults.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Test Results</h2>
                <div className="space-y-3">
                  {testResults.map((result, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                      <div>
                        {result.status === 'success' ? (
                          <Check2Circle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-mono text-sm text-gray-900">{result.url}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {result.message}
                          {result.statusCode && ` (${result.statusCode})`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {targets.length === 0 && testResults.length === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Gear size={32} className="text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No apps configured yet. Add your first demo app to get started.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
