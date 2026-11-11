// Status line: context use and plan usage (5-hour and weekly), with a warning mark from 80%.
// Fields per code.claude.com/docs/en/statusline; rate_limits appear only on claude.ai plans, after the first reply.
let raw = ''
for await (const chunk of process.stdin) raw += chunk
const s = raw ? JSON.parse(raw) : {}
const pct = (v) => (typeof v === 'number' ? Math.round(v) : null)
const mark = (v) => (v !== null && v >= 80 ? '⚠ ' : '')
const parts = []
const ctx = pct(s.context_window?.used_percentage)
if (ctx !== null) parts.push(`${mark(ctx)}ctx ${ctx}%`)
const five = pct(s.rate_limits?.five_hour?.used_percentage)
if (five !== null) parts.push(`${mark(five)}5h ${five}%`)
const week = pct(s.rate_limits?.seven_day?.used_percentage)
if (week !== null) parts.push(`${mark(week)}week ${week}%`)
process.stdout.write(parts.join(' · '))
