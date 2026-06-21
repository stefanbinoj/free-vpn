# ----------------------------------------------------------------------------
# Azure — VPN exit node in Brazil South (brazilsouth).
#
# This directory is a self-contained terraform working directory.
# To switch providers: `terraform destroy` in the other provider's dir first,
# then `cd ../azure && terraform init && terraform apply`.
#
# Auth: ARM_SUBSCRIPTION_ID / ARM_CLIENT_ID / ARM_CLIENT_SECRET / ARM_TENANT_ID
# ----------------------------------------------------------------------------

provider "azurerm" {
  features {}
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

resource "azurerm_resource_group" "vpn" {
  name     = "fifa-vpn-rg"
  location = var.region
}

resource "azurerm_virtual_network" "vpn" {
  name                = "fifa-vpn-vnet"
  address_space       = ["10.42.0.0/16"]
  location            = azurerm_resource_group.vpn.location
  resource_group_name = azurerm_resource_group.vpn.name
}

resource "azurerm_subnet" "vpn" {
  name                 = "fifa-vpn-subnet"
  resource_group_name  = azurerm_resource_group.vpn.name
  virtual_network_name = azurerm_virtual_network.vpn.name
  address_prefixes     = ["10.42.1.0/24"]
}

resource "azurerm_public_ip" "vpn" {
  name                = "fifa-vpn-ip"
  location            = azurerm_resource_group.vpn.location
  resource_group_name = azurerm_resource_group.vpn.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_security_group" "vpn" {
  name                = "fifa-vpn-nsg"
  location            = azurerm_resource_group.vpn.location
  resource_group_name = azurerm_resource_group.vpn.name

  security_rule {
    name                       = "ssh"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "wireguard"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Udp"
    source_port_range          = "*"
    destination_port_range     = "51820"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_network_interface" "vpn" {
  name                = "fifa-vpn-nic"
  location            = azurerm_resource_group.vpn.location
  resource_group_name = azurerm_resource_group.vpn.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.vpn.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.vpn.id
  }
}

resource "azurerm_linux_virtual_machine" "vpn" {
  name                           = local.instance_name
  resource_group_name            = azurerm_resource_group.vpn.name
  location                       = azurerm_resource_group.vpn.location
  size                           = var.instance_type
  admin_username                 = "azureuser"
  disable_password_authentication = true

  network_interface_ids = [
    azurerm_network_interface.vpn.id,
  ]

  admin_ssh_key {
    username   = "azureuser"
    public_key = file(local.ssh_public_key_path)
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  custom_data = base64encode(local.cloud_init_data)

  tags = local.common_tags
}

output "server_ip" {
  description = "Public IPv4 address of the VPN server."
  value       = azurerm_public_ip.vpn.ip_address
}

output "ssh_user" {
  description = "SSH username for the VPN server."
  value       = "azureuser"
}

output "ssh_private_key_path" {
  description = "Expected matching private key path for local SSH."
  value       = trimsuffix(pathexpand("~/.ssh/fifa-vpn.pub"), ".pub")
}
