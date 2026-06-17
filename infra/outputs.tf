output "server_ip" {
  description = "Public IPv4 address of the Brazil VPN server."
  value       = aws_instance.vpn.public_ip
}

output "ssh_user" {
  description = "Default Ubuntu SSH user."
  value       = "ubuntu"
}

output "ssh_private_key_path" {
  description = "Expected matching private key path for local SSH."
  value       = trimsuffix(pathexpand("~/.ssh/fifa-vpn.pub"), ".pub")
}
