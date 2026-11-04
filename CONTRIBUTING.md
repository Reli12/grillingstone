# Contributing

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Release notes are generated from them, so
each `feat` and `fix` subject is a line a user will read: write it in user language ("delete a Project from the home
list after confirming"), not in code terms.

| Type                                                        | In the release notes | Version bump |
| ----------------------------------------------------------- | -------------------- | ------------ |
| `feat`                                                      | Features             | minor        |
| `fix`                                                       | Bug Fixes            | patch        |
| `docs`, `refactor`, `test`, `build`, `chore`, `style`, `ci` | hidden               | none         |
| any type with `!` / `BREAKING CHANGE:`                      | Breaking Changes     | major        |

Use `feat` and `fix` only for changes a user can notice. Plumbing that a feature needs is `refactor` or `chore`, or
part of the user-facing commit.

## Breaking changes

Grilling Stone is run from a clone, so "breaking" means breaking for someone who already runs it. Mark a commit
breaking (`feat!:` and a `BREAKING CHANGE:` footer) only when it changes one of these:

1. **Stored data**: a new build can't read Projects, Drafts, Templates, Glossaries or other data an older one wrote,
   or needs a migration step.
2. **How you run it**: npm scripts, Docker Compose service or volume names, the port, environment variables,
   configuration.
3. **Requirements**: the minimum Node.js version, the required Claude Code version, a newly required sign-in.
4. **Exported formats**: files another install imports, such as Template bundles.

UI and behaviour changes are **not** breaking, however large. Renaming code (exports, component props, internal
routes) is not breaking unless it changes one of the four.

The `BREAKING CHANGE:` footer says what breaks **and how to upgrade**:

```text
feat(storage)!: keep Drafts in one folder per Project

BREAKING CHANGE: Drafts saved by 1.x are not found. Run `npm run migrate`
once after upgrading.
```

## Releasing

Releases are cut when the maintainer decides, not on every merge.

1. Every merge to `master` updates an open **release PR** with the next version and the generated `CHANGELOG.md`.
   Don't edit that PR.
2. To release, merge the release PR. That bumps `package.json`, commits `CHANGELOG.md`, tags the version and opens a
   **draft GitHub Release** with the same notes.
3. Edit the draft: remove lines users won't care about, and add a short **Highlights** paragraph at the top, a
   sentence or two per headline feature. Then publish it.

`CHANGELOG.md` stays as generated: the full log. The published GitHub Release is the edited one.
