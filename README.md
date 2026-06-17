# Self-Hosted VPN (for watching FIFA highlights via yt)

Personal WireGuard VPN that runs on a temporary AWS EC2 instance in Brazil. Almost zero cost.

## Setup

1. Install Node.js.
2. Install Terraform.

   <details>
   <summary>macOS</summary>

   ```bash
   brew tap hashicorp/tap
   brew install hashicorp/tap/terraform
   ```

   </details>

   <details>
   <summary>Windows</summary>

   ```powershell
   winget install Hashicorp.Terraform
   ```

   Alternatively, download the Windows binary from https://developer.hashicorp.com/terraform/install, extract `terraform.exe` to a folder of your choice (e.g. `C:\terraform`), and add that folder to your `PATH`.

   </details>

   <details>
   <summary>Ubuntu / Debian</summary>

   ```bash
   wget -O - https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(grep -oP '(?<=UBUNTU_CODENAME=).*' /etc/os-release) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install terraform
   ```

   </details>
3. Install WireGuard tools.

   <details>
   <summary>macOS</summary>

   ```bash
   brew install wireguard-tools
   ```

   </details>

   <details>
   <summary>Windows</summary>

   Download and run the official installer from https://download.wireguard.com/windows-client/wireguard-installer.exe. `wg.exe` is installed under `C:\Program Files\WireGuard\` — add this folder to your `PATH` to use it from any terminal, or call it by full path.

   </details>

   <details>
   <summary>Ubuntu / Debian</summary>

   ```bash
   sudo apt install wireguard
   ```

   </details>
4. Configure AWS credentials locally.

   Go to AWS console > IAM > Create User > Attach policies directly > Add `AmazonEC2FullAccess, AmazonSSMReadOnlyAccess` > Create user > Security credentials tab > Create access key > Show access key > Copy Access Key ID and Secret Access Key.

   Use `.env`:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`:

   ```bash
   AWS_ACCESS_KEY_ID=your-access-key-id
   AWS_SECRET_ACCESS_KEY=your-secret-access-key
   AWS_DEFAULT_REGION=sa-east-1
   ```

## Run

Install the local CLI dependencies:

```bash
cd server
npm install
```

The Terraform config works out of the box. (Optional) Terraform works by default. If you need any further configuration, follow this step.

```bash
cd ../infra
cp terraform.tfvars.example terraform.tfvars
```

Start the VPN:

```bash
cd ..
npm run vpn:up
```

This creates the AWS server, generates `configs/wg-client.conf`, and connects this Mac using `wg-quick`. macOS may ask for your password because VPN routes require `sudo`.

Reconnect only the local Mac client:

```bash
npm run vpn:connect
```

Disconnect only the local Mac client:

```bash
npm run vpn:disconnect
```

Make sure to destory all resources after use to avoid any unexpected costs

```bash
npm run vpn:down
```

**Pro Tip**

Use these browser extensions for a cleaner viewing experience:

- Unhook
- uBlock Origin

**NOTE:**
- It might take a few minutes for provisioning the VPN.
- Pls dont forget to run `npm run vpn:down` after you are done using the VPN to avoid any unexpected costs.
- Never panic if it gets error/stuck just run `npm run vpn:down` it wont cost you even a penny!

**Use this at your own risk. I am not responsible for any shit that you create (ZEE5 ofc.)
