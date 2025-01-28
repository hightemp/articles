# Running NixOS from any Linux Distro in systemd-nspawn Containers
![](https://nixcademy.com/_astro/container-spaceship.4ADglKlf_1O2fu6.webp)

📆 Tue Aug 29 2023 by Jacek Galowicz

(10 min. reading time)

When showing Nix or NixOS to newcomers, the first instinct is often to run the [NixOS Docker image](https://hub.docker.com/r/nixos/nix) on [Docker](https://www.docker.com/) or [Podman](https://podman.io/). This week we’re having a look at how to do the same with [systemd’s](https://systemd.io/) `systemd-nspawn` facility via the `machinectl` command. This has huge benefits to both trying out NixOS and also professionally using it like a sidecar VM, as we shall see. If you’re using Ubuntu, Debian, Fedora, Rocky Linux, or similar, jump right in!

What’s Wrong with Docker?
-------------------------

One might first ask “What’s wrong with Docker or Podman?” - there are multiple downsides when trying out/using Nix(OS) through Docker:

As changes to Docker images are not persistent, we have to create our own [`Dockerfile`](https://docs.docker.com/engine/reference/builder/) to make changes to the container persistent - or clone the running image manually. This starts fine when installing some packages. When developing in that container, the nix store fills up with downloaded and built packages - just to be dropped again on the next restart of that container. This results in recurringly long build times, although Nix is known for its great build-accelerating caching functionality! Both systems do not seem to be designed for each other.

In addition to that, NixOS comes with great facilities that make it easy to configure multiple systemd units for each service, lock them down with a secure configuration individually and make them work together. Docker/Podman have a completely different philosophy, where each container runs exactly one process and then they are combined via [docker-compose](https://docs.docker.com/compose/).

While this is generally fine and also integrated well in the Nix tool [`arion`](https://docs.hercules-ci.com/arion/), the tradeoff is that NixOS is only used for its huge package collection, but its strength for composable system configuration remains unused.

The Alternative: systemd-nspawn
-------------------------------

If you’re reading this on a GNU/Linux machine, chances are extremely high that you had it installed even before Docker or Podman: For quite some time now, `systemd` has come with the `systemd-nspawn` command, which has some similarities to the much older [`chroot`](https://en.wikipedia.org/wiki/Chroot) command. `systemd-nspawn` accepts the path to the root of the file system of another Linux distribution and, just like Docker/Podman, launches a new process inside it. The delusion that the new process lives inside the file system of a completely different Linux distribution and the absence of all other host processes including a new hostname is created using [Linux namespaces](https://en.wikipedia.org/wiki/Linux_namespaces).

![](https://nixcademy.com/_astro/systemd-logo.BxTNJES9_2o1W6H.webp)

While most Linux container technologies use namespaces, `systemd-nspawn` goes one step further and runs a normal `systemd` process that then creates its own process _tree_ inside the container. This way the inside of the container does not feel like a single process running in another distro’s file system, but it’s essentially its own full GNU/Linux with services without its own kernel.

Running the NixOS nspawn Image
------------------------------

Let’s have a look at this prepared [repository on GitHub with a NixOS nspawn image](https://github.com/tfc/nspawn-nixos) that is nearly as simple to try out as the NixOS docker image. If you have the command `machinectl` installed, you can start following the next steps without any further preparation!

`systemd-nspawn` comes with the command `machinectl` which models a comfortable wrapper that makes it easy to pull nspawn images from the internet and run them like services. Running this image with `machinectl` is nearly as easy as running Docker images:

First, we `pull-tar` the image from the internet. Then we `start` it, which launches it in the background. Please note that `machinectl` commands need to be run as root:

```
machinectl pull-tar https://github.com/tfc/nspawn-nixos/releases/latest/download/nixos-system-x86_64-linux.tar.xz nixos --verify=no
machinectl start nixos 
```

> The `--verify=no` argument is necessary because there is neither a signature nor upload of a `SHA256SUMS` file at the same URL. That is a task for another day.

This specific image has no root password set, which we can do with `passwd`. Finally, we can open a root shell using the `login` subcommand of `machinectl`:

```
machinectl shell nixos /usr/bin/env passwd
machinectl login nixos 
```

The difference between `machinectl shell` and `machinectl login` is, that the `shell` subcommand simply starts a process inside the namespace of our container, while `login` really logs into the container’s system.

After using `machine login ...` to log into a container, the “connection” to the container can be closed by pressing `<ctrl> + ]` three times.

If you don’t want to try it out yourself right now, have a look at this screenshot to see what it looks like:

![](https://nixcademy.com/_astro/nixos-nspawn-pull-start.UKzSkdl0_Z2liXqy.webp)

Running these commands does not feel very spectacular, although the system in the container _boots_ extremely quickly. `machinectl status nixos` shows us the status of a booted image. Here, we can nicely observe that there is a whole process **tree** running in the container, which is much different from standard usage of Docker images:

```
# machinectl status nixos
nixos(e2bb44c36c4246049d7eff6cb6e10d7d)
 Since: Mon 2023-08-28 21:38:23 CEST; 36s ago
 Leader: 741701 (systemd)
 Service: systemd-nspawn; class container
 Root: /var/lib/machines/nixos
 Iface: ve-nixos
 OS: NixOS 23.11 (Tapir)
 UID Shift: 819658752
 Unit: systemd-nspawn@nixos.service
 ├─payload
 │ ├─init.scope
 │ │ └─741701 /run/current-system/systemd/lib/systemd/systemd
 │ └─system.slice
 │   ├─console-getty.service
 │   │ └─742127 agetty --login-program /nix/store/hlzi9rwycvpf907r5jhhl6v7090108sc-shadow-4.13/bin/login --noclear --keep-baud console 115200,38400,9600 vt220
 │   ├─dbus.service
 │   │ └─742084 /nix/store/ai87d2awsm4xasaly144cjwk2k2b815l-dbus-1.14.8/bin/dbus-daemon --system --address=systemd: --nofork --nopidfile --systemd-activation --syslog-only
 │   ├─dhcpcd.service
 │   │ ├─742016 "dhcpcd: [manager] [ip4] [ip6]"
 │   │ ├─742017 "dhcpcd: [privileged proxy]"
 │   │ ├─742018 "dhcpcd: [network proxy]"
 │   │ └─742019 "dhcpcd: [control proxy]"
 │   ├─nscd.service
 │   │ └─742012 /nix/store/nd4yn9v9561ss4xcpr9166n02pddb0cg-nsncd-unstable-2022-11-14/bin/nsncd
 │   ├─systemd-journald.service
 │   │ └─741925 /nix/store/sabybrrms75zv55a3nx2qsfyp9h5jbr3-systemd-253.6/lib/systemd/systemd-journald
 │   └─systemd-logind.service
 │     └─742040 /nix/store/sabybrrms75zv55a3nx2qsfyp9h5jbr3-systemd-253.6/lib/systemd/systemd-logind
 └─supervisor
 └─741695 systemd-nspawn --quiet --keep-unit --boot --link-journal=try-guest --network-veth -U --settings=override --machine=nixos
Aug 28 21:38:23 jongepad systemd-nspawn[741695]: [  OK  ] Reached target Network.
Aug 28 21:38:23 jongepad systemd-nspawn[741695]:          Starting Permit User Sessions...
Aug 28 21:38:23 jongepad systemd-nspawn[741695]: [  OK  ] Finished Permit User Sessions.
Aug 28 21:38:23 jongepad systemd-nspawn[741695]: [  OK  ] Started Console Getty.
Aug 28 21:38:23 jongepad systemd-nspawn[741695]: [  OK  ] Reached target Login Prompts.
Aug 28 21:38:29 jongepad systemd-nspawn[741695]:
Aug 28 21:38:29 jongepad systemd-nspawn[741695]:
Aug 28 21:38:29 jongepad systemd-nspawn[741695]: <<< Welcome to NixOS 23.11.20230826.5237477 (x86_64) - console >>>
Aug 28 21:38:29 jongepad systemd-nspawn[741695]:
Aug 28 21:38:29 jongepad systemd-nspawn[741695]: 
```

The resource usage is low anyway, but if we want to pause it, we can run `machinectl stop nixos`. If we don’t like it any longer, we can even run `machinectl remove nixos`. The machine can also be scheduled to be run automatically at every boot using `machinectl enable nixos`.

Further Configuration
---------------------

What else to do from here? We can use this like any other NixOS machine, install packages, configure services, etc. but before that, we might need to allow the container to access the internet. We can also configure file sharing between the host and container.

### Internet Access

We might want to access the internet, for which systemd provides different ways. The simplest way to enable internet access is to share the host’s network with the container. To do this, just create the config file `/etc/systemd/nspawn/nixos.nspawn` with the following content:

```
[Network]
VirtualEthernet=no 
```

Or use this shell one-liner:

```
printf "[Network]\nVirtualEthernet=no" > /etc/systemd/nspawn/nixos.nspawn 
```

We need to run `machinectl reboot nixos` once after changing this configuration file.

Regarding port forwarding, we don’t need to do anything: All the ports that we open on the container are also open on the host, as they are the same. The only limitation is that we can’t open ports smaller than 1024 in the container. We can connect via `localhost` both from the container to the host and vice versa.

More complex network configurations allow for more fine grained settings. Please also refer to the [_Network_ section of the `systemd.nspawn` configuration file format documentation](https://man7.org/linux/man-pages/man5/systemd.nspawn.5.html#%5BNETWORK%5D_SECTION_OPTIONS).

### NixOS Configuration

Now, we can edit the NixOS configuration file `/etc/nixos/configuration.nix` in the container’s file system. We can do that either from inside the container or from the host, as the container paths are all below `/var/lib/machines/<machine name>`. For the configuration file, the full host path is `/var/lib/machines/nixos/etc/nixos/configuration.nix`.

After every configuration change, we typically run `nixos-rebuild switch` to rebuild the system the nix way and activate the new configuration. It nearly feels like the real deal.

Let’s quickly configure a web server by adding two lines to `/etc/nixos/configuration.nix`:

```
{ pkgs, modulesPath, ... }:
{
 # ...rest of the config is truncated for clarity...
 services.nginx = {
 enable = true;
 virtualHosts.default.listen = [ { port = 9000; addr="0.0.0.0"; } ];
 };
} 
```

Then, we rebuild the system:

```
[root@nixos:~]# nixos-rebuild switch
warning: creating lock file '/etc/nixos/flake.lock'
building the system configuration...
stopping the following units: nscd.service, resolvconf.service
NOT restarting the following changed units: console-getty.service, container-getty@1.service, systemd-journal-flush.service, systemd-logind.service, systemd-update-utmp.service, systemd-user-sessions.service, user-runtime-dir@0.service, user@0.service
activating the configuration...
mount: /dev: permission denied.
 dmesg(1) may have more information after failed mount system call.
mount: /dev/pts: permission denied.
 dmesg(1) may have more information after failed mount system call.
mount: /dev/shm: permission denied.
 dmesg(1) may have more information after failed mount system call.
mount: /run: permission denied.
 dmesg(1) may have more information after failed mount system call.
Activation script snippet 'specialfs' failed (32)
setting up /etc...
restarting systemd...
reloading user units for root...
setting up tmpfiles
reloading the following units: dbus.service
restarting the following units: nix-daemon.service, systemd-journald.service
starting the following units: nscd.service, resolvconf.service
the following new units were started: nginx.service
warning: error(s) occurred while switching to the new configuration
[root@nixos:~]# systemctl status nginx.service
● nginx.service - Nginx Web Server
 Loaded: loaded (/etc/systemd/system/nginx.service; enabled; preset: enabled)
 Active: active (running) since Tue 2023-08-29 10:23:45 CEST; 21s ago
 Process: 11753 ExecStartPre=/nix/store/lv0psgdbcv360qmgcz3dbmzz7810bf3x-unit-script-nginx-pre-start/bin/nginx-pre-start (cod>
 Main PID: 11803 (nginx)
 CGroup: /system.slice/nginx.service
 ├─11803 "nginx: master process /nix/store/i710dxxlgczlk56wx3d1hg69ci85cf6k-nginx-1.24.0/bin/nginx -c /nix/store/7iw>
 └─11807 "nginx: worker process"
Aug 29 10:23:45 nixos systemd[1]: Starting Nginx Web Server...
Aug 29 10:23:45 nixos nginx-pre-start[11799]: nginx: the configuration file /nix/store/7iwjk2b4qya42ijmd3ijv6qbv0w5rx6k-nginx.co>
Aug 29 10:23:45 nixos nginx-pre-start[11799]: nginx: configuration file /nix/store/7iwjk2b4qya42ijmd3ijv6qbv0w5rx6k-nginx.conf t>
Aug 29 10:23:45 nixos systemd[1]: Started Nginx Web Server. 
```

(Don’t mind the error messages about the mounts. They don’t break anything.)

Nice, this works as expected, as opening the page on the host’s browser demonstrates:

![](https://nixcademy.com/_astro/localhost-browser.DnA3xxDW_ZCOcec.webp)

If you’re using NixOS on your production servers already, this makes it very easy to reuse portions of their NixOS configurations locally for development. Or the other way around: We can design and test NixOS configuration modules locally, before reusing them on production servers.

### File Sharing Between Host and Container

If we want to share folders between host and guest, we can simply create mappings between host paths and container paths like this in the `/etc/systemd/nspawn/nixos.nspawn` configuration file:

```
[Files]
Bind=/some/path/in/host:/some/path/in/container 
```

The `BindReadOnly` option works the same way but makes the bind mount read-only for the container.

There are many more options in the [_Files_ section of the `systemd.nspawn` configuration file format documentation](https://man7.org/linux/man-pages/man5/systemd.nspawn.5.html#%5BFILES%5D_SECTION_OPTIONS).

Summary and Outlook
-------------------

In this tutorial-like article, we learned, how to quickly run a nearly full instance of NixOS on any GNU/Linux distribution that uses systemd (e.g. Ubuntu, Debian, Fedora, Rocky Linux, etc…).

This NixOS instance can be configured to our needs and also be run like a sidecar to our normal host system. systemd can treat it like a system service that boots up by default with the host system, using `machinectl enable nixos`.

All changes in this system remain persistent over restarts. systemd/`machinectl` comes with facilities and settings to change that: We can configure a machine to our needs and then make it _ephemeral_ (resetting itself each time) like Docker images are by default. We can also export it with the `machinectl export-tar` subcommand to share it with colleagues and customers.

The next step is the automation of the whole system deployment by putting the container configuration into the host configuration. This way there are no manual steps necessary in setting the system up. We will see in the next blog article, how to do that.

Of course, an in-depth tour into the world of NixOS and containers can be part of [every Nixcademy class](https://nixcademy.com/), specifically tailored to your corporate requirements!