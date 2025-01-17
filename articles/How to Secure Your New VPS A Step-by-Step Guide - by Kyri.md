# How to Secure Your New VPS: A Step-by-Step Guide - by Kyri
[

![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fed2055c5-2a8c-485e-af0c-cafaec780dd7_870x580.jpeg)



](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fed2055c5-2a8c-485e-af0c-cafaec780dd7_870x580.jpeg)

No trespassing allowed

So, your $5 VPS just arrived. All you've got is an IP address, a username, and a password. Now what?

In this guide, I'll walk you through fortifying your VPS from zero to hero—covering essential security measures and then going beyond the basics to create a secure environment. We'll tackle everything from user management and SSH configuration to setting up a firewall and implementing a couple handy automations to keep your server in top shape.

**Note**: This guide is tailored for Ubuntu servers and assumes you've gone with a budget VPS provider—the kind that typically leaves most of the setup to you. If you're running on a big-name cloud platform like AWS or Azure, you might find some parts of this guide redundant, as they often come with pre-configured settings.

Start by connecting to your VPS using the IP address and credentials from your hosting provider:

```
$ ssh root@12.34.56.78
```

> _Replace the user and IP address with the one from your provider._

Enter the password when prompted.

Once you're in, update your server to the latest software versions:

```
$ sudo apt update 
$ sudo apt upgrade 
```

This ensures you're working with the most recent, secure versions of all installed packages.

If your hosting service provided you with a _root_ user, it's crucial to create a separate user for connecting and running your services:

```
$ sudo adduser username
```

> _Replace 'username' with your preferred username_

You'll be prompted to set and confirm a password for the new user. You'll also be asked for additional information - all of this is optional, so feel free to skip by pressing Enter.

Next, grant the new user sudo privileges:

```
$ sudo usermod -aG sudo username
```

Now, switch to the new user and verify sudo access:

```
$ su - username
$ sudo whoami
```

If the last command returns _root_, you've successfully set up sudo access for your new user.

You initially connected to the server using password authentication. Now, we'll switch to key-based authentication for improved security.

**On your local machine**, generate an SSH key pair:

```
$ ssh-keygen -t ed25519 -C "email@example.com"
```

> _Replace ‘email@example.com’ with your own address_

Press Enter to save the key in the default location. You can optionally enter a passphrase - if you do, you'll need to type it each time you SSH to the VPS. I personally leave it empty for convenience.

Next, from your local machine, copy your public key to your VPS:

```
$ ssh-copy-id -i ~/.ssh/ed25519.pub username@12.34.56.78
```

> _Replace 'username' with the user you created earlier._

Enter the user's password when prompted.

Verify that you can connect using the new key:

```
$ ssh -i ~/.ssh/ed25519 -o PasswordAuthentication=no username@12.34.56.78
```

To avoid specifying the path of the key each time, add it to your local SSH agent:

```
$ eval "$(ssh-agent -s)"
$ ssh-add ~/.ssh/ed25519
```

Now you can SSH to your VPS simply with:

```
$ ssh username@12.34.56.78
```

(Optional) For even more convenience, add an alias to your ~/.bashrc or ~/.zshrc:

```
alias ssh-vps='ssh username@12.34.56.78'
```

Save and close the file. Then, source the configuration into your current session:

```
$ source ~/.zhsrc
```

Now you can connect to your VPS by simply typing `ssh-vps` in your terminal.

Now that you've enabled SSH key access, it's time to disable password authentication and root login. First, connect to your VPS using the new user:

```
$ ssh username@12.34.56.78
```

Open the SSH daemon configuration file:

```
$ sudo vim /etc/ssh/sshd_config
```

Make the following changes:

1.  Find `PermitRootLogin yes` and change it to `PermitRootLogin no`.
    
2.  Find `ChallengeResponseAuthentication` and set it to `no`.
    
3.  Locate `PasswordAuthentication` and set it to `no`.
    
4.  Find `UsePAM` and set it to `no`.
    

Your `sshd_config` file should now include these lines:

```
PermitRootLogin no
ChallengeResponseAuthentication no
PasswordAuthentication no
UsePAM no
```

Save and close the file.

⚠️ **Caution:** Before proceeding, ensure you've created a non-root user and set up SSH key authentication as detailed in the previous section, or you risk permanently locking yourself out of your VPS.

Apply the new configuration by restarting the SSH daemon:

```
$ sudo service sshd reload
```

Verify that root login is now disabled. **From your local machine**, attempt to log in as root:

```
$ ssh root@12.34.56.78
```

This should fail with a _Permission denied_ error message.

A firewall is crucial for preventing unauthorized access to your VPS ports. We'll follow the principle of least privilege, opening only the ports we need.

Install UFW (Uncomplicated Firewall):

```
$ sudo apt install ufw
```

Check the firewall status:

```
$ sudo ufw status verbose
```

**It should be inactive. If not, disable it temporarily:**

```
$ sudo ufw disable
```

List known UFW app policies:

```
$ sudo ufw app list
```

**Allow OpenSSH (this is critical to maintain access)**:

```
$ sudo ufw allow 'OpenSSH'
```

**⚠️ Double-check that OpenSSH is allowed** (this prevents lockouts):

```
$ sudo ufw show added
```

You should see the following:

```
ufw allow OpenSSH
```

**Do not proceed unless you see this.**

Set default rules:

```
$ sudo ufw default deny incoming 
$ sudo ufw default allow outgoing
```

This allows all outgoing traffic but denies all incoming traffic (except SSH).

(Optional) If you’re planning to run a web server, allow ports 80 and 443:

```
$ sudo ufw allow 'Nginx Full'
```

Finally, enable the firewall:

```
$ sudo ufw enable
```

⚠️ **Caution:** The system may warn about disrupting SSH connections. If you've confirmed OpenSSH is allowed (as we did earlier), it's safe to proceed—enter 'y' when prompted.

Verify the firewall is running:

```
$ sudo ufw status verbose
```

```
Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp (OpenSSH)           ALLOW IN    Anywhere
22/tcp (OpenSSH (v6))      ALLOW IN    Anywhere (v6)
```

Your VPS is now protected by a firewall.

Fail2Ban monitors your authentication logs and bans IP addresses that make too many failed login attempts. We'll configure it to monitor SSH connection attempts.

Install Fail2ban:

```
$ sudo apt install fail2ban
```

Check its status (it should be disabled by default):

```
$ sudo systemctl status fail2ban.service
```

```
○ fail2ban.service - Fail2Ban Service
     Loaded: loaded (/lib/systemd/system/fail2ban.service; disabled; vendor preset: enabled)
     Active: inactive (dead)
       Docs: man:fail2ban(1)
```

Before enabling it, you’ll configure Fail2Ban to monitor SSH access logs.

Navigate to the Fail2Ban config directory:

```
$ cd /etc/fail2ban
```

Create a local configuration file:

```
$ sudo cp jail.conf jail.local
```

Edit the local configuration:

```
$ sudo vim jail.local
```

In the `[sshd]` section, add or modify these lines:

```
[sshd]
enabled = true
mode = aggressive
...
```

This enables SSH monitoring and sets the mode to aggressive, which applies stricter rules to cover a broader range of potential threats.

Feel free to explore and adjust other settings as needed. The defaults are generally suitable for most cases. When you’re done, save and close the file.

Enable Fail2Ban to run on system startup:

```
$ sudo systemctl enable fail2ban
```

Start Fail2Ban manually:

```
$ sudo systemctl start fail2ban
```

Verify it’s running:

```
$ sudo systemctl status fail2ban
```

(Optional) To verify Fail2Ban is working, you can attempt to connect repeatedly with an invalid SSH key. The error should change from _Permission denied_ to _Connection refused_ when banned. **Warning:** Perform this test from a different machine than your local one to avoid locking yourself out. If you do get locked out, the default ban time is 10 minutes.

Your VPS now has an additional layer of protection against brute-force attacks.

Ubuntu provides `unattended-upgrades`, a tool that automatically retrieves and installs security patches and essential upgrades for your server.

Install it (if not pre-installed):

```
$ sudo apt install unattended-upgrades
```

Verify it’s running:

```
$ sudo systemctl status unattended-upgrades.service
```

(Optional) Configure automatic reboots. Some upgrades require a reboot to take effect. By default, automatic reboots are disabled. To change this, open its configuration file:

```
$ sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
```

Find the line `Unattended-Upgrade::Automatic-Reboot` and set it to `true`.

⚠️ **Caution:** Enabling automatic reboots will make your VPS and its services temporarily unavailable during reboots. Personally, I keep this disabled and reboot manually when needed. When you SSH into the VPS, you'll see a message if a reboot is required for updates.

If you made changes, reload the service:

```
$ sudo systemctl reload unattended-upgrades.service
```

Your VPS will now automatically stay up-to-date with the latest security patches and essential upgrades.

Congratulations on making it this far! Your VPS is now in significantly better shape than when you started. Let's recap what you've accomplished:

1.  Updated your server's software to the latest version
    
2.  Disabled password authentication and set up a more secure key-based authentication mechanism
    
3.  Added a firewall to control access to your server's ports
    
4.  Installed Fail2Ban to automatically block IP addresses making unauthorised connection attempts
    
5.  Configured automatic security upgrades and patches
    

You've transformed your bare-bones VPS into a robust, secure environment. Now you're ready to start deploying your SaaS with confidence.

Until next time, happy and secure hosting!

Thank you for reading Bootstrap & Build! This post is public so feel free to share it.

[Share](https://www.kkyri.com/p/how-to-secure-your-new-vps-a-step-by-step-guide?utm_source=substack&utm_medium=email&utm_content=share&action=share)

### Subscribe to Bootstrap & Build

Practical insights at the intersection of software engineering, bootstrapping, and self-hosting. Empowering indie hackers to own their infrastructure and business.