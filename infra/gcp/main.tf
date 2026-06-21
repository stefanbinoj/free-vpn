# ----------------------------------------------------------------------------
# GCP — VPN exit node in South America (southamerica-east1).
#
# This directory is a self-contained terraform working directory.
# To switch providers: `terraform destroy` in the other provider's dir first,
# then `cd ../gcp && terraform init && terraform apply`.
#
# Auth: GOOGLE_CREDENTIALS (path to service-account JSON) + GOOGLE_PROJECT
# ----------------------------------------------------------------------------

provider "google" {
  region = var.region
}

locals {
  instance_name       = "fifa-vpn-brazil"
  ssh_public_key_path = pathexpand("~/.ssh/fifa-vpn.pub")
  wireguard_port      = 51820
  server_vpn_ip       = "10.8.0.1/24"

  common_tags = {
    Project   = "fifa-vpn"
    ManagedBy = "terraform"
  }

  cloud_init_data = templatefile("${path.module}/../cloud-init.yaml", {
    vpn_port      = local.wireguard_port
    server_vpn_ip = local.server_vpn_ip
  })
}

resource "google_compute_network" "vpn" {
  name                    = "fifa-vpn-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "vpn" {
  name          = "fifa-vpn-subnet"
  ip_cidr_range = "10.42.1.0/24"
  region        = var.region
  network       = google_compute_network.vpn.id
}

resource "google_compute_firewall" "vpn" {
  name    = "fifa-vpn-fw"
  network = google_compute_network.vpn.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  allow {
    protocol = "udp"
    ports    = ["51820"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["fifa-vpn"]
}

resource "google_compute_address" "vpn" {
  name   = "fifa-vpn-ip"
  region = var.region
}

resource "google_compute_instance" "vpn" {
  name         = local.instance_name
  machine_type = var.instance_type
  zone         = "${var.region}-a"
  tags         = ["fifa-vpn"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-standard"
    }
  }

  network_interface {
    network    = google_compute_network.vpn.name
    subnetwork = google_compute_subnetwork.vpn.name

    access_config {
      nat_ip = google_compute_address.vpn.address
    }
  }

  metadata = {
    user-data = local.cloud_init_data
    ssh-keys  = "ubuntu:${file(local.ssh_public_key_path)}"
  }

  labels = {
    app = "fifa-vpn"
  }
}

output "server_ip" {
  description = "Public IPv4 address of the VPN server."
  value       = google_compute_address.vpn.address
}

output "ssh_user" {
  description = "SSH username for the VPN server."
  value       = "ubuntu"
}

output "ssh_private_key_path" {
  description = "Expected matching private key path for local SSH."
  value       = trimsuffix(pathexpand("~/.ssh/fifa-vpn.pub"), ".pub")
}
