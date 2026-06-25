variable "region" {
  description = "AWS region for the VPN exit node. São Paulo is sa-east-1."
  type        = string
  default     = "sa-east-1"
}

variable "instance_type" {
  description = "Free-tier eligible AWS EC2 instance type."
  type        = string
  default     = "t3.micro"
}
