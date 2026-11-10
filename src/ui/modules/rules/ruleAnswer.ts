import type { AppError, AvailabilityRuleId, Result } from '@contracts'
import { useState } from 'react'

// The state of a command's rule answer (D-047, D-142). The dialog of `RuleGate.tsx` shows it.

type RuleError = Extract<AppError, { code: 'rule_violation' | 'rule_acknowledgment_required' }>

export function isRuleError(error: AppError): error is RuleError {
  return error.code === 'rule_violation' || error.code === 'rule_acknowledgment_required'
}

type Retry = (acknowledged: readonly AvailabilityRuleId[]) => Promise<void>

export interface RuleGate {
  /** The rule answer on screen, if any. */
  readonly asked: { readonly error: RuleError; readonly retry: Retry } | null
  /**
   * Sends a command and handles a rule answer: it opens the dialog, and acknowledging sends the command again with the
   * soft rules' ids. Any other answer goes to `onAnswer`.
   */
  run<T>(send: (acknowledged: readonly AvailabilityRuleId[]) => Promise<Result<T>>, onAnswer: (result: Result<T>) => void): Promise<void>
  close(): void
}

export function useRuleGate(): RuleGate {
  const [asked, setAsked] = useState<RuleGate['asked']>(null)
  async function run<T>(send: (acknowledged: readonly AvailabilityRuleId[]) => Promise<Result<T>>, onAnswer: (result: Result<T>) => void) {
    const attempt: Retry = async (acknowledged) => {
      const result = await send(acknowledged)
      if (!result.ok && isRuleError(result.error)) setAsked({ error: result.error, retry: attempt })
      else onAnswer(result)
    }
    await attempt([])
  }
  return {
    asked,
    run,
    close: () => {
      setAsked(null)
    },
  }
}
