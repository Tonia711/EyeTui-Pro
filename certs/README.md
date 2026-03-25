# SSL Certificates Directory

This directory holds SSL certificates for HTTPS deployment.

## Using Tailscale HTTPS (Recommended)

Tailscale provides free, trusted Let's Encrypt certificates:

1. Enable HTTPS in [Tailscale Admin Console](https://login.tailscale.com/admin/dns) → DNS → HTTPS Certificates
2. Generate certificate on the server:
   ```bash
   tailscale cert your-machine.tailXXXXX.ts.net
   ```
3. Move certificates to this directory:
   ```bash
   mv your-machine.tailXXXXX.ts.net.crt certs/server.crt
   mv your-machine.tailXXXXX.ts.net.key certs/server.key
   ```
4. Deploy: `docker-compose up -d`

## Files (not committed to git)
- `server.crt` - SSL certificate
- `server.key` - Private key
