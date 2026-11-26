import { expect, test } from '@playwright/test'
import { dictionary as he } from '../src/i18n/he/dictionary.ts'
import { closeDrawer } from './support/leaves.ts'
import { enterAsOwner, expectNoAxeViolations, managePage, openSetup } from './support/workspace.ts'

// V16's demo: the organization's setup (D-033, D-180). The owner sees every step in order, opens one in its own
// module, and finds it done on the way back. On desktop and mobile, RTL, with axe. Sample data, tests only.

const STEPS = ['unit_levels', 'units', 'command_ranks', 'rank_bindings', 'leave_types', 'tags', 'soldiers', 'deployments'] as const

test('the setup lists the steps, and a step is done once what it sets up exists', async ({ page }) => {
  await enterAsOwner(page)
  await openSetup(page)
  await expect(managePage(page).getByRole('heading', { name: he.setup.title })).toBeVisible()
  const steps = managePage(page).getByRole('list', { name: he.setup.listLabel }).getByRole('listitem')

  await test.step('every step, in order, for the owner', async () => {
    await expect(steps).toHaveCount(STEPS.length)
    for (const [index, id] of STEPS.entries()) {
      await expect(steps.nth(index)).toContainText(he.setup.steps[id].title)
    }
    // The first step not done is marked next; the rest wait their turn.
    await expect(steps.first()).toContainText(he.setup.next)
    await expect(steps.nth(1)).toContainText(he.setup.notDone)
    await expectNoAxeViolations(page)
  })

  await test.step('a step opens its own module, and is done once it has a row', async () => {
    const title = he.setup.steps.unit_levels.title
    await steps.first().getByRole('button', { name: `${he.setup.go} ${title}` }).click()
    await page.getByRole('button', { name: he.unitLevels.new }).click()
    await page.getByLabel(he.unitLevels.name).fill('גדוד')
    await page.getByRole('button', { name: he.common.create }).click()
    await expect(page.getByRole('button', { name: 'גדוד', exact: true })).toBeVisible()
    await closeDrawer(page)
    await openSetup(page)
    await expect(steps.first()).toContainText(he.setup.done)
    await expect(managePage(page).getByRole('status')).toContainText(he.setup.progressDone)
    await expectNoAxeViolations(page)
  })
})
