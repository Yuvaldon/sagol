import type { DashboardLayout, DashboardModule, DashboardTemplateId } from '@contracts'

// The board's layout (D-349): a template or one's own list of modules. Only the choice is stored (P-6).

/** The modules of each template, in order (config's `DASHBOARD_TEMPLATES`). */
export type DashboardTemplates = Readonly<Record<DashboardTemplateId, readonly DashboardModule[]>>

/** The key that tells modules apart: a module once, a `stat` once per metric. */
export function moduleKey(module: DashboardModule): string {
  return module.module === 'stat' ? `stat:${module.metric}` : module.module
}

/** The default of a scope: `control` when the unit has `minimum` or more direct sub-units with rows, else `leaves`. */
export function defaultTemplate(subUnitsWithRows: number, minimum: number): DashboardTemplateId {
  return subUnitsWithRows >= minimum ? 'control' : 'leaves'
}

/** The template a layout follows; null for a custom one. No stored layout follows the scope's default. */
export function layoutTemplate(layout: DashboardLayout | null, fallback: DashboardTemplateId): DashboardTemplateId | null {
  if (layout === null) return fallback
  return layout.kind === 'template' ? layout.template : null
}

/** The modules a layout draws, in order, before each one's own rule of being drawn. */
export function layoutModules(
  layout: DashboardLayout | null,
  fallback: DashboardTemplateId,
  templates: DashboardTemplates,
): readonly DashboardModule[] {
  if (layout !== null && layout.kind === 'custom') return layout.modules
  return templates[layoutTemplate(layout, fallback) ?? fallback]
}

/** What storing a template means: null for the scope's default, so the default keeps following the scope. */
export function templateChoice(template: DashboardTemplateId, fallback: DashboardTemplateId): DashboardLayout | null {
  return template === fallback ? null : { kind: 'template', template }
}

/** `modules` with the one at `index` moved by `offset` places; unchanged when it would leave the list. */
export function moveModule(modules: readonly DashboardModule[], index: number, offset: number): readonly DashboardModule[] {
  const target = index + offset
  const moving = modules[index]
  if (moving === undefined || target < 0 || target >= modules.length) return modules
  const next = modules.filter((_, at) => at !== index)
  next.splice(target, 0, moving)
  return next
}

/** `modules` without the one at `index`. */
export function removeModule(modules: readonly DashboardModule[], index: number): readonly DashboardModule[] {
  return modules.filter((_, at) => at !== index)
}

/** `modules` with `module` last; unchanged when it is already there. */
export function addModule(modules: readonly DashboardModule[], module: DashboardModule): readonly DashboardModule[] {
  const key = moduleKey(module)
  return modules.some((existing) => moduleKey(existing) === key) ? modules : [...modules, module]
}
