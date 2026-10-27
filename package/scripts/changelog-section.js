/**
 * Prints the CHANGELOG.md section of one version, without its heading. The
 * Release workflow uses it as the body of the GitHub Release, and fails before
 * publishing when the release pull request did not add the section.
 *
 * Usage: node scripts/changelog-section.js 0.1.0
 */
const fs = require('fs')
const path = require('path')

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/changelog-section.js <version>')
  process.exit(1)
}

const changelog = fs.readFileSync(
  path.join(__dirname, '..', '..', 'CHANGELOG.md'),
  'utf8'
)
const lines = changelog.split('\n')
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const heading = new RegExp(`^## ${escaped}(\\s|$)`)

const start = lines.findIndex((line) => heading.test(line))
if (start === -1) {
  console.error(
    `CHANGELOG.md has no "## ${version}" section. Rename "## Unreleased" to "## ${version} — <date>" in the release pull request.`
  )
  process.exit(1)
}

const next = lines.findIndex((line, i) => i > start && line.startsWith('## '))
const section = lines
  .slice(start + 1, next === -1 ? lines.length : next)
  .join('\n')
  .trim()
if (!section) {
  console.error(`The "## ${version}" section of CHANGELOG.md is empty.`)
  process.exit(1)
}

process.stdout.write(`${section}\n`)
