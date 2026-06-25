# ----------------------------------------------------------------------------
# DigitalOcean — VPN exit node.
#
# This directory is a self-contained terraform working directory.
# To switch providers: `terraform destroy` in the other provider's dir first,
# then `cd ../do && terraform init && terraform apply`.
#
# Auth: DIGITALOCEAN_TOKEN
#
# Note: SSH keys added via `ssh_keys` go to root's authorized_keys, so the
# default SSH user is `root` (see outputs.tf). DO has no Spot equivalent.
# ----------------------------------------------------------------------------

provider "digitalocean" {}

locals {
  instance_name       = "fifa-vpn-brazil"
  ssh_public_key_path = pathexpand("~/.ssh/fifa-vpn.pub")
  wireguard_port      = 51820
  server_vpn_ip       = "10.8.0.1/24"

  cloud_init_data = templatefile("${path.module}/../cloud-init.yaml", {
    vpn_port      = local.wireguard_port
    server_vpn_ip = local.server_vpn_ip
  })
}

resource "digitalocean_ssh_key" "vpn" {
  name       = "fifa-vpn-key"
  public_key = file(local.ssh_public_key_path)
}

resource "digitalocean_vpc" "vpn" {
  name     = "fifa-vpn-vpc"
  region   = var.region
  ip_range = "10.42.0.0/16"
}

resource "digitalocean_firewall" "vpn" {
  name = "fifa-vpn-fw"

  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = ["0.0.0.0/0"]
  }

  inbound_rule {
    protocol         = "udp"
    port_range       = "51820"
    source_addresses = ["0.0.0.0/0"]
  }

  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0"]
  }

  outbound_rule {
    protocol              = "udp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0"]
  }

  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0"]
  }

  droplet_ids = [digitalocean_droplet.vpn.id]
}

resource "digitalocean_reserved_ip" "vpn" {
  region = var.region
}

resource "digitalocean_droplet" "vpn" {
  name       = local.instance_name
  image      = "ubuntu-24-04-x64"
  region     = var.region
  size       = var.instance_type
  vpc_uuid   = digitalocean_vpc.vpn.id
  ssh_keys   = [digitalocean_ssh_key.vpn.id]
  monitoring = false

  user_data = local.cloud_init_data
}

resource "digitalocean_reserved_ip_assignment" "vpn" {
  droplet_id  = digitalocean_droplet.vpn.id
  ip_address  = digitalocean_reserved_ip.vpn.ip_address
}

output "server_ip" {
  description = "Public IPv4 address of the VPN server."
  value       = digitalocean_reserved_ip.vpn.ip_address
}

output "ssh_user" {
  description = "SSH username for the VPN server. DO's ssh_keys field targets root's authorized_keys."
  value       = "root"
}

output "ssh_private_key_path" {
  description = "Expected matching private key path for local SSH."
  value       = trimsuffix(pathexpand("~/.ssh/fifa-vpn.pub"), ".pub")
}
