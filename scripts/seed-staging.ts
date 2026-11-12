// Fills the staging Supabase project with made-up data (D-281): one company, its platoons and squads, 60 soldiers
// with invented personal numbers, ranks, roles, two rotations, leaves and their history. It runs
// `seed-staging.sql` through the Supabase Management API, and only on a project whose name ends in `-staging`
// (D-276), so it can never write to production. The SQL is idempotent: a second run adds nothing.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const API = 'https://api.supabase.com/v1/projects'
const STAGING_SUFFIX = '-staging'
const SQL = readFileSync(join(import.meta.dirname, 'seed-staging.sql'), 'utf8')

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.STAGING_PROJECT_REF
if (token === undefined || token === '' || ref === undefined || ref === '') {
  console.error('✖ seed-staging: set SUPABASE_ACCESS_TOKEN and STAGING_PROJECT_REF')
  process.exit(1)
}
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

const project = await fetch(`${API}/${ref}`, { headers })
if (!project.ok) {
  console.error(`✖ seed-staging: project ${ref} is not readable (${String(project.status)})`)
  process.exit(1)
}
const body: unknown = await project.json()
const name = typeof body === 'object' && body !== null && 'name' in body ? String(body.name) : ''
if (!name.endsWith(STAGING_SUFFIX)) {
  console.error(`✖ seed-staging: project ${ref} is '${name}', not a staging project`)
  process.exit(1)
}

const result = await fetch(`${API}/${ref}/database/query`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ query: SQL }),
})
if (!result.ok) {
  console.error(`✖ seed-staging: ${String(result.status)} ${await result.text()}`)
  process.exit(1)
}
console.log(`✔ seed-staging: ${name} (${ref}) seeded`)
