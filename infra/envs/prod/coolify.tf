data "coolify_servers" "all" {}

data "coolify_github_apps" "all" {}

locals {
  # Under the *.cervinschi.site wildcard on Hostinger, which points at the production server: no record to manage.
  # Traefik there answers for the name and gets its certificate from Let's Encrypt.
  app_host = "briscolab.cervinschi.site"
  # The production server; Coolify calls the server it runs on "localhost".
  server_uuid = one([for server in data.coolify_servers.all.servers : server.uuid if server.name == "localhost"])
  # The GitHub App Coolify uses for the other apps; it must be granted the briscolab repository.
  github_app_uuid = one([for app in data.coolify_github_apps.all.github_apps : app.uuid if app.name == var.github_app_name])
}

resource "coolify_project" "briscolab" {
  name        = "Briscolab"
  description = "Briscola against bots that show their reasoning. Managed by infra/ in the briscolab repo."
}

# Static files behind nginx: no database, no secrets, so nothing to set up before the first start.
module "app" {
  source = "../../modules/app"

  name                = "briscolab:site"
  description         = "The site, on briscolab.cervinschi.site; builds from main on every push to web/ or engine/."
  project_uuid        = coolify_project.briscolab.uuid
  server_uuid         = local.server_uuid
  environment_name    = "production"
  github_app_uuid     = local.github_app_uuid
  git_branch          = "main"
  dockerfile_location = "/Dockerfile"
  ports_exposes       = "8080"
  health_check_path   = "/health"
  domain              = local.app_host
  watch_paths         = ["web/**", "engine/**", "Dockerfile", ".dockerignore"]
}
