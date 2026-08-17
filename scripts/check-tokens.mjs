#!/usr/bin/env node
/**
 * Text-level backstop for the Tier 2 rule.
 * AST linters miss Tailwind classes inside Vue template strings; this doesn't.
 *
 *   node scripts/check-tokens.mjs [dir]        default: src
 *
 * Node rather than bash, deliberately: this package already requires Node, and
 * a shell script is unrunnable in a plain Windows console, which made the lint
 * gate impossible to pass on a maintainer's own machine. No dependencies —
 * adding one here would violate the rule this script exists to enforce.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC = process.argv[2] ?? 'src'
const EXTENSIONS = new Set(['.vue', '.css', '.ts', '.tsx', '.jsx'])

/** Files permitted to define or override Tier 1, by convention. */
const ALLOWED = /(^|\/)(tokens\.css|brand\.css|adapters\/[^/]*\.css)$/

const CHECKS = [
  [/\[[0-9]+(px|rem|em|%)\]/, 'Arbitrary Tailwind size — use a token'],
  [/\[#[0-9a-fA-F]{3,8}\]/, 'Arbitrary Tailwind colour — use a token'],
  [/#[0-9a-fA-F]{3,8}\b/, 'Raw hex colour — use a Tier 2 token'],
  [/var\(\s*--[na]-[0-9]/, 'Tier 1 primitive — use a Tier 2 token'],
  [/var\(\s*--ui-/, 'Nuxt UI token used directly — go through the adapter'],
  [/shadow-(sm|md|lg|xl|2xl)\b/, 'Tailwind shadow — only --shadow-popover / --shadow-overlay'],
  [/\bgap-\[|\bp-\[|\bm-\[|\bw-\[|\bh-\[/, 'Arbitrary Tailwind spacing/size'],
]

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      yield* walk(full)
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      yield full
    }
  }
}

function exists(p) {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

if (!exists(SRC)) {
  console.error(`check-tokens: no such directory: ${SRC}`)
  process.exit(1)
}

// Path is matched with forward slashes so the allow-list behaves the same on
// Windows. The bash version tested the whole "path:line:text" grep output,
// which also let a line *mentioning* tokens.css slip through.
const files = [...walk(SRC)].map((f) => ({
  path: f,
  posix: relative(process.cwd(), f).split(sep).join('/'),
}))

const findings = new Map()

for (const file of files) {
  if (ALLOWED.test(file.posix)) continue
  const lines = readFileSync(file.path, 'utf8').split(/\r?\n/)
  lines.forEach((text, i) => {
    for (const [pattern, label] of CHECKS) {
      if (pattern.test(text)) {
        if (!findings.has(label)) findings.set(label, [])
        findings.get(label).push(`${file.posix}:${i + 1}:${text.trim()}`)
      }
    }
  })
}

if (findings.size === 0) {
  console.log(`OK  Token discipline clean (${files.length} files checked)`)
  process.exit(0)
}

for (const [label, hits] of findings) {
  console.log(`FAIL  ${label}`)
  for (const hit of hits) console.log(`    ${hit}`)
  console.log()
}
process.exit(1)
