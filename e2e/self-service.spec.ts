import { expect, test, type Page } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { TYPE, YAEL, enterAsYael, setUpFighter, signOut } from './support/fighter.ts'
import { choose, closeDrawer, drawer, typeDate } from './support/leaves.ts'
import { OWNER, expectNoAxeViolations, openModule, signIn } from './support/workspace.ts'

// V11's demo: a fighter links on their own, asks for a leave from "my requests", comments on it, the owner approves
// it in the inbox, and the fighter sees it approved (D-167). On desktop and mobile, RTL, with axe. Sample data, tests
// only.

function openList(page: Page) {
  return drawer(page).getByRole('list', { name: he.myLeaves.openTitle })
}

test('a fighter asks for a leave from "my requests", and sees it approved', async ({ page }) => {
  await setUpFighter(page)
  await signOut(page)
  await enterAsYael(page)

  await test.step('"my requests" sits in the bar and starts empty', async () => {
    await openModule(page, he.myLeaves.open)
    await expect(drawer(page).getByText(he.myLeaves.emptyTitle)).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('the new request names Yael already, and waits for approval', async () => {
    await closeDrawer(page)
    await page.getByRole('button', { name: he.leaves.new }).click()
    await expect(drawer(page).getByRole('heading', { name: he.leaves.newTitle })).toBeVisible()
    await expect(drawer(page).getByRole('combobox', { name: he.leaves.soldier })).toHaveValue(`${YAEL.first} ${YAEL.last}`)
    await choose(page, he.leaves.type, TYPE)
    await typeDate(page, he.leaves.from, '15', '11', '2026')
    await typeDate(page, he.leaves.to, '16', '11', '2026')
    await drawer(page).getByRole('button', { name: he.leaves.submit, exact: true }).click()
    await expect(drawer(page)).toBeHidden()
    await openModule(page, he.myLeaves.open)
    const row = openList(page).getByRole('button', { name: new RegExp(TYPE) })
    await expect(row.getByText(he.leaves.statusPending, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })

  await test.step('a row opens the details, where Yael comments', async () => {
    await openList(page).getByRole('button', { name: new RegExp(TYPE) }).click()
    await expect(page).toHaveURL(/panel=leaves&entity=[0-9a-f-]{36}/)
    await drawer(page).getByRole('textbox', { name: he.leaves.commentLabel }).fill('חתונה של אח')
    await drawer(page).getByRole('button', { name: he.leaves.commentAdd }).click()
    await expect(drawer(page).getByRole('list', { name: he.leaves.threadTitle })).toContainText('חתונה של אח')
    await closeDrawer(page)
  })

  await test.step('the owner approves it in the inbox', async () => {
    await signOut(page)
    await signIn(page, OWNER.email)
    await openModule(page, new RegExp(`^${he.inbox.open}( \\d+ ${he.inbox.pendingCount})?$`))
    const list = drawer(page).getByRole('list', { name: he.inbox.pendingLabel })
    await expect(list.getByText(`${YAEL.first} ${YAEL.last}`)).toBeVisible()
    await list.getByRole('button', { name: he.leaves.approve }).click()
    await expect(drawer(page).getByText(he.inbox.emptyPendingTitle)).toBeVisible()
    await closeDrawer(page)
  })

  await test.step('Yael sees it approved', async () => {
    await signOut(page)
    await signIn(page, YAEL.email)
    await openModule(page, he.myLeaves.open)
    const row = openList(page).getByRole('button', { name: new RegExp(TYPE) })
    await expect(row.getByText(he.leaves.statusApproved, { exact: true })).toBeVisible()
    await expectNoAxeViolations(page)
  })
})
