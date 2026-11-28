import { useMyLeavesAccess, useMyPreferences, useUpdateMyPreferences } from '@logic'
import { SwitchField } from '../primitives/SwitchField'
import { useReportPreferenceSave } from './preferenceFailure'

/**
 * The "approve now" default (D-121), for who may approve their own requests (D-299). It sits on the page of requests,
 * where approving happens (D-467), and under "עבודה" of "העדפות" (D-488), where every preference of the account is.
 */
export function ApproveNowSwitch() {
  const own = useMyLeavesAccess()
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const reportSave = useReportPreferenceSave()
  if (own?.approve !== true || preferences.status !== 'ready') return null
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
