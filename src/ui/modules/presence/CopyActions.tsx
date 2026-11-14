import { DAY_REPORT } from '@config'
import { t, type I18nKey } from '@i18n'
import { Copy, Download, Share2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../primitives/Button'
import { canShareFiles, downloadFile, reportFile, reportImage, type ImageLine } from './reportImage'

// A text copy and an image to send (D-195, D-196): the day report's pair, shared with the dashboard's heat map (D-362).

const NOTICES = { copied: 'presence.copied', copyFailed: 'presence.copyFailed', imageFailed: 'presence.imageFailed' } as const satisfies Record<string, I18nKey>

/** A notice and its count, so the same notice twice in a row shows its full time again. */
type Notice = { readonly kind: keyof typeof NOTICES; readonly seq: number } | null

export function CopyActions({
  text,
  lines,
  firstDay,
  fileStem,
  title,
  copyKey,
  imageKey,
}: {
  /** The text copy, worked out when pressed. */
  readonly text: () => string
  /** The image's lines, worked out when pressed. */
  readonly lines: () => readonly ImageLine[]
  /** The file's first day, which names it. */
  readonly firstDay: string
  /** The file's name before its day; the day report's when absent. */
  readonly fileStem?: string
  /** The share sheet's title. */
  readonly title: string
  readonly copyKey: I18nKey
  /** The image button's name; NULL names it by what the browser does with the file ("שיתוף" or "הורדה"). */
  readonly imageKey: I18nKey | null
}) {
  const [notice, setNotice] = useState<Notice>(null)
  const notify = useCallback((kind: keyof typeof NOTICES) => {
    setNotice((previous) => ({ kind, seq: (previous?.seq ?? 0) + 1 }))
  }, [])
  const [busy, setBusy] = useState(false)
  const shares = useMemo(() => canShareFiles(), [])
  useEffect(() => {
    if (notice === null) return undefined
    const timer = setTimeout(() => {
      setNotice(null)
    }, DAY_REPORT.noticeMs)
    return () => {
      clearTimeout(timer)
    }
  }, [notice])

  const copy = () => {
    // An insecure page or an old browser has no clipboard at all.
    if (typeof navigator.clipboard?.writeText !== 'function') {
      notify('copyFailed')
      return
    }
    navigator.clipboard.writeText(text()).then(
      () => {
        notify('copied')
      },
      () => {
        notify('copyFailed')
      },
    )
  }
  const sendImage = async () => {
    setBusy(true)
    let file: File | null = null
    try {
      file = reportFile(await reportImage(lines()), firstDay, fileStem)
      if (shares) await navigator.share({ files: [file], title })
      else downloadFile(file)
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      // Closing the share sheet is not a failure; a share the browser refuses falls back to a download.
      if (name === 'AbortError') return
      if (file !== null && shares && (name === 'NotAllowedError' || name === 'TypeError')) downloadFile(file)
      else notify('imageFailed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-sm">
        <Button variant="primary" onPress={copy}>
          <Copy aria-hidden size={14} />
          {t(copyKey)}
        </Button>
        <Button
          isDisabled={busy}
          onPress={() => {
            void sendImage()
          }}
        >
          {shares ? <Share2 aria-hidden size={14} /> : <Download aria-hidden size={14} />}
          {t(imageKey ?? (shares ? 'presence.share' : 'presence.download'))}
        </Button>
      </div>
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-lg top-safe z-10 flex justify-center">
        {notice === null ? null : (
          <div className="glass-card rounded-pill px-lg py-xs text-name font-semibold">{t(NOTICES[notice.kind])}</div>
        )}
      </div>
    </>
  )
}
