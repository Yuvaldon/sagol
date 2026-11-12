import { t } from '@i18n'

/** The staging deploy's band (D-300): always on top, in the room the safe area keeps for it, so it covers nothing. */
export function StageBand() {
  return (
    <aside
      aria-label={t('app.staging')}
      className="stage-band z-30 flex items-center justify-center bg-stage text-label font-semibold text-on-stage"
    >
      {t('app.staging')}
    </aside>
  )
}
