# infra

The site's infrastructure in Terraform, one root: `envs/prod`. It follows Zuppapp's `infra/`: the same provider, the
same `app` module (copied, not shared) and the same production server.

## Commands

From `web/`:

```bash
pnpm infra:plan      # what would change; reads only
pnpm infra:apply     # applies, after showing the same plan and asking
pnpm infra:output    # the values of the last apply
```

`run.sh` wraps Terraform in `infisical run` for each folder of the infra project (environment `ops`) it needs, so no
secret comes from a file. It needs Terraform 1.10 or later, the Infisical CLI signed in, and Tailscale on: Coolify's
API is reached over the tailnet.

## What it holds

| File                   |                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `envs/prod/coolify.tf` | the Coolify project `Briscolab` on the production server and the site, built from `main` with the repo's `Dockerfile` |
| `modules/app/`         | a Coolify app built from GitHub; copied from Zuppapp                                                                  |

The site is static: no database, no secrets and no Infisical project of its own. The container is nginx on port
8080 with a health path, `/health`.

The state is in the shared R2 bucket (`TF_STATE_BUCKET`) under the key `briscolab-prod.tfstate`.

## The domain

`briscolab.cervinschi.site` is covered by the `*.cervinschi.site` wildcard on Hostinger, which points at the production server.
Terraform does not touch DNS; Traefik there gets the certificate from Let's Encrypt when the site starts.

## Secrets: cervinschi-infra → `ops`

`run.sh` needs `INFISICAL_INFRA_PROJECT_ID` exported in the shell. Then:

| Folder       | Values                                                      | What for                                                    |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `/coolify`   | `COOLIFY_ENDPOINT`, `COOLIFY_TOKEN`                         | Coolify's API, shared with the other apps                   |
| `/r2`        | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `R2_ENDPOINT` | the state bucket, shared                                    |
| `/briscolab` | `TF_STATE_BUCKET`, `COOLIFY_GITHUB_APP`                     | the bucket and the GitHub App, kept out of this public repo |

## Before the first apply, by hand

1. **Infisical**: the folder `/briscolab` with its two values.
2. **GitHub**: give the GitHub App named in `COOLIFY_GITHUB_APP` access to `MarinCervinschi/briscolab` (the installation's
   "Repository access").

## After the first apply, by hand

1. **Coolify**: start the first deploy of `briscolab:site` (`instant_deploy` is off). The build compiles the engine,
   so it takes a few minutes. Then open `/health` and check the certificate on the domain.

## Rules

- **A resource Terraform manages is not changed in Coolify's interface**, or the next plan sets it back.
- **A plan before every apply.** The provider is a community one, over an API still in beta.
