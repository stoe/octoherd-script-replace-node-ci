import {configure, renderFile} from 'eta'
// eslint-disable-next-line import/extensions
import {createBranch, createCommitOnBranch, createPullRequest, getCurrentSha} from './utils.js'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {readFileSync} from 'fs'

configure({
  autoTrim: false,
  cache: false
})

const PR_BRANCH = 'refs/heads/octoherd/replace-node-workflows'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const codeqlPath = join(__dirname, 'templates', 'codeql.yml')
const codeqlContent = readFileSync(codeqlPath, 'utf8')
const codeqlBuffer = Buffer.from(codeqlContent, 'utf-8').toString('base64')

const testPath = join(__dirname, 'templates', 'test.yml')
const testContent = readFileSync(testPath, 'utf8')
const testBuffer = Buffer.from(testContent, 'utf-8').toString('base64')

const publishPath = join(__dirname, 'templates', 'publish.yml.eta')

/**
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {import('@octoherd/cli').Repository} repository
 * @param {object} options
 * @param {boolean} [options.dryRun=false]
 * @param {boolean} [options.verbose=false]
 */
export async function script(octokit, repository, {dryRun = false, verbose = false}) {
  const {
    archived,
    default_branch,
    disabled,
    fork,
    language,
    name: repo,
    node_id,
    owner: {login: owner},
    private: isPrivate,
    size
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  // skip non javascript repos
  const lang = language ? language.toLowerCase() : undefined
  if (lang !== 'javascript') {
    verbose && octokit.log.info({change: false, lang}, `not a javascript a repository`)
    return
  }

  // skip lerna repositories
  // TODO: add lerna publish template
  try {
    await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: 'lerna.json'
    })

    verbose && octokit.log.warn({change: false}, `skipping lerna repository`)
    return
  } catch (error) {
    // do nothing
  }

  // get the current ref
  const oid = await getCurrentSha(octokit, {owner, repo, default_branch})

  // create branch
  try {
    !dryRun &&
      (await createBranch(octokit, {
        node_id,
        branch: PR_BRANCH,
        oid
      }))
  } catch (error) {
    verbose && octokit.log.warn({change: false}, error.errors ? error.errors[0].message : error.message)

    // do nothing
  }

  // create commit on branch
  try {
    if (!dryRun) {
      const publishContent = await renderFile(publishPath, {isPrivate})

      await createCommitOnBranch(octokit, {
        nwo: `${owner}/${repo}`,
        branch: PR_BRANCH,
        oid,
        codeql: codeqlBuffer,
        test: testBuffer,
        publish: Buffer.from(publishContent, 'utf-8').toString('base64'),
        isPrivate
      })
    }
  } catch (error) {
    octokit.log.error({change: false, error}, error.errors[0].message)
    return
  }

  // create pull request
  try {
    if (!dryRun) {
      await createPullRequest(octokit, {
        node_id,
        base: `refs/heads/${default_branch}`,
        head: PR_BRANCH
      })
    } else {
      octokit.log.info(
        {
          change: false,
          owner,
          repo,
          private: isPrivate,
          head: default_branch,
          base: PR_BRANCH.replace('refs/heads/', ''),
          workflows: [codeqlPath, testPath, publishPath].map(file => file.replace(`${__dirname}/templates/`, '')),
          sha: oid.substr(0, 7)
        },
        '[DRY RUN] pull request created'
      )
    }
  } catch (error) {
    octokit.log.error({change: false, error}, error.errors ? error.errors[0].message : error.message)
  }
}
