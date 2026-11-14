import type { PermissionCheck, Result, Timestamp } from '@contracts'
import type { ReactNode } from 'react'
import type { LogicPorts } from '../ports'
import { LogicProvider } from '../runtime/LogicProvider'

// Fake ports for the logic tests (D-135, OI-086). A test names only what it reads; everything else is absent, so a
// read the test did not expect fails loudly. Test files only.

export const TEST_NOW: Timestamp = '2026-11-08T10:00:00.000Z'

/** Every hint answers "yes". */
export function allowEverything(checks: readonly PermissionCheck[]): Promise<Result<boolean[]>> {
  return Promise.resolve({ ok: true, value: checks.map(() => true) })
}

/** An organization in a time zone, which is all `useToday` reads. */
export function organizationIn(timezone = 'Asia/Jerusalem') {
  return { current: () => Promise.resolve({ ok: true, value: { timezone } }) }
}

export interface FakePortParts {
  /** Merged over a session that subscribes to nothing. */
  readonly session?: object
  readonly repositories?: object
  readonly commands?: object
  readonly transfer?: object
  /** Merged over a change feed that subscribes to nothing. */
  readonly changes?: object
  readonly auth?: object
  readonly now?: () => Timestamp
  /** Merged over a shell with nothing to offer. */
  readonly shell?: object
  /** Merged over a browser without `PushManager`. */
  readonly push?: object
  /** The device stores; each defaults to an empty one in memory. */
  readonly device?: object
}

/** A device store in memory, empty at first (D-197). */
export function memoryDeviceStore() {
  const values = new Map<string, string>()
  return {
    read: (key: string, scope: string) => values.get(`${key}.${scope}`) ?? null,
    write: (key: string, scope: string, value: string | null) => {
      if (value === null) values.delete(`${key}.${scope}`)
      else values.set(`${key}.${scope}`, value)
    },
  }
}

const NO_SUBSCRIPTION = { subscribe: () => () => undefined }
const QUIET_SHELL_STATE = { updateReady: false, install: 'none' } as const

export function fakePorts(parts: FakePortParts = {}): LogicPorts {
  const now = parts.now ?? (() => TEST_NOW)
  return {
    data: {
      session: { ...NO_SUBSCRIPTION, ...parts.session },
      repositories: { ...parts.repositories },
      commands: { ...parts.commands },
      transfer: { ...parts.transfer },
      changes: { ...NO_SUBSCRIPTION, ...parts.changes },
    },
    auth: { ...parts.auth },
    time: { now },
    shell: { ...NO_SUBSCRIPTION, current: () => QUIET_SHELL_STATE, ...parts.shell },
    push: {
      ...NO_SUBSCRIPTION,
      current: () => 'unsupported',
      disable: () => Promise.resolve(null),
      installed: () => Promise.resolve(null),
      ...parts.push,
    },
    device: { local: memoryDeviceStore(), session: memoryDeviceStore(), ...parts.device },
  } as unknown as LogicPorts
}

/** The provider every hook test renders under. */
export function wrapperOf(ports: LogicPorts) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <LogicProvider ports={ports}>{children}</LogicProvider>
  }
}
