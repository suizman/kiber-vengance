import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const workflow = readFileSync(new URL('../.github/workflows/publish-desktop-vocals.yml', import.meta.url), 'utf8');
const lines = workflow.split('\n');
const start = lines.findIndex(line => /^\s+script: \|\s*$/.test(line));
assert.notEqual(start, -1, 'Publication workflow must contain its actual inline script');
const indentation = lines[start].match(/^ */)[0].length + 2;
const script = [];
for (const line of lines.slice(start + 1)) {
  if (line.trim() && !line.startsWith(' '.repeat(indentation))) break;
  script.push(line.slice(indentation));
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const publish = new AsyncFunction('github', 'context', 'core', 'require', 'process', script.join('\n'));
const require = createRequire(import.meta.url);
const source = 'a'.repeat(40);
const moved = 'b'.repeat(40);
const tag = 'desktop-vocals-v1.0.5';
const checksum = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture(t, options = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'kiber-release-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const state = { refReads: 0, tagReads: 0, created: [], uploads: [], publications: [], contentPaths: [] };
  const packageNames = [
    ['companion-linux-x64', 'x86_64.AppImage'],
    ['companion-macos-arm64', 'arm64.dmg'],
    ['companion-macos-x64', 'x86_64.dmg'],
    ['companion-windows-x64', 'x64-setup.exe'],
  ];
  const artifacts = packageNames.map(([name, suffix], index) => ({
    id: index + 1, name, expired: false,
    binary: `KiberVengance-Companion-1.0.5-${suffix}`,
    bytes: Buffer.from(`offline native package ${name}`),
  }));
  const release = { id: 42, tag_name: options.releaseTag ?? tag, target_commitish: 'master', draft: true };
  const actions = {
    getWorkflowRun: async () => ({ data: {
      name: 'Desktop vocal companion', conclusion: options.buildConclusion ?? 'success',
      head_sha: options.buildSource ?? source, html_url: 'https://github.com/example/studio/actions/runs/7',
    } }),
    listWorkflowRunArtifacts() {},
    downloadArtifact: async ({ artifact_id }) => {
      assert.ok(artifacts.some(artifact => artifact.id === artifact_id));
      return { data: Buffer.from(String(artifact_id)) };
    },
  };
  const repos = {
    getContent: async ({ path: requestedPath, ref }) => {
      assert.equal(ref, source);
      state.contentPaths.push(requestedPath);
      const contents = requestedPath === 'companion/kv_companion/__init__.py'
        ? 'VERSION = "1.0.5"\n'
        : requestedPath === 'package.json' ? JSON.stringify({ version: '6.0.1' }) : null;
      assert.notEqual(contents, null, `Unexpected repository file ${requestedPath}`);
      return { data: { content: Buffer.from(contents).toString('base64') } };
    },
    getReleaseByTag: async ({ tag: requestedTag }) => {
      assert.equal(requestedTag, tag);
      if (options.existingRelease) return { data: release };
      throw Object.assign(new Error('Draft not created yet'), { status: 404 });
    },
    createRelease: async args => {
      state.created.push(args);
      assert.equal(args.tag_name, tag);
      assert.equal(args.draft, true);
      assert.match(args.name, /Studio 6\.0\.1.*Companion 1\.0\.5/);
      assert.equal(Object.hasOwn(args, 'target_commitish'), false,
        'The verified existing tag must be reused without requesting a target commit');
      return { data: release };
    },
    listReleaseAssets() {},
    uploadReleaseAsset: async args => {
      assert.equal(args.release_id, release.id);
      state.uploads.push(args.name);
      return { data: { name: args.name } };
    },
    updateRelease: async args => {
      state.publications.push(args);
      assert.equal(args.release_id, release.id);
      assert.equal(args.draft, false);
      assert.equal(state.uploads.length, 8, 'Publish only after all four packages and checksums');
      return { data: { ...release, draft: false } };
    },
  };
  const git = {
    getRef: async ({ ref }) => {
      assert.equal(ref, `tags/${tag}`);
      state.refReads++;
      const changed = options.moveAfterReads !== undefined && state.refReads > options.moveAfterReads;
      return { data: { object: options.lightweight
        ? { type: 'commit', sha: changed ? moved : source }
        : { type: 'tag', sha: changed ? 'changed-tag-object' : 'verified-tag-object' } } };
    },
    getTag: async ({ tag_sha }) => {
      state.tagReads++;
      assert.ok(['verified-tag-object', 'changed-tag-object'].includes(tag_sha));
      return { data: { object: { type: 'commit', sha: tag_sha === 'changed-tag-object' ? moved : source } } };
    },
  };
  const github = {
    rest: { actions, repos, git },
    paginate: async method => {
      if (method === actions.listWorkflowRunArtifacts) return artifacts;
      if (method === repos.listReleaseAssets) return [];
      throw new Error('Unexpected pagination method');
    },
  };
  const mockedRequire = name => name === 'node:child_process' ? {
    execFileSync(command, args) {
      assert.equal(command, 'unzip');
      assert.equal(args[0], '-q'); assert.equal(args[2], '-d');
      const destination = args[3];
      assert.ok(destination.startsWith(directory + path.sep));
      const artifactId = Number(readFileSync(args[1], 'utf8'));
      const artifact = artifacts.find(item => item.id === artifactId);
      assert.ok(artifact);
      writeFileSync(path.join(destination, artifact.binary), artifact.bytes);
      const hash = options.corruptChecksum && artifactId === 1 ? '0'.repeat(64) : checksum(artifact.bytes);
      writeFileSync(path.join(destination, artifact.binary + '.sha256'), `${hash}  ${artifact.binary}\n`);
    },
  } : require(name);
  return {
    state,
    run: () => publish(github, { repo: { owner: 'example', repo: 'studio' } }, { info() {} }, mockedRequire, {
      env: { BUILD_RUN_ID: '7', ENGINE_SOURCE: source, RELEASE_TAG: tag, RUNNER_TEMP: directory },
    }),
  };
}

test('release reuses an existing annotated tag without target_commitish despite master metadata', async t => {
  const { state, run } = fixture(t);
  await run();
  assert.equal(state.created.length, 1);
  assert.equal(state.uploads.length, 8);
  assert.equal(state.publications.length, 1);
  assert.ok(state.refReads >= 3, 'Recheck the tag after creating the draft and before publication');
  assert.equal(state.tagReads, state.refReads);
  assert.deepEqual(state.contentPaths, ['companion/kv_companion/__init__.py', 'package.json']);
});

test('release accepts an existing lightweight tag with the same verified source', async t => {
  const { state, run } = fixture(t, { lightweight: true });
  await run();
  assert.equal(state.publications.length, 1);
  assert.ok(state.refReads >= 3);
  assert.equal(state.tagReads, 0);
});

test('release accepts an existing draft whose target metadata names master', async t => {
  const { state, run } = fixture(t, { existingRelease: true });
  await run();
  assert.equal(state.created.length, 0);
  assert.equal(state.uploads.length, 8);
  assert.equal(state.publications.length, 1);
  assert.ok(state.refReads >= 3);
});

test('release does not publish when release metadata identifies a different tag', async t => {
  const { state, run } = fixture(t, { releaseTag: 'desktop-vocals-v1.0.4' });
  await assert.rejects(run(), /tag|source/i);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.publications.length, 0);
});

test('release does not upload or publish if the tag moves after the initial check', async t => {
  const { state, run } = fixture(t, { moveAfterReads: 1 });
  await assert.rejects(run(), /tag|source|commit/i);
  assert.equal(state.created.length, 1);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.publications.length, 0);
});

test('release remains a draft if the tag moves immediately before publication', async t => {
  const { state, run } = fixture(t, { moveAfterReads: 2 });
  await assert.rejects(run(), /tag|source|commit/i);
  assert.equal(state.uploads.length, 8);
  assert.equal(state.publications.length, 0);
});

test('release does not publish a package with a corrupt checksum', async t => {
  const { state, run } = fixture(t, { corruptChecksum: true });
  await assert.rejects(run(), /checksum mismatch/i);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.publications.length, 0);
});

for (const [name, options] of [
  ['a different build source', { buildSource: moved }],
  ['an unsuccessful build', { buildConclusion: 'failure' }],
]) test(`release rejects ${name} before creating a draft`, async t => {
  const { state, run } = fixture(t, options);
  await assert.rejects(run(), /build has not passed/i);
  assert.equal(state.refReads, 0);
  assert.equal(state.created.length, 0);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.publications.length, 0);
});
