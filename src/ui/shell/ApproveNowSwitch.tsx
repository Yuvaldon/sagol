import { useMyPreferences, useUpdateMyPreferences } from '@logic'
import { SwitchField } from '../primitives/SwitchField'
import { useInboxAccess } from './inboxAccess'
import { useReportPreferenceSave } from './preferenceFailure'

/** The approver's own default (D-121), in the inbox's header where approving happens (D-265). */
export function ApproveNowSwitch() {
  const approves = useInboxAccess()
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const reportSave = useReportPreferenceSave()
  if (!approves || preferences.status !== 'ready') return null
  return (
    <SwitchField
      labelKey="account.approveNowDefault"
      name="create_leaves_as_approved"
      value={preferences.value.create_leaves_as_approved}
      onChange={(value) => {
        reportSave(save.run({ create_leaves_as_approved: value }))
      }}
    />
  )
}
