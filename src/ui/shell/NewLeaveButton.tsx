import { NEW_ENTITY, PANEL_IDS } from '@config'
import { t } from '@i18n'
import { useLeaveCreation, usePanel, useSoldiers } from '@logic'
import { Plus } from 'lucide-react'
import { Button as AriaButton } from 'react-aria-components'

// The floating "+" of Stone 3 (D-115): the bottom inline-end corner of the board, above the bottom bar on a phone.
// It shows for who may create a leave for a soldier they see (D-076).

const NO_SOLDIERS: readonly never[] = []

export function NewLeaveButton() {
  const panel = usePanel()
  const soldiers = useSoldiers()
  const creation = useLeaveCreation(soldiers.status === 'ready' ? soldiers.value : NO_SOLDIERS)
  if (!creation.any) return null
  return (
    <AriaButton
      aria-label={t('leaves.new')}
      onPress={() => {
        panel.open(PANEL_IDS.leaves, { entity: NEW_ENTITY })
      }}
      className="glass-action absolute end-xl bottom-above-bottom-bar flex size-touch cursor-pointer items-center justify-center rounded-pill outline-focus outline-offset-2 md:bottom-xl data-focus-visible:outline-2"
    >
      <Plus aria-hidden size={18} strokeWidth={2.4} />
    </AriaButton>
  )
}
