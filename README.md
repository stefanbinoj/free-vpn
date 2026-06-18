# Self-Hosted VPN (for watching FIFA highlights via yt)

Personal WireGuard VPN that runs on a temporary AWS EC2 instance in Brazil. Almost zero cost.

<img
  src="https://github.com/user-attachments/assets/247b39d8-f248-4cc1-a4a8-f687c15f9de8"
  alt="Lionel Messi Deal With It GIF"
  width="70%"
  style="max-width:100%; height:auto;"
/>

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

   *Download the Windows binary from https://developer.hashicorp.com/terraform/install#windows, extract `terraform.exe` to a folder of your choice (e.g. `C:\terraform`), and add that folder to your `PATH`.*

   </details>

   <details>
   <summary>Ubuntu / Debian</summary>

   *visit offical docs : https://developer.hashicorp.com/terraform/install#linux*

   </details>
3. Install WireGuard cli.

   <details>
   <summary>macOS</summary>

   ```bash
   brew install wireguard-tools
   ```

   </details>

   <details>
   <summary>Windows</summary>

   *Download and run the official installer from https://download.wireguard.com/windows-client/wireguard-installer.exe. `wg.exe` is installed under `C:\Program Files\WireGuard\` — add this folder to your `PATH` to use it from any terminal, or call it by full path.*

   </details>

   <details>
   <summary>Ubuntu / Debian</summary>

   ```bash
   sudo apt install wireguard
   ```

   </details>
4. Configure AWS credentials locally.

   Go to AWS console > IAM > Create User > Attach policies directly > Add `AmazonEC2FullAccess, AmazonSSMReadOnlyAccess` > Create user > Security credentials tab > Create access key > Show access key > Copy Access Key ID and Secret Access Key.

   ```bash
   cp .env.example .env


   # Add these credentails to .env
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

**(Optional):** The Terraform config works out of the box. If you need any further custom configs, follow this step.

```bash
cd ../infra
cp terraform.tfvars.example terraform.tfvars
```

Start the VPN:

```bash
cd ..
npm run vpn:up

# In another terminal window run this comannd to verify if you are connected:
curl ipinfo.io
```

<details>
<summary>This creates the VPN server in brazil region of AWS, generates `configs/wg-client.conf`, and connects the current device.</summary>

macOS / Linux: uses `sudo wg-quick up configs/wg-client.conf`
Windows: uses `wireguard.exe /installtunnelservice`
</details>


> macOS and Linux may ask for your password because VPN routes require `sudo`. Windows may need an Administrator terminal.


Make sure to destory all resources after use to avoid any **unexpected costs**

```bash
npm run vpn:down
```

**Pro Tip**

Use these browser extensions for a cleaner viewing experience:

- Unhook
- uBlock Origin
- Visit kaze tv (yt channel) for viewing.

**NOTE:**
- It might take a few minutes for provisioning the VPN.
- Pls dont forget to run `npm run vpn:down` after you are done using the VPN to avoid any unexpected costs.
- Never panic if it gets error/stuck just run `npm run vpn:down` it wont cost you even a penny!

**Use this at your own risk. I am not responsible for any shit that you create (ZEE5 ofc.)
