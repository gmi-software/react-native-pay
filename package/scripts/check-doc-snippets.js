/**
 * Type-checks the TypeScript snippets in README.md and docs/docs against
 * package/src, so copied examples compile.
 *
 * Every `ts`, `typescript` and `tsx` fence is compiled as its own module.
 * Add `no-check` after the language (```ts no-check) for a snippet that is
 * not meant to compile on its own, such as server code.
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const packageDir = path.join(__dirname, '..')
const repoDir = path.join(packageDir, '..')
const outDir = path.join(packageDir, 'node_modules', '.cache', 'doc-snippets')
const LANGUAGES = { ts: 'ts', typescript: 'ts', tsx: 'tsx' }

function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) return markdownFiles(file)
    return /\.mdx?$/.test(entry.name) ? [file] : []
  })
}

function extractSnippets(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const snippets = []
  let open = null
  lines.forEach((line, index) => {
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)\s*(.*)$/)
    if (!fence) return
    if (!open) {
      open = {
        fence: fence[1],
        language: fence[2],
        meta: fence[3],
        start: index + 1,
      }
    } else if (fence[1].startsWith(open.fence) && !fence[2]) {
      const extension = LANGUAGES[open.language]
      if (extension) {
        snippets.push({
          file: path.relative(repoDir, file),
          line: open.start + 1,
          extension,
          skip: /\bno-check\b/.test(open.meta),
          code: lines.slice(open.start, index).join('\n'),
        })
      }
      open = null
    }
  })
  return snippets
}

const snippets = [
  path.join(repoDir, 'README.md'),
  ...markdownFiles(path.join(repoDir, 'docs', 'docs')),
].flatMap(extractSnippets)
const checked = snippets.filter((snippet) => !snippet.skip)

// Readers copy pay button examples as they are, so those always compile.
const skippedButtons = snippets.filter(
  (snippet) =>
    snippet.skip && /<(ApplePay|GooglePay)Button\b/.test(snippet.code)
)
if (skippedButtons.length > 0) {
  for (const snippet of skippedButtons) {
    console.error(
      `${snippet.file}:${snippet.line} renders a pay button, so it cannot be no-check`
    )
  }
  process.exit(1)
}

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const sources = new Map()
for (const snippet of checked) {
  const name = `${snippet.file.replace(/[^\w]+/g, '_')}_${snippet.line}.${snippet.extension}`
  // `export {}` keeps each snippet in its own module scope.
  fs.writeFileSync(path.join(outDir, name), `${snippet.code}\nexport {}\n`)
  sources.set(name, snippet)
}

fs.writeFileSync(
  path.join(outDir, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: path.join(packageDir, 'tsconfig.json'),
      compilerOptions: {
        noEmit: true,
        rootDir: packageDir,
        // Compile like an app: ES modules through a bundler, so examples
        // can use top-level await.
        module: 'esnext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        // App strictness, not the library's: examples may leave things
        // unused and index arrays without a check.
        noUnusedLocals: false,
        noUnusedParameters: false,
        noUncheckedIndexedAccess: false,
        paths: {
          '@gmisoftware/react-native-pay': [
            path.join(packageDir, 'src', 'index.ts'),
          ],
        },
      },
      include: [],
      files: [...sources.keys()],
    },
    null,
    2
  )
)

const tsc = require.resolve('typescript/bin/tsc', { paths: [packageDir] })
let output = ''
try {
  execFileSync(process.execPath, [tsc, '-p', outDir, '--pretty', 'false'], {
    encoding: 'utf8',
  })
} catch (error) {
  output = `${error.stdout ?? ''}${error.stderr ?? ''}`
}

// Point errors at the markdown file and line instead of the generated file.
const errors = output
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): (.*)$/)
    const snippet = match && sources.get(path.basename(match[1]))
    if (!snippet) return line
    return `${snippet.file}:${snippet.line + Number(match[2]) - 1}:${match[3]} ${match[4]}`
  })

const skipped = snippets.length - checked.length
if (errors.length > 0) {
  console.error(errors.join('\n'))
  console.error(
    `\ndoc snippets: ${errors.length} error(s) in ${checked.length} checked snippets`
  )
  process.exit(1)
}
console.log(
  `doc snippets: ${checked.length} type-check, ${skipped} marked no-check`
)
