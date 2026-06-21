# ----------------------------------------------------------------------------
# AWS — VPN exit node in São Paulo (sa-east-1).
#
# This directory is a self-contained terraform working directory.
# To switch providers: `terraform destroy` here first, then `cd ../azure`
# (or gcp / do) and `terraform init && terraform apply`.
# ----------------------------------------------------------------------------

provider "aws" {
  region = var.region

  # Don't talk to AWS at init time — only when a resource needs it.
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
}

locals {
  instance_name       = "fifa-vpn-brazil"
  ssh_public_key_path = pathexpand("~/.ssh/fifa-vpn.pub")
  wireguard_port      = 51820
  server_vpn_ip       = "10.8.0.1/24"

  common_tags = {
    Name      = local.instance_name
    Project   = "fifa-vpn"
    ManagedBy = "terraform"
  }

  cloud_init_data = templatefile("${path.module}/../cloud-init.yaml", {
    vpn_port      = local.wireguard_port
    server_vpn_ip = local.server_vpn_ip
  })
}

data "aws_ssm_parameter" "ubuntu_amd64" {
  name = "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_key_pair" "vpn" {
  key_name   = "${local.instance_name}-key"
  public_key = file(local.ssh_public_key_path)

  tags = local.common_tags
}

resource "aws_vpc" "vpn" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.instance_name}-vpc"
  })
}

resource "aws_internet_gateway" "vpn" {
  vpc_id = aws_vpc.vpn.id

  tags = merge(local.common_tags, {
    Name = "${local.instance_name}-igw"
  })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.vpn.id
  cidr_block              = "10.42.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.instance_name}-public"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpn.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.vpn.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.instance_name}-public"
  })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "vpn" {
  name        = "${local.instance_name}-sg"
  description = "Personal WireGuard VPN access"
  vpc_id      = aws_vpc.vpn.id

  ingress {
    description = "SSH from trusted client"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "WireGuard"
    from_port   = local.wireguard_port
    to_port     = local.wireguard_port
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Outbound internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_instance" "vpn" {
  ami                         = data.aws_ssm_parameter.ubuntu_amd64.value
  instance_type               = var.instance_type
  key_name                    = aws_key_pair.vpn.key_name
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.vpn.id]
  associate_public_ip_address = true
  source_dest_check           = false

  user_data = local.cloud_init_data

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  tags = local.common_tags
}

output "server_ip" {
  description = "Public IPv4 address of the VPN server."
  value       = aws_instance.vpn.public_ip
}

output "ssh_user" {
  description = "SSH username for the VPN server."
  value       = "ubuntu"
}

output "ssh_private_key_path" {
  description = "Expected matching private key path for local SSH."
  value       = trimsuffix(pathexpand("~/.ssh/fifa-vpn.pub"), ".pub")
}
