import { UNIT_TEMPLATE_IDS, UNIT_TEMPLATES, type UnitTemplateId } from '@config'
import { t } from '@i18n'
import {
  initialChoices,
  templateChoiceIssues,
  useApplyTemplate,
  usePanel,
  withSectionCount,
  type TemplateBase,
  type TemplateChoices,
  type TemplateOutcome,
} from '@logic'
import { useState } from 'react'
import { issueError } from '../../patterns/forms'
import { CheckList, RadioList, type Choice } from '../../primitives/ChoiceList'
import { Button } from '../../primitives/Button'
import { TextField } from '../../primitives/fields'
import { SelectField, type SelectOption } from '../../primitives/SelectField'
import { keptNames, sectionNameOf, STAGE_KEYS, TEMPLATE_KEYS, templateNames } from './templateNames'

// The setup from a template (D-262): pick one, adjust what it offers, done. Done runs the template as the ordinary
// commands and lands on the board, in routine; a refused step stops it there, says which part, and leaves the checklist
// to finish the rest. Nothing of the choice is stored: the wizard is offered while the unit is fresh.

/** Between the words of a line built from several strings. */
const WORD = ' '

const isTemplateId = (key: string | null): key is UnitTemplateId => UNIT_TEMPLATE_IDS.some((id) => id === key)

function countOptions(min: number, max: number): SelectOption<number>[] {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const count = min + index
    return { key: String(count), label: { text: String(count) }, value: count }
  })
}

function Pick({ templateId, onPick }: { readonly templateId: UnitTemplateId; readonly onPick: (id: UnitTemplateId) => void }) {
  const choices: Choice[] = UNIT_TEMPLATE_IDS.map((id) => ({ key: id, label: { key: TEMPLATE_KEYS[id].title } }))
  return (
    <div className="flex flex-col gap-sm">
      <RadioList
        label={{ key: 'setup.wizard.pickTitle' }}
        choices={choices}
        selected={templateId}
        onChange={(key) => {
          if (isTemplateId(key)) onPick(key)
        }}
      />
      <p className="text-micro text-text-muted">{t(TEMPLATE_KEYS[templateId].body)}</p>
    </div>
  )
}

function Adjust({ choices, onChange }: { readonly choices: TemplateChoices; readonly onChange: (next: TemplateChoices) => void }) {
  const template = UNIT_TEMPLATES[choices.templateId]
  const structure = template.structure
  const issues = templateChoiceIssues(choices)
  const names = keptNames(choices.templateId)
  const leaveTypes: Choice[] = template.leaveGroups.flatMap((group) =>
    group.types.flatMap((type) => {
      const key = names.leaveTypes[type.key]
      return key === undefined ? [] : [{ key: type.key, label: { key } }]
    }),
  )
  const tags: Choice[] = template.tagCategories.flatMap((category) =>
    category.tags.flatMap((tag) => {
      const key = names.tags[tag.key]
      return key === undefined ? [] : [{ key: tag.key, label: { key } }]
    }),
  )
  return (
    <div className="flex flex-col gap-md">
      <p className="text-micro text-text-muted">{t('setup.wizard.adjustHint')}</p>
      {structure === null ? null : (
        <>
          <SelectField
            labelKey="setup.wizard.sectionCount"
            name="sectionNames"
            value={choices.sectionNames.length}
            options={countOptions(structure.section.count.min, structure.section.count.max)}
            onChange={(count) => {
              onChange(withSectionCount(choices, count, sectionNameOf(choices.templateId)))
            }}
            error={issueError(issues, [], 'sectionNames')}
          />
          <fieldset className="flex flex-col gap-sm">
            <legend className="text-label font-semibold text-text-muted">{t('setup.wizard.sectionNames')}</legend>
            {choices.sectionNames.map((name, index) => (
              <TextField
                // The position is the section's identity here: a name is what is being typed.
                key={index}
                labelKey={{ text: sectionNameOf(choices.templateId)(index + 1) }}
                name={`sectionNames.${index}`}
                value={name}
                onChange={(value) => {
                  onChange({ ...choices, sectionNames: choices.sectionNames.map((old, at) => (at === index ? value : old)) })
                }}
                error={issueError(issues, [], `sectionNames.${index}`)}
                isRequired
              />
            ))}
          </fieldset>
          <SelectField
            labelKey="setup.wizard.subsectionCount"
            name="subsectionCount"
            value={choices.subsectionCount}
            options={countOptions(structure.subsection.count.min, structure.subsection.count.max)}
            onChange={(count) => {
              onChange({ ...choices, subsectionCount: count })
            }}
            error={issueError(issues, [], 'subsectionCount')}
          />
        </>
      )}
      {leaveTypes.length === 0 ? null : (
        <CheckList
          label={{ key: 'setup.wizard.leaveTypes' }}
          choices={leaveTypes}
          selected={choices.keptLeaveTypes}
          onChange={(keys) => {
            onChange({ ...choices, keptLeaveTypes: keys })
          }}
        />
      )}
      {tags.length === 0 ? null : (
        <CheckList
          label={{ key: 'setup.wizard.tags' }}
          choices={tags}
          selected={choices.keptTags}
          onChange={(keys) => {
            onChange({ ...choices, keptTags: keys })
          }}
        />
      )}
    </div>
  )
}

/** Where the setup stopped: the part, and that what ran is kept. The checklist below finishes the rest. */
export function TemplateStopped({ outcome }: { readonly outcome: Extract<TemplateOutcome, { ok: false }> }) {
  return (
    <div role="alert" className="flex flex-col gap-2xs rounded-control bg-inner p-sm">
      <p className="text-name font-semibold">{[t('setup.wizard.stoppedAt'), t(STAGE_KEYS[outcome.stage])].join(WORD)}</p>
      <p className="text-micro text-text-muted">{t('setup.wizard.stoppedHint')}</p>
    </div>
  )
}

type Stage = 'pick' | 'adjust'

/** The wizard over a fresh unit. "Later" and a stop both hand over to the checklist. */
export function TemplateWizard({
  base,
  onLeave,
  onStop,
}: {
  readonly base: TemplateBase
  readonly onLeave: () => void
  readonly onStop: (outcome: Extract<TemplateOutcome, { ok: false }>) => void
}) {
  const panel = usePanel()
  const apply = useApplyTemplate()
  const [stage, setStage] = useState<Stage>('pick')
  const [choices, setChoices] = useState<TemplateChoices>(() => initialChoices(UNIT_TEMPLATE_IDS[0], sectionNameOf(UNIT_TEMPLATE_IDS[0])))

  const finish = async (chosen: TemplateChoices) => {
    if (templateChoiceIssues(chosen).length > 0) return
    const result = await apply.run({ base, choices: chosen, names: templateNames(chosen.templateId) })
    if (!result.ok) return
    if (result.value.ok) panel.close()
    else onStop(result.value)
  }
  // A template with nothing to adjust is done from the pick.
  const adjustable = (id: UnitTemplateId) => {
    const template = UNIT_TEMPLATES[id]
    return template.structure !== null || template.leaveGroups.length > 0 || template.tagCategories.some((category) => category.tags.length > 0)
  }

  const title = stage === 'pick' ? 'setup.wizard.pickHint' : 'setup.wizard.adjustTitle'
  const toAdjust = stage === 'pick' && adjustable(choices.templateId)
  return (
    <section aria-label={t('setup.wizard.label')} className="flex flex-col gap-md">
      <p className={stage === 'pick' ? 'text-micro text-text-muted' : 'text-name font-semibold'}>{t(title)}</p>
      {stage === 'pick' ? (
        <Pick
          templateId={choices.templateId}
          onPick={(id) => {
            setChoices(initialChoices(id, sectionNameOf(id)))
          }}
        />
      ) : (
        <Adjust choices={choices} onChange={setChoices} />
      )}
      {apply.isPending ? (
        <p role="status" className="text-micro text-text-muted">
          {t('setup.wizard.applying')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-sm">
        <Button
          variant="primary"
          isDisabled={apply.isPending}
          onPress={() => {
            if (toAdjust) setStage('adjust')
            else void finish(choices)
          }}
        >
          {t(toAdjust ? 'setup.wizard.next' : 'setup.wizard.finish')}
        </Button>
        {stage === 'adjust' ? (
          <Button
            isDisabled={apply.isPending}
            onPress={() => {
              setStage('pick')
            }}
          >
            {t('setup.wizard.back')}
          </Button>
        ) : null}
        <Button isDisabled={apply.isPending} onPress={onLeave}>
          {t('setup.wizard.later')}
        </Button>
      </div>
    </section>
  )
}
