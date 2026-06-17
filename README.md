# FIFA VPN

Personal WireGuard VPN that exits from an AWS EC2 instance in Brazil (`sa-east-1`).

The actual VPN is WireGuard. Node.js is only the local control layer around Terraform, SSH, config generation, QR output, and health checks.

Terraform creates a dedicated tiny AWS network for the instance: VPC, public subnet, internet gateway, route table, security group, EC2 key pair, and one EC2 instance. It does not create a load balancer, database, NAT gateway, static IP, or public Node.js service.

## Requirements

- AWS credentials configured locally.
- Terraform `>= 1.6`.
- Node.js `>= 20`.
- Local WireGuard tools with `wg` available on PATH.
- An SSH key pair generated locally.

## SSH Key Flow

This project follows the safe key ownership model:

1. Generate an SSH key locally.
2. Give AWS only the public key.
3. Terraform creates an EC2 key pair from that public key.
4. EC2 boots with that public key installed for the default `ubuntu` user.
5. Your local private key is used to SSH into the instance.

Generate the key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/fifa-vpn -C "fifa-vpn"
```

Terraform defaults to reading:

```text
~/.ssh/fifa-vpn.pub
```

## Configure

Copy the example values if you want to override defaults:

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Most important variables:

```hcl
cloud_provider = "aws"
region         = "sa-east-1"
instance_type  = "t3.micro"
use_spot       = false
```

The SSH public key path is fixed at `~/.ssh/fifa-vpn.pub`. The instance name, WireGuard port, tunnel IPs, VPC CIDRs, and disk size are intentionally hardcoded because this is a one-person disposable VPN, not a reusable infrastructure module.

Set `use_spot = true` to request a Spot Instance instead of On-Demand. Spot is usually cheaper, but AWS can interrupt the instance and terminate your VPN session.

## Commands

Install the local CLI dependencies:

```bash
npm --prefix server install
```

Start the VPS and generate a local WireGuard config:

```bash
npm run vpn:up
```

Show status:

```bash
npm run vpn:status
```

Print a QR code for the WireGuard mobile app:

```bash
npm run vpn:qr
```

Run foreground health checks every 5-10 seconds:

```bash
npm run vpn:app
```

Destroy the VPS:

```bash
npm run vpn:down
```

## Security Notes

- Do not commit private keys, WireGuard configs, `.env`, or Terraform state.
- The VPS only exposes SSH and WireGuard UDP.
- SSH is publicly reachable, but key-only login is enforced and the private key stays local.
- No public Node.js server runs on the VPS.
- Root disk encryption is enabled.
- EC2 instance metadata requires IMDSv2.
- Password SSH login and root SSH login are disabled by cloud-init.

## Cost Notes

The default `t3.micro` is used because it is free-tier eligible for this setup. WireGuard for one person is light; network quality and provider bandwidth matter more than CPU or RAM.
