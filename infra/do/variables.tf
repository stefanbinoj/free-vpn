variable "region" {
  description = "DigitalOcean region slug for the VPN exit node (e.g. nyc1, sfo1, ams3)."
  type        = string
  default     = "nyc1"
}

variable "instance_type" {
  description = "DigitalOcean droplet size slug. Cheapest basic plan: s-1vcpu-512mb-10gb."
  type        = string
  default     = "s-1vcpu-512mb-10gb"
}
