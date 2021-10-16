import {configure, renderFile} from 'eta'
import {dirname, join} from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

configure({
  autoTrim: false,
  cache: false
})

export {createBranch, createCommitOnBranch, createPullRequest, getCurrentSha}

/**
 * @async
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {object} options
 * @param {string} options.node_id
 * @param {string} options.branch
 * @param {string} options.oid
 *
 * @see https://docs.github.com/en/graphql/reference/mutations#createref
 */
const createBranch = async (octokit, {node_id, branch, oid}) => {
  const {data} = await octokit.graphql(
    `mutation ($node_id: ID!, $branch: String!, $oid: GitObjectID!) {
    createRef(input: {
      repositoryId: $node_id,
      name: $branch,
      oid: $oid
    }) { clientMutationId }
  }`,
    {
      node_id,
      branch,
      oid
    }
  )

  return data
}

/**
 * @async
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {object} options
 * @param {string} options.nwo
 * @param {string} options.branch
 * @param {string} options.oid
 * @param {string} options.codeql
 * @param {string} options.test
 * @param {string} options.publish
 * @param {boolean} options.isPrivate
 *
 * @see https://docs.github.com/en/graphql/reference/mutations#createcommitonbranch
 */
const createCommitOnBranch = async (octokit, {nwo, branch, oid, codeql, test, publish, isPrivate}) => {
  const queryPath = join(__dirname, 'templates', 'createCommitOnBranch.graphql.eta')
  const query = await renderFile(queryPath, {isPrivate, nwo})

  return await octokit.graphql(query, {
    nwo,
    branch,
    oid,
    codeql: !isPrivate ? codeql : '',
    test,
    publish: !isPrivate ? publish : ''
  })
}

/**
 * @async
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {object} options
 * @param {string} options.node_id
 * @param {string} options.base
 * @param {string} options.head
 *
 * @see https://docs.github.com/en/graphql/reference/mutations#createpullrequest
 */
const createPullRequest = async (octokit, {node_id, base, head}) => {
  const {
    createPullRequest: {
      pullRequest: {url}
    }
  } = await octokit.graphql(
    `mutation ($node_id: ID!, $base: String!, $head: String!) {
    createPullRequest(input: {
      repositoryId: $node_id,
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
      node_id,
      base,
      head
    }
  )

  octokit.log.info({change: true}, `pull request created ${url}`)
}

/**
 * @async
 *
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {object} options
 * @param {string} options.owner
 * @param {string} options.repo
 * @param {string} options.default_branch
 *
 * @returns {string}
 * @see https://docs.github.com/en/rest/reference/git#get-a-reference
 */
const getCurrentSha = async (octokit, {owner, repo, default_branch}) => {
  const {data} = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
    owner,
    repo,
    ref: `heads/${default_branch}`
  })

  return data?.object?.sha
}
