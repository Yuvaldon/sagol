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
}

const NO_SUBSCRIPTION = { subscribe: () => () => undefined }

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
  } as unknown as LogicPorts
}

/** The provider every hook test renders under. */
export function wrapperOf(ports: LogicPorts) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <LogicProvider ports={ports}>{children}</LogicProvider>
  }
}
