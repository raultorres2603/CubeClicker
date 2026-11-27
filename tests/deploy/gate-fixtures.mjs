// Gate harness for the build-selection deploy workflow.
//
// Loads the real `.github/workflows/deploy.yml` and `.github/workflows/ci.yml`,
// extracts the actual `run` blocks for the resolver, CI guard, deploy-contract
// gate, schema-compatibility gate, Render creation/completion steps and the CI
// build-selection parse, then executes them with stubbed external surfaces:
// `gh` (Actions API list, guard conclusion, compare status), `curl` (Render
// POST/GET responses), a local git remote and a stub `pg` module. No gate logic
// is reimplemented here: every case runs the workflow's own shell.
//
// Usage: node tests/deploy/gate-fixtures.mjs
// Prints `PASS <case>` for every case and exits non-zero on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import yaml from 'js-yaml';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

function loadWorkflow(relativePath) {
  return yaml.load(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

const deploy = loadWorkflow('.github/workflows/deploy.yml');
const ci = loadWorkflow('.github/workflows/ci.yml');
const deploySteps = deploy.jobs.deploy.steps;

function runBlockOf(name) {
  const step = deploySteps.find((candidate) => candidate.name === name);
  if (!step || typeof step.run !== 'string') throw new Error(`deploy.yml is missing the run block for step: ${name}`);
  return step.run;
}

const resolverRun = runBlockOf('Resolve selected build');
const guardRun = runBlockOf('Verify CI succeeded for target commit');
const contractRun = runBlockOf('Check selected build deploy contract');
const schemaRun = runBlockOf('Check selected build schema compatibility');
const renderCreateRun = runBlockOf('Deploy Render backend');
const renderCompleteRun = runBlockOf('Wait for Render deploy to complete');
const ciParseStep = ci.jobs['verify-workflows'].steps.find((step) => step.name === 'Validate deploy build selection contract');
if (!ciParseStep || typeof ciParseStep.run !== 'string') throw new Error('ci.yml is missing the build-selection parse run block');
const ciParseRun = ciParseStep.run;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cubeclicker-gate-'));
const binDir = path.join(tmpRoot, 'bin');
const stubModules = path.join(tmpRoot, 'stub-modules');
const emptyModules = path.join(tmpRoot, 'empty-modules');
fs.mkdirSync(binDir);
fs.mkdirSync(path.join(stubModules, 'pg'), { recursive: true });
fs.mkdirSync(emptyModules);

function writeExecutable(name, contents) {
  const file = path.join(binDir, name);
  fs.writeFileSync(file, contents);
  fs.chmodSync(file, 0o755);
  return file;
}

function writeJson(name, value) {
  const file = path.join(tmpRoot, name);
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
}

let counter = 0;
function newOutputFile() {
  counter += 1;
  const file = path.join(tmpRoot, `github-output-${counter}`);
  fs.writeFileSync(file, '');
  return file;
}

// `gh` stub: Actions runs list (the resolver's `.workflow_runs[0] // empty`
// filter), guard conclusion and compare status come from the per-case
// GH_SCENARIO JSON file.
writeExecutable('gh', `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(process.env.GH_SCENARIO, 'utf8'));
const target = args.find((arg) => arg.startsWith('repos/')) || '';
if (target.includes('/actions/workflows/ci.yml/runs')) {
  const workflowRuns = (scenario.runsResponse && scenario.runsResponse.workflow_runs) || [];
  if (workflowRuns.length === 0) process.exit(0);
  const run = workflowRuns[0];
  process.stdout.write([run.head_sha, String(run.id), run.created_at].join('\\t') + '\\n');
  process.exit(0);
}
if (target.includes('/compare/')) {
  process.stdout.write((scenario.compareStatus || '') + '\\n');
  process.exit(0);
}
if (args[0] === 'run' && args[1] === 'list') {
  process.stdout.write((scenario.conclusion || '') + '\\n');
  process.exit(0);
}
console.error('gh stub: unexpected invocation: ' + args.join(' '));
process.exit(2);
`);

// `curl` stub: Render deploy creation (POST status/body), deploy status GET
// (per-case sequence file; `fail` entries exit non-zero like a network error)
// and the latest-deploy GET.
writeExecutable('curl', `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(process.env.CURL_SCENARIO, 'utf8'));
const valueOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const output = valueOf('-o');
const writeOut = valueOf('-w');
const url = args.find((arg) => arg.startsWith('http')) || '';
if (args.includes('-X') && valueOf('-X') === 'POST') {
  const code = typeof scenario.postStatus === 'number' ? scenario.postStatus : 201;
  if (output) fs.writeFileSync(output, scenario.postBody || '{}');
  if (writeOut === '%{http_code}') process.stdout.write(String(code));
  process.exit(0);
}
if (url.includes('/deploys?limit=1')) {
  process.stdout.write(scenario.latestBody || '[]');
  process.exit(0);
}
const sequenceFile = process.env.CURL_STATUS_SEQUENCE;
const sequence = JSON.parse(fs.readFileSync(sequenceFile, 'utf8'));
const next = sequence.length > 1 ? sequence.shift() : sequence[0];
fs.writeFileSync(sequenceFile, JSON.stringify(sequence));
if (!next || next.fail) {
  console.error('curl: (56) transient Render status failure');
  process.exit(56);
}
process.stdout.write(JSON.stringify({ id: scenario.deployId, status: next.status, commit: { id: scenario.commitId } }));
process.exit(0);
`);

// Stub `pg`: schema_migrations table presence and applied migration names come
// from the per-case PG_SCENARIO JSON file.
fs.writeFileSync(path.join(stubModules, 'pg', 'package.json'), JSON.stringify({ name: 'pg', version: '0.0.0-fixture', main: 'index.js' }));
fs.writeFileSync(path.join(stubModules, 'pg', 'index.js'), `'use strict';
const fs = require('node:fs');

class Client {
  constructor() {}

  async connect() {}

  async query(sql) {
    const scenario = JSON.parse(fs.readFileSync(process.env.PG_SCENARIO, 'utf8'));
    if (sql.includes('to_regclass')) {
      return { rows: [{ t: scenario.tableExists === false ? null : 'schema_migrations' }] };
    }
    if (sql.includes('select name from schema_migrations')) {
      return { rows: (scenario.rows || []).map((name) => ({ name })) };
    }
    throw new Error('pg stub: unexpected query: ' + sql);
  }

  async end() {}
}

module.exports = { Client };
`);

const baseEnv = {
  PATH: `${binDir}:${process.env.PATH}`,
  HOME: process.env.HOME || tmpRoot,
  GITHUB_REPOSITORY: 'raultorres2603/CubeClicker',
  NODE_PATH: `${stubModules}:${path.join(repoRoot, 'node_modules')}`,
};

function runStep(run, { cwd = tmpRoot, env = {} } = {}) {
  counter += 1;
  const script = path.join(tmpRoot, `step-${counter}.sh`);
  fs.writeFileSync(script, run);
  const result = spawnSync('bash', ['-e', script], {
    cwd,
    env: { ...baseEnv, ...env },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(result, expected, label) {
  assert(
    result.status === expected,
    `${label}: expected exit ${expected}, got ${result.status}\n--- stdout ---\n${result.stdout}\n--- stderr ---\n${result.stderr}`,
  );
}

function assertLine(stdout, expected, label) {
  const lines = stdout.split(/\r?\n/);
  assert(lines.includes(expected), `${label}: missing exact line ${JSON.stringify(expected)}\n--- stdout ---\n${stdout}`);
}

function assertContains(haystack, needle, label) {
  assert(haystack.includes(needle), `${label}: missing ${JSON.stringify(needle)}\n--- actual ---\n${haystack}`);
}

const SHA = {
  latest: '1111111111111111111111111111111111111111',
  selected: '2222222222222222222222222222222222222222',
  pinned: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  dispatch: 'cccccccccccccccccccccccccccccccccccccccc',
  other: 'dddddddddddddddddddddddddddddddddddddddd',
};

// Real Actions API response shape for the newest successful CI push run on main.
const LATEST_RUN_RESPONSE = {
  total_count: 3,
  workflow_runs: [
    { head_sha: SHA.latest, id: 6001, created_at: '2026-11-27T12:00:00Z' },
    { head_sha: SHA.selected, id: 6000, created_at: '2026-11-27T11:00:00Z' },
    { head_sha: SHA.other, id: 5999, created_at: '2026-11-27T10:00:00Z' },
  ],
};

const EMPTY_RUN_RESPONSE = { total_count: 0, workflow_runs: [] };

function runResolver(name, { runsResponse = LATEST_RUN_RESPONSE, ...overrides } = {}) {
  const output = newOutputFile();
  const result = runStep(resolverRun, {
    env: {
      GH_TOKEN: 'fixture-token',
      ENVIRONMENT: 'production',
      BUILD_SHA: '',
      DISPATCH_SHA: SHA.dispatch,
      GH_SCENARIO: writeJson(`gh-${name}.json`, { runsResponse }),
      GITHUB_OUTPUT: output,
      ...overrides,
    },
  });
  return { result, output: fs.readFileSync(output, 'utf8') };
}

const failures = [];
function testCase(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

testCase('resolver-latest', () => {
  const { result, output } = runResolver('latest', { runsResponse: LATEST_RUN_RESPONSE });
  assertStatus(result, 0, 'resolver-latest');
  assertLine(result.stdout, `Resolved build: ${SHA.latest} (latest)`, 'resolver-latest');
  assertLine(result.stdout, 'CI run: 6001 2026-11-27T12:00:00Z', 'resolver-latest');
  assertContains(output, `sha=${SHA.latest}\n`, 'resolver-latest');
  assertContains(output, 'source=latest\n', 'resolver-latest');
});

testCase('resolver-latest-unavailable', () => {
  const { result } = runResolver('latest-unavailable', { runsResponse: EMPTY_RUN_RESPONSE });
  assertStatus(result, 1, 'resolver-latest-unavailable');
  assertContains(
    result.stderr,
    'No successful CI push build found on main; refusing to deploy.',
    'resolver-latest-unavailable',
  );
});

testCase('resolver-exact', () => {
  const { result, output } = runResolver('exact', { BUILD_SHA: SHA.pinned });
  assertStatus(result, 0, 'resolver-exact');
  assertLine(result.stdout, `Resolved build: ${SHA.pinned} (pinned)`, 'resolver-exact');
  assert(!result.stdout.includes('CI run:'), 'resolver-exact: a pinned build must not print a CI run line');
  assertContains(output, `sha=${SHA.pinned}\n`, 'resolver-exact');
  assertContains(output, 'source=pinned\n', 'resolver-exact');
});

testCase('resolver-malformed', () => {
  const { result } = runResolver('malformed', { BUILD_SHA: 'abc123' });
  assertStatus(result, 1, 'resolver-malformed');
  assertContains(result.stderr, 'build_sha must be a full 40-character lowercase commit SHA.', 'resolver-malformed');
});

testCase('resolver-development-default', () => {
  const { result, output } = runResolver('development-default', { ENVIRONMENT: 'development' });
  assertStatus(result, 0, 'resolver-development-default');
  assertLine(result.stdout, `Resolved build: ${SHA.dispatch} (dispatch-ref)`, 'resolver-development-default');
  assertContains(output, 'source=dispatch-ref\n', 'resolver-development-default');
});

testCase('resolver-development-non-default', () => {
  const { result } = runResolver('development-non-default', {
    ENVIRONMENT: 'development',
    BUILD_SHA: SHA.pinned,
  });
  assertStatus(result, 1, 'resolver-development-non-default');
  assertContains(
    result.stderr,
    'Build SHA selection is available for environment=production only; clear build_sha for a development dispatch.',
    'resolver-development-non-default',
  );
});

function runGuard(name, scenario) {
  return runStep(guardRun, {
    env: {
      GH_TOKEN: 'fixture-token',
      TARGET_SHA: SHA.latest,
      GH_SCENARIO: writeJson(`gh-${name}.json`, scenario),
    },
  });
}

testCase('guard-success', () => {
  const result = runGuard('guard-success', { conclusion: 'success', compareStatus: 'identical' });
  assertStatus(result, 0, 'guard-success');
  assertLine(result.stdout, `CI succeeded for ${SHA.latest}`, 'guard-success');
});

testCase('guard-ci-failure', () => {
  const result = runGuard('guard-ci-failure', { conclusion: 'failure', compareStatus: 'identical' });
  assertStatus(result, 1, 'guard-ci-failure');
  assertContains(
    result.stderr,
    `CI for ${SHA.latest} is not successful (conclusion: failure); refusing to deploy`,
    'guard-ci-failure',
  );
});

testCase('guard-missing', () => {
  const result = runGuard('guard-missing', { conclusion: '', compareStatus: 'identical' });
  assertStatus(result, 1, 'guard-missing');
  assertContains(
    result.stderr,
    `CI for ${SHA.latest} is not successful (conclusion: none); refusing to deploy`,
    'guard-missing',
  );
});

testCase('guard-not-on-main', () => {
  const result = runGuard('guard-not-on-main', { conclusion: 'success', compareStatus: 'diverged' });
  assertStatus(result, 1, 'guard-not-on-main');
  assertContains(
    result.stderr,
    `Build ${SHA.latest} is not on main (compare status: diverged); refusing to deploy.`,
    'guard-not-on-main',
  );
});

// Local git remote for the deploy-contract gate: `selected` is the build
// checkout, `main` is the dispatch ref with an identical contract, `changed`
// carries an edited contract file.
const contractFiles = [
  'src/backend/src/deploy/render-env.ts',
  'src/backend/src/deploy/render-env-cli.ts',
  'src/backend/src/auth/config.ts',
  'src/backend/src/db/migrate-cli.ts',
  'src/backend/src/db/migrate-runner.ts',
  'src/backend/src/db/migrate.ts',
  'tests/e2e/deployed-smoke.mjs',
];
const contractRepo = path.join(tmpRoot, 'contract-repo');
const contractRemote = path.join(tmpRoot, 'contract-remote.git');
fs.mkdirSync(contractRepo);

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

function commit(message) {
  git(['add', '-A'], contractRepo);
  git(['commit', '-m', message], contractRepo);
  return git(['rev-parse', 'HEAD'], contractRepo);
}

function writeContractFile(relativePath, contents) {
  const file = path.join(contractRepo, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

git(['init', '--bare', contractRemote], tmpRoot);
git(['config', 'uploadpack.allowReachableSHA1InWant', 'true'], contractRemote);
git(['init'], contractRepo);
git(['config', 'user.email', 'fixture@example.com'], contractRepo);
git(['config', 'user.name', 'Fixture'], contractRepo);
git(['checkout', '-b', 'main'], contractRepo);
for (const file of contractFiles) writeContractFile(file, 'contract v1\n');
writeContractFile('src/backend/src/db/migrations/001_init.sql', 'create table games ();\n');
writeContractFile('src/backend/src/db/migrations/002_accounts.sql', 'create table accounts ();\n');
commit('base');
writeContractFile('README.md', 'selected build\n');
const selectedBuild = commit('selected build');
git(['branch', 'selected'], contractRepo);
writeContractFile('pipeline.txt', 'dispatch ref advance\n');
const pipelinePass = commit('pipeline advance');
git(['checkout', '-b', 'changed', selectedBuild], contractRepo);
writeContractFile('src/backend/src/deploy/render-env.ts', 'contract v2\n');
const pipelineChanged = commit('contract change');
git(['checkout', 'selected'], contractRepo);
git(['remote', 'add', 'origin', `file://${contractRemote}`], contractRepo);
git(['push', 'origin', 'main', 'changed', 'selected'], contractRepo);

function runContract(pipelineSha, extraEnv) {
  return runStep(contractRun, {
    cwd: contractRepo,
    env: {
      SELECTED_SHA: selectedBuild,
      PIPELINE_SHA: pipelineSha,
      ...extraEnv,
    },
  });
}

testCase('contract-pass', () => {
  const result = runContract(pipelinePass);
  assertStatus(result, 0, 'contract-pass');
  assertLine(
    result.stdout,
    `Deploy contract OK for ${selectedBuild} (guard/migration/smoke identical to ${pipelinePass}).`,
    'contract-pass',
  );
});

testCase('contract-changed', () => {
  const result = runContract(pipelineChanged);
  assertStatus(result, 1, 'contract-changed');
  assertContains(
    result.stderr,
    `Build ${selectedBuild} has a different deploy/migration/smoke contract than the dispatch ref ${pipelineChanged}; refusing to deploy a build that predates the current deployment contract.`,
    'contract-changed',
  );
});

testCase('contract-missing-pg', () => {
  const result = runContract(pipelinePass, { NODE_PATH: emptyModules });
  assertStatus(result, 1, 'contract-missing-pg');
  assertContains(
    result.stderr,
    `Build ${selectedBuild} does not include the pg dependency required by the deployment tooling; refusing to deploy.`,
    'contract-missing-pg',
  );
});

// Selected-build checkout for the schema gate: two local migrations.
const schemaWorktree = path.join(tmpRoot, 'schema-worktree');
fs.mkdirSync(path.join(schemaWorktree, 'src/backend/src/db/migrations'), { recursive: true });
fs.writeFileSync(path.join(schemaWorktree, 'src/backend/src/db/migrations/001_init.sql'), 'create table games ();\n');
fs.writeFileSync(path.join(schemaWorktree, 'src/backend/src/db/migrations/002_accounts.sql'), 'create table accounts ();\n');

function runSchema(name, scenario) {
  return runStep(schemaRun, {
    cwd: schemaWorktree,
    env: {
      TARGET_SHA: SHA.selected,
      DIRECT_DATABASE_URL: 'postgresql://stub.invalid/cubeclicker',
      PG_SCENARIO: writeJson(`pg-${name}.json`, scenario),
    },
  });
}

testCase('schema-pass', () => {
  const result = runSchema('schema-pass', {
    tableExists: true,
    rows: ['001_init.sql', '002_accounts.sql'],
  });
  assertStatus(result, 0, 'schema-pass');
  assertLine(
    result.stdout,
    `Schema compatibility OK for ${SHA.selected}: 2 migration(s) in build, 2 applied on the target branch.`,
    'schema-pass',
  );
});

testCase('schema-missing-007', () => {
  const result = runSchema('schema-missing-007', {
    tableExists: true,
    rows: ['001_init.sql', '002_accounts.sql', '007_economy_revision.sql'],
  });
  assertStatus(result, 1, 'schema-missing-007');
  assertContains(
    result.stderr,
    `Build ${SHA.selected} predates applied migration(s): 007_economy_revision.sql; refusing to deploy a build older than the migrated schema.`,
    'schema-missing-007',
  );
});

testCase('schema-missing-table', () => {
  const result = runSchema('schema-missing-table', { tableExists: false, rows: [] });
  assertStatus(result, 0, 'schema-missing-table');
  assertLine(
    result.stdout,
    `Schema compatibility OK for ${SHA.selected}: 2 migration(s) in build, 0 applied on the target branch.`,
    'schema-missing-table',
  );
});

function runRenderCreate(name, scenario) {
  const output = newOutputFile();
  const result = runStep(renderCreateRun, {
    env: {
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      RENDER_SERVICE_ID: 'srv-fixture',
      RENDER_API_KEY: 'fixture-key',
      RENDER_DEPLOY_HOOK_URL: 'https://api.render.com/deploy/fixture-hook',
      TARGET_SHA: SHA.selected,
      CURL_SCENARIO: writeJson(`curl-${name}.json`, scenario),
      GITHUB_OUTPUT: output,
    },
  });
  return { result, output: fs.readFileSync(output, 'utf8') };
}

testCase('render-creation-201', () => {
  const { result, output } = runRenderCreate('create-201', {
    postStatus: 201,
    postBody: JSON.stringify({ id: 'dep-fixture-created', status: 'created', commit: { id: SHA.selected } }),
  });
  assertStatus(result, 0, 'render-creation-201');
  assertLine(result.stdout, `Render deploy: dep-fixture-created created for ${SHA.selected}`, 'render-creation-201');
  assertContains(output, 'deploy_id=dep-fixture-created\n', 'render-creation-201');
});

testCase('render-creation-202', () => {
  const { result } = runRenderCreate('create-202', { postStatus: 202, postBody: '' });
  assertStatus(result, 1, 'render-creation-202');
  assertContains(
    result.stderr,
    'Render deploy queued behind an in-progress deploy (HTTP 202); re-run after it completes.',
    'render-creation-202',
  );
});

testCase('render-creation-non-dep', () => {
  const { result } = runRenderCreate('create-non-dep', {
    postStatus: 201,
    postBody: JSON.stringify({ id: 'srv-not-a-deploy', status: 'created', commit: { id: SHA.selected } }),
  });
  assertStatus(result, 1, 'render-creation-non-dep');
  assertContains(
    result.stderr,
    'Render deploy id srv-not-a-deploy does not start with dep-; refusing to continue.',
    'render-creation-non-dep',
  );
});

testCase('render-creation-commit-mismatch', () => {
  const { result } = runRenderCreate('create-commit-mismatch', {
    postStatus: 201,
    postBody: JSON.stringify({ id: 'dep-fixture-mismatch', status: 'created', commit: { id: SHA.other } }),
  });
  assertStatus(result, 1, 'render-creation-commit-mismatch');
  assertContains(
    result.stderr,
    `Render deploy commit mismatch: expected ${SHA.selected}, got ${SHA.other}; refusing to continue.`,
    'render-creation-commit-mismatch',
  );
});

function renderCompleteScenario(name, { deployId, statuses, latestId = deployId, latestCommit = SHA.selected, timeoutSeconds = '10' }) {
  return {
    result: runStep(renderCompleteRun, {
      env: {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        RENDER_SERVICE_ID: 'srv-fixture',
        RENDER_API_KEY: 'fixture-key',
        DEPLOY_ID: deployId,
        TARGET_SHA: SHA.selected,
        RENDER_DEPLOY_TIMEOUT_SECONDS: timeoutSeconds,
        RENDER_DEPLOY_POLL_INTERVAL_SECONDS: '1',
        CURL_SCENARIO: writeJson(`curl-${name}.json`, {
          deployId,
          commitId: SHA.selected,
          latestBody: JSON.stringify([{ deploy: { id: latestId, commit: { id: latestCommit } } }]),
        }),
        CURL_STATUS_SEQUENCE: writeJson(`curl-${name}-sequence.json`, statuses),
      },
    }),
  };
}

testCase('render-completion-live', () => {
  const { result } = renderCompleteScenario('complete-live', {
    deployId: 'dep-fixture-live',
    statuses: [{ status: 'created' }, { status: 'live' }],
  });
  assertStatus(result, 0, 'render-completion-live');
  assertLine(result.stdout, `Render current deploy: dep-fixture-live ${SHA.selected}`, 'render-completion-live');
  assertLine(result.stdout, `Render deploy live: dep-fixture-live for ${SHA.selected}`, 'render-completion-live');
});

for (const [name, terminalStatus] of [
  ['render-completion-build-failed', 'build_failed'],
  ['render-completion-update-failed', 'update_failed'],
  ['render-completion-canceled', 'canceled'],
  ['render-completion-pre-deploy-failed', 'pre_deploy_failed'],
  ['render-completion-deactivated', 'deactivated'],
]) {
  testCase(name, () => {
    const { result } = renderCompleteScenario(name, {
      deployId: 'dep-fixture-terminal',
      statuses: [{ status: terminalStatus }],
    });
    assertStatus(result, 1, name);
    assertContains(
      result.stderr,
      `Render deploy dep-fixture-terminal ended with status ${terminalStatus} for ${SHA.selected}; refusing to continue.`,
      name,
    );
  });
}

testCase('render-completion-timeout', () => {
  const { result } = renderCompleteScenario('complete-timeout', {
    deployId: 'dep-fixture-timeout',
    statuses: [{ status: 'created' }],
    timeoutSeconds: '2',
  });
  assertStatus(result, 1, 'render-completion-timeout');
  assertContains(
    result.stderr,
    `Render deploy dep-fixture-timeout did not reach live within 2s (last status: created); refusing to continue.`,
    'render-completion-timeout',
  );
});

testCase('render-completion-transient-retry', () => {
  const { result } = renderCompleteScenario('complete-transient', {
    deployId: 'dep-fixture-transient',
    statuses: [{ fail: true }, { status: 'live' }],
  });
  assertStatus(result, 0, 'render-completion-transient-retry');
  assertContains(
    result.stdout,
    'Render deploy status GET failed transiently; retrying in 1s.',
    'render-completion-transient-retry',
  );
  assertLine(result.stdout, `Render deploy live: dep-fixture-transient for ${SHA.selected}`, 'render-completion-transient-retry');
});

testCase('render-completion-current-match', () => {
  const { result } = renderCompleteScenario('complete-current-match', {
    deployId: 'dep-fixture-current',
    statuses: [{ status: 'queued' }, { status: 'live' }],
  });
  assertStatus(result, 0, 'render-completion-current-match');
  assertLine(result.stdout, `Render current deploy: dep-fixture-current ${SHA.selected}`, 'render-completion-current-match');
  assertLine(result.stdout, `Render deploy live: dep-fixture-current for ${SHA.selected}`, 'render-completion-current-match');
});

testCase('render-completion-current-mismatch', () => {
  const { result } = renderCompleteScenario('complete-current-mismatch', {
    deployId: 'dep-fixture-current',
    statuses: [{ status: 'live' }],
    latestId: 'dep-fixture-other',
    latestCommit: SHA.other,
  });
  assertStatus(result, 1, 'render-completion-current-mismatch');
  assertContains(
    result.stderr,
    `Render service current deploy dep-fixture-other (${SHA.other}) does not match the selected deploy dep-fixture-current (${SHA.selected}); refusing to continue.`,
    'render-completion-current-mismatch',
  );
});

testCase('ci-build-parse', () => {
  const result = runStep(ciParseRun, { cwd: repoRoot });
  assertStatus(result, 0, 'ci-build-parse');
  assertContains(
    result.stdout,
    'deploy.yml: build_sha contract pinned (resolver, guard, contract, schema, Render API/completion, Vercel and 21-step order)',
    'ci-build-parse',
  );
});

fs.rmSync(tmpRoot, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\n${failures.length} gate case(s) failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log('\nAll gate cases passed.');
