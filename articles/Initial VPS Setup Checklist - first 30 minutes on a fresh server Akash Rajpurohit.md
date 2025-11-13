# Initial VPS Setup Checklist - first 30 minutes on a fresh server | Akash Rajpurohit
As promised on X/Twitter, here I am starting with the first blog post of many covering about how to setup and manage your VPS and we will cover many topics in this series.

Everyone's yelling "just use a VPS bro, it's cheaper than Vercel!" Cool. But if you're gonna self-host on a VPS, you better know what you're signing up for. 👇 Here are 11 things you must understand before you ditch managed services: 1. Firewalls (UFW/iptables) – Default open

[](#the-problem)The Problem
---------------------------

Your fresh VPS is getting probed by bots within minutes of going live. SSH brute force attacks started before you even finished reading the welcome email.

This is not the time to sip a coffee and wait, lets set up your VPS with the security best practices so you can actually start focusing on your project.

[](#the-checklist)The Checklist
-------------------------------

### [](#step-1-create-user-with-sudo-access)Step 1: Create User with Sudo Access

Root login is a massive target. Create your user immediately.

```
# Replace 'youruser' with your actual usernameadduser youruserusermod -aG sudo youruser
```

### [](#step-2-setup-ssh-keys-and-disable-password-auth)Step 2: Setup SSH Keys and Disable Password Auth

Password authentication = guaranteed breach eventually.

```
# On your local machine - generate key if you don't have onessh-keygen -t ed25519 -C "your-email@example.com"# Copy your public key to the server (replace youruser and server-ip)ssh-copy-id youruser@your-server-ip# Test login with key works BEFORE disabling passwordsssh youruser@your-server-ip
```

Now disable password auth:

```
sudo nano /etc/ssh/sshd_config.d/01-hardening.conf
```

Add these lines:

```
PasswordAuthentication noPermitRootLogin noPubkeyAuthentication yes# random port number, pick your own (good practice but optional)Port 6203
```

```
sudo systemctl reload ssh
```

Test SSH login with your key in a new terminal before closing your current session. If it fails, you’ll lock yourself out.

### [](#step-3-enable-firewall-allow-ssh-first)Step 3: Enable Firewall (Allow SSH First!)

Block everything except what you need.

```
# Allow SSH FIRST with rate limiting (replace 6203 with your own port)# Rate limiting allows only 6 connections per 30 seconds from same IPsudo ufw limit 6203/tcp# Allow HTTPS if you're running web servicessudo ufw allow 443/tcp# Enable firewallsudo ufw --force enable# Check statussudo ufw status
```

### [](#step-4-install-fail2ban-for-ssh-protection)Step 4: Install Fail2ban for SSH Protection

Automatic IP blocking after failed login attempts.

```
sudo apt updatesudo apt install fail2ban -y# Add SSH jail settingssudo nano /etc/fail2ban/jail.d/01-hardening.conf
```

Find the `[sshd]` section and ensure:

```
[sshd]enabled = trueport = sshfilter = sshdlogpath = /var/log/auth.logmaxretry = 3findtime = 10mbantime = 10m
```

```
sudo systemctl enable fail2bansudo systemctl start fail2ban
```

Read more about fail2ban [here](https://akashrajpurohit.com/blog/fail2ban-protecting-your-homelab-from-brute-force-attacks/?utm_source=akashrajpurohit.com&utm_medium=blog&utm_campaign=initial-vps-setup-checklist-first-30-minutes).

### [](#step-5-security-updates-and-unattended-upgrades)Step 5: Security Updates and Unattended Upgrades

Keep your system patched automatically.

```
# Update packagessudo apt update && sudo apt upgrade -y# Install unattended upgradessudo apt install unattended-upgrades -y# Enable automatic security updatessudo dpkg-reconfigure -plow unattended-upgrades
```

### [](#step-6-verification-commands)Step 6: Verification Commands

Confirm everything worked:

```
# Check SSH configsudo sshd -T | grep -E "(port|passwordauthentication|permitrootlogin)"# Verify SSH key auth is working (should connect without password prompt)ssh -p 6203 youruser@your-server-ip# Verify firewall statussudo ufw status# Check fail2ban statussudo fail2ban-client status sshd# Check system updatesapt list --upgradable# View recent login attemptssudo tail /var/log/auth.log
```

[](#what-could-go-wrong)What Could Go Wrong
-------------------------------------------

**Locked out of SSH?** If you disabled password auth too early:

*   Use your VPS provider’s console/recovery mode
*   Re-enable `PasswordAuthentication yes` in `/etc/ssh/sshd_config.d/01-hardening.conf`
*   Restart SSH: `sudo systemctl restart ssh`

**Firewall blocked you?** From console:

```
sudo ufw delete allow 6203/tcpsudo ufw allow from YOUR_IP to any port 6203
```

[](#reality-check)Reality Check
-------------------------------

This takes 15-30 minutes first time. After a few servers, you’ll do it in under 10 minutes. Your server is now protected against 95% of automated attacks.

Next steps: Set up monitoring, backups, and whatever services you actually need. But now you can sleep knowing script kiddies aren’t getting in through the obvious holes.