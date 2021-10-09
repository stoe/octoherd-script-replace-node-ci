import {dirname, join} from 'path'
import {fileURLToPath} from 'url'
import {readFileSync} from 'fs'

const PR_BRANCH = 'refs/heads/octoherd/replace-node-workflows'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const codeqlPath = join(__dirname, 'templates', 'codeql.yml')
const codeqlContent = readFileSync(codeqlPath, 'utf8')

const testPath = join(__dirname, 'templates', 'test.yml')
const testContent = readFileSync(testPath, 'utf8')

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

  // https://docs.github.com/en/rest/reference/git#get-a-reference
  const {
    data: {
      object: {sha}
    }
  } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
    owner,
    repo,
    ref: `heads/${default_branch}`
  })

  // create branch
  try {
    // https://docs.github.com/en/graphql/reference/mutations#createref
    !dryRun &&
      (await octokit.graphql(
        `mutation ($repoID: ID!, $branch: String!, $oid: GitObjectID!) {
    createRef(input: {
      repositoryId: $repoID,
      name: $branch,
      oid: $oid
    }) { clientMutationId }
  }`,
        {
          repoID: node_id,
          branch: PR_BRANCH,
          oid: sha
        }
      ))
  } catch (error) {
    verbose && octokit.log.warn({change: false}, error.errors[0].message)

    // do nothing
  }

  // create commit on branch
  try {
    // https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
    !dryRun &&
      (await octokit.graphql(
        `mutation (
  $nwo: String!,
  $branch: String!,
  $oid: GitObjectID!,
  ${isPrivate ? '' : `$codeql: Base64String!`},
  $test: Base64String!
) {
  createCommitOnBranch(
    input: {
      branch: { repositoryNameWithOwner: $nwo, branchName: $branch }
      expectedHeadOid: $oid
      message: { headline: "🤖 Replace Node workflows" }
      fileChanges: {
        additions: [
          ${
            isPrivate
              ? ''
              : `{ 
            path: ".github/workflows/codeql.yml",
            contents: $codeql
          },`
          }
          {
            path: ".github/workflows/test.yml",
            contents: $test
          }
        ]
      }
    }
  ) {
    clientMutationId
  }
}`,
        {
          nwo: `${owner}/${repo}`,
          branch: PR_BRANCH,
          oid: sha,
          codeql: Buffer.from(codeqlContent, 'utf-8').toString('base64'),
          test: Buffer.from(testContent, 'utf-8').toString('base64')
        }
      ))
  } catch (error) {
    octokit.log.error({change: false, error}, error.errors[0].message)
    return
  }

  // create pull request
  try {
    if (!dryRun) {
      // https://docs.github.com/en/graphql/reference/mutations#createpullrequest
      const {
        createPullRequest: {
          pullRequest: {url}
        }
      } = await octokit.graphql(
        `mutation ($repoID: ID!, $base: String!, $head: String!) {
    createPullRequest(input: {
      repositoryId: $repoID,
      baseRefName: $base,
      headRefName: $head,
      title: "🤖 Replace Node workflows",
      body: "via [@stoe/octoherd-script-replace-node-ci](https://github.com/stoe/octoherd-script-replace-node-ci)",
    }) {
      pullRequest {
        url
      }
    }
  }`,
        {
          repoID: node_id,
          base: `refs/heads/${default_branch}`,
          head: PR_BRANCH
        }
      )

      octokit.log.info({change: true}, `pull request created ${url}`)
    } else {
      octokit.log.info(
        {
          change: false,
          owner,
          repo,
          head: default_branch,
          base: PR_BRANCH.replace('refs/heads/', ''),
          files: [codeqlPath.replace(`${__dirname}/templates/`, ''), testPath.replace(`${__dirname}/templates/`, '')],
          sha: sha.substr(0, 7)
        },
        '[DRY RUN] pull request created'
      )
    }
  } catch (error) {
    octokit.log.error({change: false, error}, error.errors[0].message)
  }
}
