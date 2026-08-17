import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Asserts src/contrast-policy.json against the real cascade, in both themes.
 *
 * This exists because axe cannot do it. axe only sees pairs the specimen
 * happens to render, so it misses hover states and any token no component uses
 * yet; and its contrast rule is text-only, so it never checks --border-strong
 * or --focus-ring — the two tokens RULES.md leans on hardest.
 *
 * Tokens are resolved through the page so that var() chains and theme
 * overrides are exercised for real, then converted here rather than sampled
 * from pixels: no screenshot, no font rendering, no OS dependence.
 */

type Min = number | { light: number; dark: number }
type Pair = { fg: string; bg: string; min: Min; why: string }

const POLICY: { pairs: Pair[] } = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../src/contrast-policy.json', import.meta.url)),
    'utf8',
  ),
)

const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]

const floorFor = (min: Min, theme: Theme): number =>
  typeof min === 'number' ? min : min[theme]

/* ---- OKLCH -> sRGB (Ottosson) -> WCAG relative luminance ---------------- */

const encode = (v: number) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
const decode = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4

function oklchToSrgb(L: number, C: number, hDeg: number): number[] {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    // Clamp after encoding: out-of-gamut values are clipped on screen, and the
    // clipped colour is the one the user actually sees.
  ].map((v) => Math.min(1, Math.max(0, encode(v))))
}

function toSrgb(css: string): number[] {
  const oklch = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
  if (oklch) {
    return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]))
  }
  const rgb = css.match(/rgba?\(([^)]+)\)/)
  if (rgb) {
    return rgb[1].split(/[,\s/]+/).slice(0, 3).map((v) => Number(v) / 255)
  }
  throw new Error(`Cannot parse colour: ${css}`)
}

const luminance = (c: number[]) =>
  0.2126 * decode(c[0]) + 0.7152 * decode(c[1]) + 0.0722 * decode(c[2])

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/* ------------------------------------------------------------------------ */

for (const theme of THEMES) {
  test(`contrast policy: ${theme}`, async ({ page }) => {
    await page.goto('/specimen/index.html')

    const names = [...new Set(POLICY.pairs.flatMap((p) => [p.fg, p.bg]))]
    const resolved = await page.evaluate(
      ({ names, theme }) => {
        document.documentElement.setAttribute('data-theme', theme)
        // A probe element resolves the full var() chain exactly as a component
        // would, rather than reading the raw custom-property text.
        const probe = document.createElement('div')
        document.body.appendChild(probe)
        const out: Record<string, string> = {}
        for (const n of names) {
          probe.style.color = ''
          probe.style.color = `var(${n})`
          out[n] = getComputedStyle(probe).color
        }
        probe.remove()
        return out
      },
      { names, theme },
    )

    const undefinedTokens = names.filter(
      (n) => !resolved[n] || resolved[n] === 'rgba(0, 0, 0, 0)',
    )
    // A renamed or removed token resolves to nothing and would otherwise sail
    // through as a passing 1:1. This is the silent-failure mode the whole
    // package exists to guard against.
    expect(undefinedTokens, 'tokens that resolved to nothing').toEqual([])

    const failures: string[] = []
    const report: string[] = []

    for (const pair of POLICY.pairs) {
      const floor = floorFor(pair.min, theme)
      const ratio = contrast(toSrgb(resolved[pair.fg]), toSrgb(resolved[pair.bg]))
      const label = `${pair.fg} on ${pair.bg}`
      report.push(
        `${ratio.toFixed(2).padStart(6)}  min ${String(floor || '-').padEnd(4)} ${label}`,
      )
      if (floor > 0 && ratio < floor) {
        failures.push(
          `${label}\n      measured ${ratio.toFixed(2)}, policy requires ${floor}\n      ${pair.why}`,
        )
      }
    }

    console.log(`\ncontrast policy — ${theme}\n${report.join('\n')}`)
    expect(failures, `contrast policy violations (${theme})`).toEqual([])
  })
}
