import { EXPORT_FORMAT_VERSION, SoldierId, type OrganizationExport } from '@contracts'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fakePorts, wrapperOf } from '../testing/ports'
import { exportFileOf, readImportFile } from './file'
import { useExport, useImport } from './hooks'

// Sample rows, test data only.
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const newId = () => SoldierId.parse(uuid(1))

describe('readImportFile', () => {
  it('turns CSV rows into create_soldier operations', () => {
    const file = readImportFile('team.CSV', 'first_name,last_name\nיעל,סלע\n', newId)
    expect(file.status).toBe('ready')
    if (file.status !== 'ready') return
    expect(file.operations).toHaveLength(1)
    expect(file.operations[0]?.command).toBe('create_soldier')
  })

  it('reports a CSV problem as unusable', () => {
    expect(readImportFile('team.csv', 'first_name,rank\nיעל,סמל\n', newId)).toEqual({
      status: 'unusable',
      problem: { kind: 'unknown_column', column: 'rank' },
    })
  })

  it('reports a CSV row whose name is missing on its form', () => {
    const file = readImportFile('team.csv', 'first_name,last_name\nיעל,\n', newId)
    expect(file.status).toBe('malformed')
  })

  it('reads JSON operations, and refuses text that is not JSON or has no operations', () => {
    expect(readImportFile('a.json', '{', newId)).toEqual({ status: 'unusable', problem: { kind: 'not_json' } })
    expect(readImportFile('a.json', '{"operations":[]}', newId)).toEqual({ status: 'unusable', problem: { kind: 'no_operations' } })
    const file = readImportFile('a.json', '{"operations":[{"command":"nope","input":{}}]}', newId)
    expect(file.status).toBe('malformed')
    if (file.status !== 'malformed') return
    expect(file.report.committed).toBe(false)
    expect(file.report.results[0]?.error?.code).toBe('validation_failed')
  })
})

describe('exportFileOf', () => {
  it('names the file by the day it was taken', () => {
    const exported = { format_version: EXPORT_FORMAT_VERSION, exported_at: '2026-11-11T08:00:00.000Z', tables: { organizations: [] } }
    const file = exportFileOf(exported as unknown as OrganizationExport)
    expect(file.name).toBe('sagol-export-2026-11-11.json')
    expect(file.blob.type).toBe('application/json')
  })

  it("takes the day on the organization's clock", () => {
    const exported = {
      format_version: EXPORT_FORMAT_VERSION,
      exported_at: '2026-11-11T23:30:00.000Z',
      tables: { organizations: [{ timezone: 'Asia/Jerusalem' }] },
    }
    expect(exportFileOf(exported as unknown as OrganizationExport).name).toBe('sagol-export-2026-11-12.json')
  })
})

describe('transfer hooks', () => {
  it('previews with a dry run and commits with a real one, through the port', async () => {
    const importBatch = vi.fn(() => Promise.resolve({ ok: true, value: { committed: false, results: [] } }))
    const ports = fakePorts({ transfer: { importBatch } })
    const { result } = renderHook(() => useImport(), { wrapper: wrapperOf(ports) })
    await act(async () => {
      await result.current.preview([])
      await result.current.commit([])
    })
    expect(importBatch).toHaveBeenNthCalledWith(1, { dry_run: true, operations: [] })
    expect(importBatch).toHaveBeenNthCalledWith(2, { dry_run: false, operations: [] })
  })

  it('passes an export refusal through', async () => {
    const refusal = { ok: false, error: { code: 'forbidden' } }
    const ports = fakePorts({ transfer: { exportOrganization: () => Promise.resolve(refusal) } })
    const { result } = renderHook(() => useExport(), { wrapper: wrapperOf(ports) })
    let answer: unknown
    await act(async () => {
      answer = await result.current.run()
    })
    expect(answer).toEqual(refusal)
  })
})
