import {
  ChangeMembershipInput,
  CommandRankId,
  CreateCommandRankInput,
  CreateSoldierInput,
  SoldierId,
  SoldierStatus,
  UnitMembershipId,
  UpdateCommandRankInput,
  UpdateSoldierInput,
  UpdateSoldierPrivateInput,
  type CalendarDate,
  type CommandRank,
  type Issue,
  type Soldier,
  type SoldierPrivate,
  type UnitId,
  type UnitMembership,
} from '@contracts'
import { optionalText } from '@domain'
import { formIssues } from '../forms/issues'
import { formFieldIssues } from '../units/forms'

// Between the forms and the command inputs. Ids are generated here, by the caller (D-044). Optional
// text fields hold '' on screen and NULL in a row, so emptiness has one stored form.

/** The rule the commands follow too (D-101). */
const blankToNull = (value: string): string | null => optionalText(value)

// ---------------------------------------------------------------------- ranks

export interface RankFormValues {
  readonly title: string
  readonly short_title: string
  /** As typed. The form field is text, and the schema reports a value that is not a whole number. */
  readonly seniority: string
  readonly color_key: string | null
}

/** One above the most senior, so a new rank starts on top (D-095). */
export function nextSeniority(ranks: readonly CommandRank[]): number {
  return ranks.length === 0 ? 1 : Math.max(...ranks.map((rank) => rank.seniority)) + 1
}

function rankContent(values: RankFormValues) {
  return {
    title: values.title,
    short_title: blankToNull(values.short_title),
    seniority: values.seniority.trim() === '' ? undefined : Number(values.seniority),
    color_key: values.color_key,
  }
}

export function rankFormIssues(values: RankFormValues): Issue[] {
  return formIssues(CreateCommandRankInput, { id: CommandRankId.parse(crypto.randomUUID()), ...rankContent(values) })
}

export function toCreateRankInput(values: RankFormValues): CreateCommandRankInput {
  return CreateCommandRankInput.parse({ id: CommandRankId.parse(crypto.randomUUID()), ...rankContent(values) })
}

/** NULL when nothing changed. A form opened at `openedVersion` answers `stale_version` to a later change. */
export function toUpdateRankInput(rank: CommandRank, openedVersion: number, values: RankFormValues): UpdateCommandRankInput | null {
  const content = rankContent(values)
  const changes = {
    ...(content.title === rank.title ? {} : { title: content.title }),
    ...(content.short_title === rank.short_title ? {} : { short_title: content.short_title }),
    ...(content.seniority === rank.seniority ? {} : { seniority: content.seniority }),
    ...(content.color_key === rank.color_key ? {} : { color_key: content.color_key }),
  }
  if (Object.keys(changes).length === 0) return null
  return UpdateCommandRankInput.parse({ id: rank.id, expected_version: openedVersion, changes })
}

// ------------------------------------------------------------------- soldiers

export interface SoldierFormValues {
  readonly first_name: string
  readonly last_name: string
  readonly nickname: string
  readonly command_rank_id: CommandRankId | null
  readonly status: SoldierStatus
}

export interface NewSoldierValues extends Omit<SoldierFormValues, 'status'> {
  readonly membership: { readonly unit_id: UnitId | null; readonly valid_from: CalendarDate }
  readonly private: { readonly personal_id: string; readonly phone: string }
}

function newSoldierInput(values: NewSoldierValues) {
  const personalId = blankToNull(values.private.personal_id)
  const phone = blankToNull(values.private.phone)
  return {
    id: SoldierId.parse(crypto.randomUUID()),
    first_name: values.first_name,
    last_name: values.last_name,
    nickname: blankToNull(values.nickname),
    command_rank_id: values.command_rank_id,
    status: SoldierStatus.enum.active,
    properties: {},
    // `invite_email` has no field until V9 (D-094).
    private: personalId === null && phone === null ? null : { personal_id: personalId, invite_email: null, phone },
    membership:
      values.membership.unit_id === null
        ? null
        : {
            id: UnitMembershipId.parse(crypto.randomUUID()),
            unit_id: values.membership.unit_id,
            valid_from: values.membership.valid_from,
          },
  }
}

export function newSoldierIssues(values: NewSoldierValues): Issue[] {
  return formIssues(CreateSoldierInput, newSoldierInput(values))
}

export function toCreateSoldierInput(values: NewSoldierValues): CreateSoldierInput {
  return CreateSoldierInput.parse(newSoldierInput(values))
}

function soldierContent(values: SoldierFormValues) {
  return { ...values, nickname: blankToNull(values.nickname) }
}

export function soldierFormIssues(id: SoldierId, values: SoldierFormValues): Issue[] {
  return formFieldIssues(
    formIssues(UpdateSoldierInput, { id, expected_version: 1, changes: soldierContent(values) }),
  )
}

export function toUpdateSoldierInput(soldier: Soldier, openedVersion: number, values: SoldierFormValues): UpdateSoldierInput | null {
  const content = soldierContent(values)
  const changes = {
    ...(content.first_name === soldier.first_name ? {} : { first_name: content.first_name }),
    ...(content.last_name === soldier.last_name ? {} : { last_name: content.last_name }),
    ...(content.nickname === soldier.nickname ? {} : { nickname: content.nickname }),
    ...(content.command_rank_id === soldier.command_rank_id ? {} : { command_rank_id: content.command_rank_id }),
    ...(content.status === soldier.status ? {} : { status: content.status }),
  }
  if (Object.keys(changes).length === 0) return null
  return { id: soldier.id, expected_version: openedVersion, changes }
}

// -------------------------------------------------------------- private fields

export interface PrivateFormValues {
  readonly personal_id: string
  readonly phone: string
}

function privateContent(values: PrivateFormValues) {
  return { personal_id: blankToNull(values.personal_id), phone: blankToNull(values.phone) }
}

export function privateFormIssues(soldierId: SoldierId, values: PrivateFormValues): Issue[] {
  return formFieldIssues(
    formIssues(UpdateSoldierPrivateInput, {
      soldier_id: soldierId,
      expected_version: null,
      changes: privateContent(values),
    }),
  )
}

/** `expected_version` is NULL while no row exists. NULL when nothing changed. */
export function toUpdatePrivateInput(
  soldierId: SoldierId,
  opened: SoldierPrivate | null,
  values: PrivateFormValues,
): UpdateSoldierPrivateInput | null {
  const content = privateContent(values)
  const changes = {
    ...(content.personal_id === (opened?.personal_id ?? null) ? {} : { personal_id: content.personal_id }),
    ...(content.phone === (opened?.phone ?? null) ? {} : { phone: content.phone }),
  }
  if (Object.keys(changes).length === 0) return null
  return { soldier_id: soldierId, expected_version: opened?.version ?? null, changes }
}

// ----------------------------------------------------------------- memberships

export interface MoveFormValues {
  readonly unit_id: UnitId | null
  readonly effective_date: CalendarDate
}

function moveInput(soldierId: SoldierId, open: UnitMembership | null, values: MoveFormValues) {
  return {
    soldier_id: soldierId,
    effective_date: values.effective_date,
    current_membership: open === null ? null : { id: open.id, expected_version: open.version },
    new_membership:
      values.unit_id === null ? null : { id: UnitMembershipId.parse(crypto.randomUUID()), unit_id: values.unit_id },
  }
}

export function moveFormIssues(soldierId: SoldierId, open: UnitMembership | null, values: MoveFormValues): Issue[] {
  return formIssues(ChangeMembershipInput, moveInput(soldierId, open, values))
}

export function toChangeMembershipInput(
  soldierId: SoldierId,
  open: UnitMembership | null,
  values: MoveFormValues,
): ChangeMembershipInput {
  return ChangeMembershipInput.parse(moveInput(soldierId, open, values))
}
