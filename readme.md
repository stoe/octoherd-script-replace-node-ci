# octoherd-script-replace-node-ci

[![Test](https://github.com/stoe/octoherd-script-replace-node-ci/actions/workflows/test.yml/badge.svg)](https://github.com/stoe/octoherd-script-replace-node-ci/actions/workflows/test.yml) [![CodeQL](https://github.com/stoe/octoherd-script-replace-node-ci/actions/workflows/codeql.yml/badge.svg)](https://github.com/stoe/octoherd-script-replace-node-ci/actions/workflows/codeql.yml) [![Code Style Prettier](https://img.shields.io/badge/Code%20Style-Prettier-ff69b4.svg)](https://github.com/prettier/prettier)

> Inherit GitHub Action workflows in my `language:JavaScript` repositories from https://github.com/stoe/policies
>
> This is an opinionated, personal project
> ⚠️ USE AT YOUR OWN RISK ⚠️

## Usage

```sh
gh repo clone stoe/octoherd-script-replace-node-ci

cd octoherd-script-replace-node-ci

npm install

node cli.js
```

## Options

| option      | type    | description                                       |
| ----------- | ------- | ------------------------------------------------- |
| `--dry-run` | boolean | Show what would be done (default: `false`)        |
| `--verbose` | boolean | Show additional (debug) output (default: `false`) |

For all other options, please see https://github.com/octoherd/cli#usage

## Contributing

See [CONTRIBUTING.md](https://github.com/stoe/.github/blob/main/.github/CONTRIBUTING.md)

## About Octoherd

> [@octoherd](https://github.com/octoherd/)
> Manage multiple repository updates all at once.

## License

[MIT](license)
