output "site_url" {
  value = "https://${local.app_host}"
}

output "app_uuid" {
  value       = module.app.uuid
  description = "The Coolify application, for its first deploy."
}
