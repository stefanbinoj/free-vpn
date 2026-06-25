variable "region" {
  description = "GCP region for the VPN exit node. Brazil is southamerica-east1."
  type        = string
  default     = "southamerica-east1"
}

variable "instance_type" {
  description = "GCE machine type. Free-tier eligible: e2-micro."
  type        = string
  default     = "e2-micro"
}
