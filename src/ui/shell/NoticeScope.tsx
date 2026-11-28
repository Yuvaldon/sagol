import { t } from '@i18n'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { failureKey } from '../errors/messages'
import { Toast, ToastRegion } from '../kit/Toast'
import { NoticeContext, type NoticeAction, type Notices } from './notices'

// The one toast region of the workspace (D-482): what `useNotices` says shows here, above the tab bar.

const SEPARATOR = ' · '
const CLOSE: NoticeAction = { labelKey: 'common.close', run: () => undefined }

interface Shown {
  readonly id: number
  readonly message: string
  readonly action: NoticeAction | null
  readonly held: boolean
}

export function NoticeScope({ children }: { readonly children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null)
  const clear = useCallback(() => {
    setShown(null)
  }, [])
  // Each toast is a new one, so its time starts over even when its words repeat.
  const count = useRef(0)
  const notices = useMemo<Notices>(
    () => ({
      say: (message, action) => {
        count.current += 1
        setShown({ id: count.current, message, action: action ?? null, held: false })
      },
      fail: (error, key) => {
        count.current += 1
        setShown({ id: count.current, message: t(key ?? failureKey(error)), action: CLOSE, held: true })
      },
      report: (done, refusal) => {
        count.current += 1
        setShown(
          refusal === null
            ? { id: count.current, message: done, action: null, held: false }
            : { id: count.current, message: [done, t(failureKey(refusal))].join(SEPARATOR), action: CLOSE, held: true },
        )
      },
    }),
    [],
  )
  const { action } = shown ?? { action: null }
  return (
    <NoticeContext value={notices}>
      <ToastRegion>
        {shown === null ? null : (
          <Toast
            key={shown.id}
            message={shown.message}
            {...(action === null
              ? {}
              : {
                  actionKey: action.labelKey,
                  onAction: () => {
                    clear()
                    action.run()
                  },
                })}
            held={shown.held}
            onDone={clear}
          />
        )}
      </ToastRegion>
      {children}
    </NoticeContext>
  )
}
