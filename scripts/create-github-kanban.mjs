#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEFAULTS = {
  source: 'doc/implementation.md',
  repo: 'aridotdev/qdc',
  owner: 'aridotdev',
  projectTitle: 'QRCC Data Center Implementation'
}

const LABELS = [
  ['backlog', '5319E7', 'Backlog item generated from implementation plan'],
  ['type: task', '0E8A16', 'Implementation task'],
  ['priority: P0', 'B60205', 'Blocking or business-critical'],
  ['priority: P1', 'D93F0B', 'Required after the foundation is available'],
  ['priority: P2', 'FBCA04', 'Refinement after main flows are stable']
]

const FIELD_DEFINITIONS = [
  {
    name: 'Kanban Status',
    dataType: 'SINGLE_SELECT',
    options: ['Backlog', 'Ready', 'In Progress', 'Review', 'Done']
  },
  {
    name: 'Priority',
    dataType: 'SINGLE_SELECT',
    options: ['P0', 'P1', 'P2']
  },
  {
    name: 'Task ID',
    dataType: 'TEXT'
  },
  {
    name: 'Dependencies',
    dataType: 'TEXT'
  }
]

function parseArgs(argv) {
  const args = { ...DEFAULTS, dryRun: false, skipProject: false }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--skip-project') {
      args.skipProject = true
    } else if (arg === '--source') {
      args.source = requiredValue(argv, ++i, arg)
    } else if (arg === '--repo') {
      args.repo = requiredValue(argv, ++i, arg)
    } else if (arg === '--owner') {
      args.owner = requiredValue(argv, ++i, arg)
    } else if (arg === '--project-title') {
      args.projectTitle = requiredValue(argv, ++i, arg)
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      fail(`Unknown argument: ${arg}`)
    }
  }

  return args
}

function requiredValue(argv, index, flag) {
  const value = argv[index]
  if (!value || value.startsWith('--')) {
    fail(`Missing value for ${flag}`)
  }
  return value
}

function printHelp() {
  console.log(`Usage:
  node scripts/create-github-kanban.mjs [options]

Options:
  --source <file>          Markdown implementation plan (default: ${DEFAULTS.source})
  --repo <owner/repo>      GitHub repository for issues (default: ${DEFAULTS.repo})
  --owner <login>          GitHub Project owner (default: ${DEFAULTS.owner})
  --project-title <title>  GitHub Project title (default: ${DEFAULTS.projectTitle})
  --skip-project           Create/update issues only
  --dry-run                Parse and print planned work without calling gh
  -h, --help               Show this help

Before publishing, authenticate gh with:
  gh auth login -h github.com
  gh auth refresh -h github.com -s project
`)
}

function parseImplementation(source) {
  const markdown = readFileSync(source, 'utf8')
  const lines = markdown.split(/\r?\n/)
  const tasks = []
  let section = ''
  let activeTask = null

  for (const line of lines) {
    const sectionMatch = line.match(/^##\s+\d+(?:\.\d+)?\.\s+(.+)$/)
    if (sectionMatch) {
      section = sectionMatch[1].trim()
    }

    const taskMatch = line.match(/^- \[ \]\s+(TASK-\d+)\s+-\s+(.+)$/)
    if (taskMatch) {
      if (activeTask) {
        tasks.push(finalizeTask(activeTask))
      }
      activeTask = {
        id: taskMatch[1],
        title: taskMatch[2].trim(),
        section,
        lines: []
      }
      continue
    }

    if (activeTask) {
      if (line.startsWith('## ')) {
        tasks.push(finalizeTask(activeTask))
        activeTask = null
      } else {
        activeTask.lines.push(line)
      }
    }
  }

  if (activeTask) {
    tasks.push(finalizeTask(activeTask))
  }

  return tasks
}

function finalizeTask(task) {
  const dependsOn = extractScalar(task.lines, 'Depends on') || '-'
  const priority = extractScalar(task.lines, 'Priority')
  const acceptance = extractList(task.lines, 'Acceptance', 'Test')
  const test = extractList(task.lines, 'Test')

  if (!priority) {
    fail(`Could not parse priority for ${task.id}`)
  }

  return {
    ...task,
    dependsOn,
    priority,
    acceptance,
    test,
    issueTitle: `${task.id} - ${task.title}`,
    areaLabel: `area: ${slugify(task.section)}`
  }
}

function extractScalar(lines, name) {
  const start = lines.findIndex(line => line.trimStart().startsWith(`- ${name}:`))
  if (start === -1) {
    return ''
  }

  const first = lines[start].replace(/^(\s*)-\s+[^:]+:\s*/, '').trim()
  const values = first ? [first] : []

  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s{2}-\s+[A-Z][A-Za-z ]+:/.test(line)) {
      break
    }
    if (line.trim()) {
      values.push(line.trim())
    }
  }

  return values.join(' ').replace(/\s+/g, ' ').trim()
}

function extractList(lines, name, nextName = null) {
  const start = lines.findIndex(line => line.trimStart().startsWith(`- ${name}:`))
  if (start === -1) {
    return []
  }

  const items = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (nextName && line.trimStart().startsWith(`- ${nextName}:`)) {
      break
    }
    if (/^\s{2}-\s+[A-Z][A-Za-z ]+:/.test(line)) {
      break
    }
    const normalized = line.replace(/^\s{4}/, '').trimEnd()
    if (normalized.trim()) {
      items.push(normalized)
    }
  }

  return joinWrappedBullets(items)
}

function joinWrappedBullets(lines) {
  const items = []

  for (const line of lines) {
    if (line.startsWith('- ')) {
      items.push(line.slice(2).trim())
    } else if (items.length > 0) {
      items[items.length - 1] = `${items[items.length - 1]} ${line.trim()}`.trim()
    } else if (line.trim()) {
      items.push(line.trim())
    }
  }

  return items.filter(Boolean)
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function issueBody(task, source) {
  const acceptance = task.acceptance.map(item => `- [ ] ${item}`).join('\n')
  const test = task.test.map(item => `- [ ] ${item}`).join('\n')

  return `Generated from \`${source}\`.

Task ID: \`${task.id}\`
Area: \`${task.section}\`
Priority: \`${task.priority}\`
Depends on: \`${task.dependsOn}\`

## Acceptance Criteria

${acceptance || '- [ ] Not specified'}

## Test Scope

${test || '- [ ] Not specified'}
`
}

function runGhResult(args) {
  return spawnSync('gh', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function runGh(args) {
  const result = runGhResult(args)

  if (result.status !== 0) {
    fail(ghError(args, result))
  }

  return result.stdout.trim()
}

function ghError(args, result) {
  const command = `gh ${args.join(' ')}`
  const message = result.stderr || result.stdout || `Exit code ${result.status}`
  return `${command}\n${message.trim()}`
}

function runGhJson(args) {
  const output = runGh(args)
  if (!output) {
    return {}
  }

  try {
    return JSON.parse(output)
  } catch {
    fail(`Could not parse JSON from gh ${args.join(' ')}:\n${output}`)
  }
}

function tryGhJson(args) {
  const result = runGhResult(args)

  if (result.status !== 0) {
    return {
      ok: false,
      error: ghError(args, result),
      stderr: result.stderr,
      stdout: result.stdout
    }
  }

  try {
    return {
      ok: true,
      value: result.stdout.trim() ? JSON.parse(result.stdout) : {}
    }
  } catch {
    return {
      ok: false,
      error: `Could not parse JSON from gh ${args.join(' ')}:\n${result.stdout}`,
      stderr: result.stderr,
      stdout: result.stdout
    }
  }
}

function ensureLabels(tasks, repo) {
  const areaLabels = new Map()
  for (const task of tasks) {
    areaLabels.set(task.areaLabel, task.section)
  }

  for (const [name, color, description] of LABELS) {
    runGh([
      'label',
      'create',
      name,
      '--repo',
      repo,
      '--color',
      color,
      '--description',
      description,
      '--force'
    ])
  }

  for (const [name, section] of areaLabels) {
    runGh([
      'label',
      'create',
      name,
      '--repo',
      repo,
      '--color',
      '1D76DB',
      '--description',
      `Area: ${section}`,
      '--force'
    ])
  }
}

function findExistingIssue(task, repo) {
  const query = `repo:${repo} in:title ${task.id}`
  const payload = runGhJson([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--search',
    query,
    '--json',
    'number,title,url',
    '--limit',
    '20'
  ])

  const issues = Array.isArray(payload) ? payload : payload.issues || []
  return issues.find(issue => issue.title?.startsWith(`${task.id} - `)) || null
}

function createIssue(task, repo, source, tempDir) {
  const existing = findExistingIssue(task, repo)
  if (existing) {
    console.log(`exists issue #${existing.number}: ${task.issueTitle}`)
    return existing
  }

  const bodyFile = join(tempDir, `${task.id}.md`)
  writeFileSync(bodyFile, issueBody(task, source))

  const labels = ['backlog', 'type: task', `priority: ${task.priority}`, task.areaLabel]
  const output = runGh([
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    task.issueTitle,
    '--body-file',
    bodyFile,
    '--label',
    labels.join(',')
  ])

  console.log(`created issue: ${task.issueTitle}`)
  return {
    title: task.issueTitle,
    url: output.split(/\r?\n/).at(-1)
  }
}

function ensureProject(owner, title) {
  const existingPayload = runGhJson([
    'project',
    'list',
    '--owner',
    owner,
    '--format',
    'json',
    '--limit',
    '100'
  ])
  const projects = toArray(existingPayload, 'projects')
  const existing = projects.find(project => project.title === title)

  if (existing) {
    console.log(`using project #${existing.number}: ${title}`)
    return existing
  }

  const created = runGhJson([
    'project',
    'create',
    '--owner',
    owner,
    '--title',
    title,
    '--format',
    'json'
  ])
  console.log(`created project #${created.number}: ${title}`)
  return created
}

function ensureFields(project, owner) {
  for (const field of FIELD_DEFINITIONS) {
    const current = listFields(project.number, owner)
    if (current.find(candidate => candidate.name === field.name)) {
      continue
    }

    const args = [
      'project',
      'field-create',
      String(project.number),
      '--owner',
      owner,
      '--name',
      field.name,
      '--data-type',
      field.dataType,
      '--format',
      'json'
    ]

    if (field.options) {
      args.push('--single-select-options', field.options.join(','))
    }

    runGhJson(args)
    console.log(`created project field: ${field.name}`)
  }

  return listFields(project.number, owner)
}

function listFields(projectNumber, owner) {
  const payload = runGhJson([
    'project',
    'field-list',
    String(projectNumber),
    '--owner',
    owner,
    '--format',
    'json',
    '--limit',
    '100'
  ])

  return toArray(payload, 'fields')
}

function addIssueToProject(issue, project, owner) {
  const existing = findExistingProjectItem(issue, project.number, owner)
  if (existing) {
    return existing
  }

  const args = [
    'project',
    'item-add',
    String(project.number),
    '--owner',
    owner,
    '--url',
    issue.url,
    '--format',
    'json'
  ]
  const result = tryGhJson(args)

  if (!result.ok) {
    const duplicate = findExistingProjectItem(issue, project.number, owner)
    if (duplicate) {
      return duplicate
    }
    fail(result.error)
  }

  const payload = result.value
  return payload.item || payload
}

function findExistingProjectItem(issue, projectNumber, owner) {
  const payload = runGhJson([
    'project',
    'item-list',
    String(projectNumber),
    '--owner',
    owner,
    '--format',
    'json',
    '--limit',
    '200'
  ])

  const items = toArray(payload, 'items')
  return items.find(item => projectItemUrl(item) === issue.url) || null
}

function projectItemUrl(item) {
  return item.content?.url || item.contentUrl || item.url || ''
}

function setFieldValues(item, project, fields, task) {
  const projectId = project.id
  const itemId = item.id

  if (!projectId || !itemId) {
    console.warn(`skip project field update for ${task.id}: missing project/item id`)
    return
  }

  setSingleSelect(projectId, itemId, fields, 'Kanban Status', 'Backlog')
  setSingleSelect(projectId, itemId, fields, 'Priority', task.priority)
  setText(projectId, itemId, fields, 'Task ID', task.id)
  setText(projectId, itemId, fields, 'Dependencies', task.dependsOn)
}

function setSingleSelect(projectId, itemId, fields, fieldName, optionName) {
  const field = fields.find(candidate => candidate.name === fieldName)
  const option = field?.options?.find(candidate => candidate.name === optionName)

  if (!field?.id || !option?.id) {
    console.warn(`skip ${fieldName}: option ${optionName} not found`)
    return
  }

  runGh([
    'project',
    'item-edit',
    '--id',
    itemId,
    '--project-id',
    projectId,
    '--field-id',
    field.id,
    '--single-select-option-id',
    option.id
  ])
}

function setText(projectId, itemId, fields, fieldName, value) {
  const field = fields.find(candidate => candidate.name === fieldName)
  if (!field?.id) {
    console.warn(`skip ${fieldName}: field not found`)
    return
  }

  runGh([
    'project',
    'item-edit',
    '--id',
    itemId,
    '--project-id',
    projectId,
    '--field-id',
    field.id,
    '--text',
    value
  ])
}

function toArray(payload, key) {
  if (Array.isArray(payload)) {
    return payload
  }
  if (Array.isArray(payload[key])) {
    return payload[key]
  }
  if (Array.isArray(payload.items)) {
    return payload.items
  }
  return []
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

const args = parseArgs(process.argv.slice(2))
const tasks = parseImplementation(args.source)

if (tasks.length === 0) {
  fail(`No tasks found in ${args.source}`)
}

if (args.dryRun) {
  console.log(`Found ${tasks.length} tasks in ${args.source}`)
  for (const task of tasks) {
    console.log(
      `${task.issueTitle} [${task.priority}] ${task.areaLabel}; depends on ${task.dependsOn}`
    )
  }
  process.exit(0)
}

const tempDir = mkdtempSync(join(tmpdir(), 'qdc-github-issues-'))

try {
  ensureLabels(tasks, args.repo)

  const project = args.skipProject ? null : ensureProject(args.owner, args.projectTitle)
  const fields = project ? ensureFields(project, args.owner) : []

  for (const task of tasks) {
    const issue = createIssue(task, args.repo, args.source, tempDir)

    if (project) {
      const item = addIssueToProject(issue, project, args.owner)
      setFieldValues(item, project, fields, task)
      console.log(`added to project backlog: ${task.id}`)
    }
  }

  console.log(`Done. Published ${tasks.length} backlog tasks.`)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
