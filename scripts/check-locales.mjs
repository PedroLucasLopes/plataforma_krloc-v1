import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname, join, relative } from 'node:path'

const args = process.argv.slice(2)
const dir = args.find(arg => !arg.startsWith('--'))
const sources = args.find(arg => arg.startsWith('--sources='))?.slice('--sources='.length)

if (!dir) {
  throw new Error('Uso: node scripts/check-locales.mjs <pasta dos JSON> [--sources=<pasta do código>]')
}

function flatten (tree, prefix = '') {
  return Object.entries(tree).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  )
}

const files = readdirSync(dir).filter(file => file.endsWith('.json')).toSorted()

if (!files.includes('en.json')) {
  throw new Error(`Sem en.json em ${dir}: ele é a referência das outras línguas.`)
}

const load = file => new Map(flatten(JSON.parse(readFileSync(join(dir, file), 'utf8'))))
const reference = load('en.json')
const problems = []
const warnings = []

const withoutLiterals = text => text.replace(/\{\s*'[^']*'\s*\}/g, '')
function parameters (text) {
  return [...new Set([...withoutLiterals(text).matchAll(/\{\s*(\w+)\s*\}/g)].map(match => match[1]))].toSorted().join(', ')
}
const forms = text => withoutLiterals(text).split('|').length

const require = createRequire(import.meta.url)
let compile = null

try {
  ({ baseCompile: compile } = require('@intlify/message-compiler'))
} catch {
  warnings.push('@intlify/message-compiler não encontrado: a sintaxe das mensagens não foi conferida.')
}

function syntaxErrors (text) {
  if (!compile) {
    return []
  }

  const errors = []

  compile(text, { onError: error => errors.push(error.message) })

  return errors
}

for (const file of files) {
  const messages = file === 'en.json' ? reference : load(file)

  for (const [key, text] of messages) {
    if (typeof text !== 'string' || text.trim() === '') {
      problems.push(`${file}: "${key}" está vazio ou não é texto`)
      continue
    }

    for (const error of syntaxErrors(text)) {
      problems.push(`${file}: "${key}" não compila no vue-i18n (${error})`)
    }

    if (file === 'en.json') {
      continue
    }

    const english = reference.get(key)

    if (english === undefined) {
      problems.push(`${file}: "${key}" não existe no en.json`)
      continue
    }

    if (parameters(text) !== parameters(english)) {
      problems.push(`${file}: "${key}" usa {${parameters(text)}}, e o inglês usa {${parameters(english)}}`)
    }

    if (forms(text) !== forms(english)) {
      problems.push(`${file}: "${key}" tem ${forms(text)} forma(s) de plural, e o inglês tem ${forms(english)}`)
    }
  }

  if (file !== 'en.json') {
    for (const key of reference.keys()) {
      if (!messages.has(key)) {
        problems.push(`${file}: falta "${key}"`)
      }
    }
  }
}

if (sources) {
  const walk = path =>
    statSync(path).isDirectory() ? readdirSync(path).flatMap(entry => walk(join(path, entry))) : [path]

  const code = walk(sources).filter(file => ['.vue', '.ts'].includes(extname(file)) && !file.endsWith('.d.ts'))
  const namespaces = new Set([...reference.keys()].map(key => key.split('.', 1)[0]))
  const groups = new Set([...reference.keys()].flatMap(key => key.split('.').slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join('.'))))
  const used = new Set()
  const prefixes = new Set()

  for (const file of code) {
    const text = readFileSync(file, 'utf8')

    for (const match of text.matchAll(/(['`])([a-z][A-Za-z0-9]*(?:\.\w+)+)\1/g)) {
      const key = match[2]

      if (!namespaces.has(key.split('.', 1)[0])) {
        continue
      }

      if (reference.has(key)) {
        used.add(key)
      } else if (groups.has(key)) {
        prefixes.add(`${key}.`)
      } else {
        problems.push(`${relative(process.cwd(), file)}: "${key}" não existe no en.json`)
      }
    }

    for (const match of text.matchAll(/`([a-z][A-Za-z0-9]*(?:\.\w+)*\.)\$\{/g)) {
      prefixes.add(match[1])
    }
  }

  for (const key of reference.keys()) {
    if (!used.has(key) && ![...prefixes].some(prefix => key.startsWith(prefix))) {
      warnings.push(`"${key}" não é usado no código`)
    }
  }
}

for (const warning of warnings) {
  console.warn(`aviso: ${warning}`)
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem)
  }
  console.error(`\n${problems.length} problema(s) nas traduções.`)
  process.exitCode = 1
} else {
  console.log(`Traduções conferidas: ${files.join(', ')}, ${reference.size} chaves cada.`)
}
