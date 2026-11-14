import { OrganizationId, PropertyDefinitionId, type PropertyDefinition } from '@contracts'
import { dictionary as he } from '@i18n'
import { LogicProvider, WorkspaceSearch, useOverlayHistory, type LogicPorts } from '@logic'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  defaultStringifySearch,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { RuleBuilder } from './RuleBuilder'

// The builder's conditions (D-312): a typed text or number is written when the field is left, Enter is pressed or the
// builder closes, never per keystroke, and an invalid number is marked and not written; a date is written when it
// changes (D-380). A rule the builder would not write back is a kept "other" row (D-380), and a leave property picked
// on a soldier row moves among the leave conditions (D-382). Fake ports, test data only.

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AT = '2026-11-13T02:08:00.000Z'
const NO_STORE = { read: () => null, write: () => undefined }
const EMPTY = () => Promise.resolve({ ok: true, value: [] })

function definition(n: number, overrides: Partial<PropertyDefinition>): PropertyDefinition {
  return {
    id: PropertyDefinitionId.parse(uuid(n)),
    organization_id: OrganizationId.parse(uuid(900)),
    entity_type: 'soldier',
    label: `P${String(n)}`,
    data_type: 'text',
    options: [],
    is_required: false,
    sort_order: n,
    created_at: AT,
    created_by: null,
    updated_at: AT,
    updated_by: null,
    version: 1,
    archived_at: null,
    ...overrides,
  }
}

const NOTE = definition(1, { label: 'הערה', data_type: 'text' })
const HEIGHT = definition(2, { label: 'גובה', data_type: 'number' })
const BORN = definition(3, { label: 'תאריך לידה', data_type: 'date' })
const REASON = definition(4, { label: 'סיבה', data_type: 'text', entity_type: 'leave' })

function ports(): LogicPorts {
  return {
    data: {
      session: {
        current: () => Promise.resolve({ ok: true, value: { status: 'signed_out' } }),
        subscribe: () => () => undefined,
        can: (checks: readonly unknown[]) => Promise.resolve({ ok: true, value: checks.map(() => true) }),
      },
      repositories: {
        property_definitions: { list: () => Promise.resolve({ ok: true, value: [NOTE, HEIGHT, BORN, REASON] }) },
        tag_categories: { list: EMPTY },
        tags: { list: EMPTY },
        command_ranks: { list: EMPTY },
        soldiers: { list: EMPTY },
        units: { list: EMPTY },
        leave_types: { list: EMPTY },
        leave_type_groups: { list: EMPTY },
      },
      commands: {},
      changes: { subscribe: () => () => undefined },
    },
    auth: {},
    time: { now: () => AT },
    device: { local: NO_STORE, session: NO_STORE },
  } as unknown as LogicPorts
}

function propertyNode(definitionId: string, operator: string, value: unknown) {
  return { kind: 'property', property_definition_id: definitionId, operator, value }
}

/** The builder as the workspace hosts it: it keeps what changed on an overlay's entry once the overlay goes (D-332). */
function Host() {
  useOverlayHistory()
  const [open, setOpen] = useState(true)
  return open ? (
    <RuleBuilder
      target={{ kind: 'all' }}
      onClose={() => {
        setOpen(false)
      }}
    />
  ) : null
}

async function renderBuilder(search: Record<string, unknown>) {
  const rootRoute = createRootRoute()
  const route = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Host, validateSearch: WorkspaceSearch })
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [`/${defaultStringifySearch(search)}`] }),
  })
  render(
    <LogicProvider ports={ports()}>
      <RouterProvider router={router as never} />
    </LogicProvider>,
  )
  await router.load()
  const searchNow = () => router.state.location.search as { filter?: unknown; leaves?: unknown }
  return { router, searchNow }
}

const valuesOf = (field: PropertyDefinition) => `${he.filters.values} ${field.label}`
const valueOf = (element: HTMLElement) => (element as HTMLInputElement).value

describe('the rule builder: typed values (D-380)', () => {
  it('writes a typed text when the field is left, not on each keystroke', async () => {
    const user = userEvent.setup()
    const filter = { where: propertyNode(NOTE.id, 'contains', 'אבג') }
    const { searchNow } = await renderBuilder({ filter })
    const input = await screen.findByRole('textbox', { name: valuesOf(NOTE) })
    expect(valueOf(input)).toBe('אבג')
    await user.clear(input)
    await user.type(input, 'דהו')
    expect(searchNow().filter).toEqual(filter)
    await user.tab()
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: propertyNode(NOTE.id, 'contains', 'דהו') })
    })
  })

  it('writes a typed number when Enter is pressed (D-380)', async () => {
    const user = userEvent.setup()
    const filter = { where: propertyNode(HEIGHT.id, 'greater_than', 170) }
    const { searchNow } = await renderBuilder({ filter })
    const input = await screen.findByRole('textbox', { name: valuesOf(HEIGHT) })
    await user.clear(input)
    await user.type(input, '180')
    expect(searchNow().filter).toEqual(filter)
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: propertyNode(HEIGHT.id, 'greater_than', 180) })
    })
  })

  it('writes the typed text when the builder closes without the field being left (D-380)', async () => {
    const user = userEvent.setup()
    const { searchNow } = await renderBuilder({ filter: { where: propertyNode(NOTE.id, 'contains', 'אבג') } })
    const input = await screen.findByRole('textbox', { name: valuesOf(NOTE) })
    await user.clear(input)
    await user.type(input, 'זחט')
    expect(searchNow().filter).toEqual({ where: propertyNode(NOTE.id, 'contains', 'אבג') })
    // Escape in the typed field closes the builder with no blur.
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: valuesOf(NOTE) })).toBeNull()
    })
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: propertyNode(NOTE.id, 'contains', 'זחט') })
    })
  })

  it('marks a number that is not a plain decimal invalid and does not write it (D-380)', async () => {
    const user = userEvent.setup()
    const filter = { where: propertyNode(HEIGHT.id, 'greater_than', 170) }
    const { searchNow } = await renderBuilder({ filter })
    const input = await screen.findByRole('textbox', { name: valuesOf(HEIGHT) })
    expect(input.getAttribute('aria-invalid')).toBeNull()
    for (const typed of ['1,5', 'abc']) {
      await user.clear(input)
      await user.type(input, typed)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(input.parentElement?.getAttribute('data-invalid')).toBe('true')
      await user.keyboard('{Enter}')
      // Left with a value that is not a number, the row holds no condition: the URL keeps no number, and the row keeps
      // the typed text, still marked, to correct.
      await waitFor(() => {
        expect(searchNow().filter).toBeUndefined()
      })
      expect(valueOf(input)).toBe(typed)
      expect(input.getAttribute('aria-invalid')).toBe('true')
    }
    await user.clear(input)
    await user.type(input, '-2.5{Enter}')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: propertyNode(HEIGHT.id, 'greater_than', -2.5) })
    })
  })

  it('writes a date as soon as it changes (D-380)', async () => {
    const user = userEvent.setup()
    const { searchNow } = await renderBuilder({ filter: { where: propertyNode(BORN.id, 'equals', '2000-01-01') } })
    const year = await waitFor(() => {
      const found = screen.getAllByRole('spinbutton').find((segment) => segment.getAttribute('aria-valuenow') === '2000')
      if (found === undefined) throw new Error('no year segment yet')
      return found
    })
    await user.click(year)
    await user.keyboard('{ArrowUp}')
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: propertyNode(BORN.id, 'equals', '2001-01-01') })
    })
  })
})

describe('the rule builder: rules it does not read back (D-380)', () => {
  it('keeps a rule it would not write back unchanged as an "other" row, which only removes', async () => {
    const user = userEvent.setup()
    // A hand-written link's `equals true` on a text property: read as a yes / no rule, never written back as one.
    const kept = propertyNode(NOTE.id, 'equals', true)
    const { searchNow } = await renderBuilder({ filter: { where: { kind: 'and', nodes: [kept, propertyNode(HEIGHT.id, 'greater_than', 170)] } } })
    const other = await screen.findByText(he.filters.other)
    const row = other.closest('div')?.parentElement
    if (row === null || row === undefined) throw new Error('no row around the other rule')
    // No field to pick and no value to type: the row can only be removed.
    expect(within(row).queryByRole('button', { name: he.filters.field })).toBeNull()
    expect(within(row).queryByRole('textbox')).toBeNull()
    expect(within(row).queryByRole('button', { name: he.filters.remove })).not.toBeNull()

    // Editing another row writes the kept rule back as it was.
    const height = screen.getByRole('textbox', { name: valuesOf(HEIGHT) })
    await user.clear(height)
    await user.type(height, '175{Enter}')
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: { kind: 'and', nodes: [kept, propertyNode(HEIGHT.id, 'greater_than', 175)] } })
    })

    await user.click(within(row).getByRole('button', { name: he.filters.remove }))
    await waitFor(() => {
      expect(searchNow().filter).toEqual({ where: propertyNode(HEIGHT.id, 'greater_than', 175) })
    })
    expect(screen.queryByText(he.filters.other)).toBeNull()
  })
})

describe('the rule builder: leave property conditions (D-382)', () => {
  it('moves a soldier row to the leave conditions when a leave property is chosen for it', async () => {
    const user = userEvent.setup()
    const { searchNow } = await renderBuilder({ filter: { where: { kind: 'soldier_status', statuses: ['active'] } } })
    await user.click(await screen.findByRole('button', { name: new RegExp(he.filters.field, 'u') }))
    await user.click(await screen.findByRole('option', { name: REASON.label }))
    // The soldier rule is gone from the filter; the leave row has no value yet, so it writes nothing.
    await waitFor(() => {
      expect(searchNow().filter).toBeUndefined()
    })
    expect(searchNow().leaves).toBeUndefined()
    const input = await screen.findByRole('textbox', { name: valuesOf(REASON) })
    await user.type(input, 'חתונה{Enter}')
    await waitFor(() => {
      expect(searchNow().leaves).toEqual({ properties: [propertyNode(REASON.id, 'contains', 'חתונה')] })
    })
    expect(searchNow().filter).toBeUndefined()
  })
})
