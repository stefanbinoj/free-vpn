variable "cloud_provider" {
  description = "Cloud provider target. Only aws is implemented today; this keeps the future Azure/GCP expansion point explicit."
  type        = string
  default     = "aws"

  validation {
    condition     = var.cloud_provider == "aws"
    error_message = "Only cloud_provider = \"aws\" is currently supported."
  }
}

variable "region" {
  description = "AWS region for the VPN exit node. Brazil/Sao Paulo is sa-east-1."
  type        = string
  default     = "sa-east-1"
}

variable "instance_type" {
  description = "Free-tier eligible AWS EC2 instance type for this personal WireGuard VPN."
  type        = string
  default     = "t3.micro"
}

variable "use_spot" {
  description = "Use an EC2 Spot Instance instead of On-Demand. Cheaper, but AWS can interrupt it."
  type        = bool
  default     = false
}
