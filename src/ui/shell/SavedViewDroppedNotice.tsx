import { t } from '@i18n'
import { useActiveView, useSavedViews } from '@logic'
import { X } from 'lucide-react'
import { AVAILABLE_VIEWS } from '../engines/registry'
import { useViewDevice } from '../patterns/media'
import { Button, IconButton } from '../primitives/Button'
import { useReportPreferenceSave } from './preferenceFailure'
import { useSavedViewNotice } from './savedViewNotice'

/** A saved view opened without a part that no longer reads; "עדכון התצוגה" saves it so (D-385). */
export function SavedViewDroppedNotice() {
  const { dropped, dismiss } = useSavedViewNotice()
  const { view } = useActiveView(AVAILABLE_VIEWS, useViewDevice())
  const saved = useSavedViews(view)
  const reportSave = useReportPreferenceSave()
  if (dropped === null) return null
  return (
    <div className="pointer-events-none fixed inset-x-lg top-safe z-10 flex justify-center">
      <div role="status" className="glass-card pointer-events-auto flex items-center gap-sm rounded-pill py-xs ps-lg pe-xs">
        <span className="text-name font-semibold">{t('workspace.savedViews.dropped')}</span>
        <Button
          variant="primary"
          onPress={() => {
            reportSave(saved.setQuery(dropped.id, dropped.cleaned))
            dismiss()
          }}
        >
          {t('workspace.savedViews.update')}
        </Button>
        <IconButton labelKey="common.close" onPress={dismiss}>
          <X aria-hidden size={16} />
        </IconButton>
      </div>
    </div>
  )
}
