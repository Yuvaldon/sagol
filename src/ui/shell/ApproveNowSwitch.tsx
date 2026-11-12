import { useMyLeavesAccess, useMyPreferences, useUpdateMyPreferences } from '@logic'
import { SwitchField } from '../primitives/SwitchField'
import { useInboxAccess } from './inboxAccess'
import { useReportPreferenceSave } from './preferenceFailure'

/**
 * The "approve now" default (D-121), for who may approve their own requests (D-299). It sits in the inbox's header,
 * where approving happens (D-265); `where` 'mine' places it in "my requests" for who has no inbox.
 */
function ApproveNow({ where }: { readonly where: 'inbox' | 'mine' }) {
  const own = useMyLeavesAccess()
  const inbox = useInboxAccess()
  const preferences = useMyPreferences()
  const save = useUpdateMyPreferences()
  const reportSave = useReportPreferenceSave()
  const here = where === 'inbox' || !inbox
  if (own?.approve !== true || !here || preferences.status !== 'ready') return null
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

export function ApproveNowSwitch() {
  return <ApproveNow where="inbox" />
}

export function MyApproveNowSwitch() {
  return <ApproveNow where="mine" />
}
