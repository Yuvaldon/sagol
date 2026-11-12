import { RuleEnforcement, type Leave, type RuleViolation } from '@contracts'
import { t } from '@i18n'
import { acknowledgedRuleIds, useLeaveRuleCheck, type LeaveCandidate } from '@logic'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { Button } from '../../primitives/Button'
import { RuleViolations } from './RuleViolations'
import type { RuleGate } from './ruleAnswer'

// The rule acknowledgment dialog and the live warning of a form (D-047, D-142, OI-066). The command is the authority:
// a soft rule it names is acknowledged here and the same command goes again with the ids; a hard rule is shown with
// no way through.

const OVERLAY = 'enter-scrim fixed inset-screen flex items-center justify-center bg-scrim p-lg'
const SURFACE = 'glass-menu flex max-h-full w-full max-w-sheet flex-col rounded-panel p-lg'
const BODY = 'flex min-h-none flex-col gap-md overflow-y-auto outline-none'

/** The dialog of a rule answer. Renders nothing while there is none. */
export function RuleGateDialog({ gate, isPending }: { readonly gate: RuleGate; readonly isPending: boolean }) {
  const { asked } = gate
  if (asked === null) return null
  const soft = asked.error.code === 'rule_acknowledgment_required'
  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => {
        if (!open) gate.close()
      }}
      className={OVERLAY}
    >
      <Modal className={SURFACE}>
        <Dialog role="alertdialog" className={BODY}>
          <Heading slot="title" className="text-body font-bold">
            {t(soft ? 'rules.ackTitle' : 'rules.refusedTitle')}
          </Heading>
          <p className="text-name text-text-muted">{t(soft ? 'rules.ackHint' : 'rules.refusedHint')}</p>
          <RuleViolations violations={asked.error.violations} />
          <div className="flex flex-wrap justify-end gap-sm">
            {soft ? (
              <>
                <Button onPress={gate.close}>{t('common.cancel')}</Button>
                <Button
                  variant="primary"
                  isDisabled={isPending}
                  onPress={() => {
                    gate.close()
                    void asked.retry(acknowledgedRuleIds(asked.error.violations))
                  }}
                >
                  {t('rules.ackConfirm')}
                </Button>
              </>
            ) : (
              <Button variant="primary" onPress={gate.close}>
                {t('common.close')}
              </Button>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}

/**
 * What the change would break, while the form is filled (D-142). Nothing while it breaks nothing; a line while the
 * rules are read, or when they cannot be, since only an answer may say "nothing broken" (OI-099).
 */
export function RuleWarnings({
  candidate,
  stored = null,
}: {
  /** The leave the form would write, or every leave a sheet would (D-275). */
  readonly candidate: LeaveCandidate | readonly LeaveCandidate[] | null
  readonly stored?: Leave | null
}) {
  const check = useLeaveRuleCheck(candidate, stored)
  if (check.status !== 'ready') {
    return (
      <p role="status" className="text-micro text-text-muted">
        {t(check.status === 'loading' ? 'rules.checking' : 'rules.checkFailed')}
      </p>
    )
  }
  const violations: readonly RuleViolation[] = check.value
  if (violations.length === 0) return null
  const hard = violations.some((violation) => violation.enforcement === RuleEnforcement.enum.hard)
  return (
    <section
      role="status"
      aria-label={t(hard ? 'rules.warningHardTitle' : 'rules.warningTitle')}
      className={`flex flex-col gap-sm rounded-control border p-md ${hard ? 'border-status-rejected' : 'border-dashed border-status-pending'}`}
    >
      <p className={`text-name font-semibold ${hard ? 'text-status-rejected' : 'text-status-pending-text'}`}>
        {t(hard ? 'rules.warningHardTitle' : 'rules.warningTitle')}
      </p>
      <RuleViolations violations={violations} />
    </section>
  )
}
