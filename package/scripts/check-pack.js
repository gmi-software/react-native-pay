/**
 * Checks what `npm pack` would publish. Runs `prepack`, so `lib/` is rebuilt
 * from scratch first.
 *
 * - The entry points must be in the tarball. A stale incremental build once
 *   made `tsc` a no-op and shipped a package without `lib/`.
 * - Tests must not ship. That includes test files outside `__tests__`, which
 *   the build and `files` don't exclude and Jest doesn't run.
 * - The package must not run scripts in the consumer's project on install.
 */
const { execFileSync } = require('child_process')
const pkg = require('../package.json')

const REQUIRED_FILES = [
  'lib/index.js',
  'lib/index.d.ts',
  'lib/plugin/index.js',
  'app.plugin.js',
  'nitro.json',
  'NitroPay.podspec',
  'README.md',
]
const FORBIDDEN_PATHS = [
  /(^|\/)__tests__\//,
  /\.(test|spec)\.(d\.)?[jt]sx?$/,
  /^android\/src\/test\//,
  /^ios\/Tests\//,
]
const INSTALL_SCRIPTS = ['preinstall', 'install', 'postinstall']

const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
  cwd: `${__dirname}/..`,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
})
const files = JSON.parse(output)[0].files.map((file) => file.path)
const problems = []

for (const required of REQUIRED_FILES) {
  if (!files.includes(required)) {
    problems.push(`missing: ${required}`)
  }
}
for (const file of files) {
  if (FORBIDDEN_PATHS.some((pattern) => pattern.test(file))) {
    problems.push(`test file: ${file}`)
  }
}
for (const script of INSTALL_SCRIPTS) {
  if (pkg.scripts?.[script]) {
    problems.push(`install script: "${script}"`)
  }
}

if (problems.length > 0) {
  console.error(`npm pack: ${problems.length} problem(s)`)
  for (const problem of problems) {
    console.error(`  ${problem}`)
  }
  const colocated = (problem) =>
    /\.(test|spec)\./.test(problem) && !problem.includes('__tests__/')
  if (problems.some(colocated)) {
    console.error(
      'Move JS tests into a __tests__ directory: Jest only runs src/**/__tests__/**/*.test.ts.'
    )
  }
  process.exit(1)
}
console.log(`npm pack: ${files.length} files, contents OK`)
