# otr.to TURN relay

When two browsers find no direct route to each other, for example because both
sit behind a strict NAT, the chat goes through this relay instead:
[coturn](https://github.com/coturn/coturn) on the VPS that also runs the
tunnelprobe TCP fingerprint server. Everything it relays is end-to-end
encrypted, so it sees addresses, timing and sizes, never a message.

| Port        | Protocol    | Purpose                                    |
| ----------- | ----------- | ------------------------------------------ |
| 3478        | UDP and TCP | TURN, and STUN for whoever asks            |
| 61000–65535 | UDP         | Relay addresses, one per browser connection |

There is no TURN over TLS. Port 443 belongs to tunnelprobe, and TLS on 5349
would get through hardly any firewall that stops 3478, while its certificate
would bring certbot hooks that restart tunnelprobe too.

## Next to the other service

The relay stays out of tunnelprobe's way:

- Its own unit (`otr-turn.service`), directory (`/opt/otr-turn`), upload
  folder (`~/otr-turn-upload`) and sudo rule. Nothing of tunnelprobe is read or
  changed.
- Its own ports. The relay ports sit above the range Linux hands out for
  outgoing connections (32768–60999), so they never take one another program
  is about to use.
- coturn comes from the distribution, but its packaged `coturn.service` stays
  masked, so neither the install nor an upgrade starts it with the stock
  configuration.
- At most half a CPU core and 256 MB of memory, and at most 200 Mbit/s of
  relayed traffic each way (see [Settings](#settings)).

## Setup (once, on the VPS)

The VPS is already set up for tunnelprobe, with the user `deploy`. What the
relay needs on top:

1. **DNS.** An A record `turn.otr.to` pointing to the IPv4 of the VPS, and an
   AAAA record to its IPv6 if it has one. At Cloudflare, set them to "DNS
   only" (grey cloud): TURN does not go through Cloudflare's proxy.

2. **Firewall.** If the hosting provider has a firewall in front of the VPS,
   open 3478 for UDP and TCP and 61000–65535 for UDP there. A ufw on the VPS
   itself needs nothing, the install script opens the ports when ufw is on.

3. **sudo for the deploy.** A second rule for `deploy`, next to tunnelprobe's.
   The file name must not contain a dot, sudo skips such files:

   ```bash
   echo 'deploy ALL=(root) NOPASSWD: /usr/bin/bash /home/deploy/otr-turn-upload/deploy/install.sh /home/deploy/otr-turn-upload *' | sudo tee /etc/sudoers.d/otr-turn-deploy >/dev/null
   sudo chmod 440 /etc/sudoers.d/otr-turn-deploy
   sudo visudo -cf /etc/sudoers.d/otr-turn-deploy
   sudo -l -U deploy
   ```

   `sudo -l -U deploy` must now list both install commands.

4. **SSH key.** The tunnelprobe key works, since it is the same user. A key of
   its own can be revoked without cutting off the other deploy. Created on your
   own machine:

   ```bash
   ssh-keygen -t ed25519 -N '' -C github-actions-otr-turn -f otr-turn-deploy
   ```

   On the VPS, add it below the existing key, with the same restrictions:

   ```bash
   echo "restrict $(cat otr-turn-deploy.pub)" | sudo tee -a /home/deploy/.ssh/authorized_keys >/dev/null
   ```

   Paste the content of `otr-turn-deploy.pub` in place of
   `$(cat otr-turn-deploy.pub)` if the file isn't on the VPS. The limit from
   tunnelprobe's setup applies to this key too: `deploy` owns the uploaded
   install scripts, so whoever holds either key can become root.

5. **Secrets** in this repository under Settings, Secrets and variables,
   Actions. They are the same as tunnelprobe's, apart from the key if you made
   a new one:

   | Secret            | Content                                                                         |
   | ----------------- | ------------------------------------------------------------------------------- |
   | `VPS_HOST`        | IP of the VPS                                                                   |
   | `VPS_USER`        | `deploy`                                                                        |
   | `VPS_SSH_KEY`     | The private key, the whole content of `otr-turn-deploy`                         |
   | `VPS_KNOWN_HOSTS` | Recommended, the host key of the VPS, the same value as in tunnelprobe          |
   | `VPS_PORT`        | Optional, default 22                                                            |

   For `VPS_KNOWN_HOSTS`, print the key on the VPS itself, so nothing can sit
   in between: `echo "<IP> $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"`,
   with a port other than 22 as `[<IP>]:<port>`. The host must be written
   exactly as in `VPS_HOST`. Without this secret the workflow accepts the host
   key unverified.

## Deploy

[`deploy-turn.yml`](../.github/workflows/deploy-turn.yml) runs after every push
to `main` that changes `turn/`, and manually through "Run workflow" (it only
deploys from `main`). First it runs
[`turn-tests.yml`](../.github/workflows/turn-tests.yml), shared with CI, which
runs the real install script on a GitHub runner: a first install, an update,
and a broken version that has to roll back. Then it uploads `turn/` over SSH
and calls `deploy/install.sh`, which

- masks `coturn.service` and installs coturn if it is missing, and stops if a
  `coturn.service` is already running, since that one belongs to someone else,
- opens the ports in ufw if ufw is on,
- puts the version in `/opt/otr-turn/releases/<time>-<commit>`, points
  `/opt/otr-turn/current` at it, installs `otr-turn.service` and restarts it,
- asks the relay for an allocation over UDP and over TCP, with the credentials
  from `turnserver.conf`, the way a browser does (`deploy/healthcheck.py`). If
  that fails, even when the restart itself failed, the previous version runs
  again and the workflow fails. If the relay hands out an address that is not
  public, the deploy warns: the VPS is behind NAT and needs `external-ip`,
- keeps the last three versions.

Without GitHub, the same works from a checkout on the VPS, with a new version
name each time:
`sudo bash turn/deploy/install.sh turn "manual-$(date +%Y%m%d-%H%M%S)"`.

Check the service with `systemctl status otr-turn`. From outside, the
[Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
page tests it from your browser: add `turn:turn.otr.to:3478` with the user
`otr` and the password from `turnserver.conf`, gather, and look for candidates
of the type `relay`.

## Credentials

There is one user, `otr`, and the web app ships its password, so it is public
by nature. It only keeps the relay from being open to anyone who does not
look; the limits below keep it from being worth abusing. To change it, change
`user=` in [`turnserver.conf`](turnserver.conf) and the TURN entry in
[`src/Chat.tsx`](../src/Chat.tsx) together; a Jest test fails while the two
disagree. Tabs that are open with the old app keep the old password and get no
relay until they are reloaded.

## Settings

All in [`turnserver.conf`](turnserver.conf), every deploy copies it again.

| Setting                  | Value       | Meaning                                                                                                                                                                                       |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `max-bps`                | 250000      | Bytes per second for one allocation, each way (2 Mbit/s): plenty for a chat and its files, too little for video.                                                                             |
| `bps-capacity`           | 25000000    | Bytes per second for all allocations together, each way (200 Mbit/s), which is 100 allocations at full speed. Every browser holds two per person it chats with, relayed or not. Past that, new ones get what is left, then none. |
| `min-port`, `max-port`   | 61000–65535 | Relay ports.                                                                                                                                                                                  |
| `external-ip`            | not set     | Only for a VPS behind NAT, whose network card has no public address: `external-ip=<public IP>/<private IP>`.                                                                                  |

## Privacy and abuse

- No logs of who used it. coturn writes a line with the addresses for every
  allocation, but `otr-turn.service` keeps only warnings and errors
  (`LogLevelMax=warning`), so those lines never reach the journal.
- It relays UDP between browsers and nothing else: no TCP relay, and no
  relaying into loopback, private, link-local, multicast or reserved networks.
- One allocation gets at most 2 Mbit/s, all together at most 200 Mbit/s.
