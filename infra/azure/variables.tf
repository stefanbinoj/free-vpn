variable "region" {
  description = "Azure region for the VPN exit node. Brazil is brazilsouth."
  type        = string
  default     = "brazilsouth"
}

variable "instance_type" {
  description = "Azure VM size. Free-tier eligible: Standard_B1s."
  type        = string
  default     = "Standard_B1s"
}
