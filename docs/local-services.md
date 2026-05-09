# Local services pattern (`*.test` + HTTPS)

This is the standard layout for any local-only service on this machine that
should resolve at a bare hostname (`rcc.test`, `admin.test`, ...) over HTTPS
with no browser warnings. RCC and the admin dashboard both use it; new
services should follow the same shape.

## Naming convention

```
~/dev/<NAME>/              project tree (or a parent like ~/dev/ideas/<NAME>)
<NAME>.test                hostname Caddy will serve
127.0.0.1:30NN             upstream port the app binds (3001, 3010, 3020, ...)
com.aorlando.<NAME>        LaunchAgent label and plist filename
~/Library/Logs/local-services/<NAME>.{out,err}.log
```

`<NAME>` is a short, lowercase, hyphen-free token (`rcc`, `admin`, `ledger`).
For a project at `~/dev/<NAME>/` it usually matches the directory name; for a
project that lives somewhere else (RCC is at `~/dev/ideas/research-reviewer/`
but the service is `rcc`), the LaunchAgent's `WorkingDirectory` points at
the actual path and the convention still holds elsewhere.

## Pieces

```
   browser
     |
     v
+---------+      *.test -> 127.0.0.1
| dnsmasq |  <-- /etc/resolver/test
+---------+
     |
     v
+---------+      80 (redirect -> 443) and 443 (TLS termination)
|  Caddy  |  <-- mkcert per-host cert
+---------+
     |
     v
+---------------+----------------+
|               |                |
v               v                v
127.0.0.1:3001  127.0.0.1:3028   127.0.0.1:30NN
RCC (Fastify)   admin (Next.js)  future-app
LaunchAgent     LaunchAgent      LaunchAgent
```

- **dnsmasq** answers `*.test -> 127.0.0.1`. Runs as a system LaunchDaemon
  (needs root for port 53). `/etc/resolver/test` tells macOS to ask
  `127.0.0.1:53` for any name ending in `.test`.
- **Caddy** owns ports 80 and 443. One mkcert cert covers all `*.test` hosts.
  Runs as a system LaunchDaemon (needs root for the privileged ports).
- **mkcert** generates the cert. Its root CA is in the System keychain so
  Chrome / Safari / Firefox trust `https://*.test` with no warning.
- Each app binds a high port on `127.0.0.1`. Caddy reverse-proxies to it.
  Each app runs as a per-user LaunchAgent so it starts at login and restarts
  on crash.

## File locations

| What                          | Where                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| Caddyfile (source of truth)   | `~/.config/local-services/Caddyfile`                                 |
| Caddyfile (brew expects here) | `/opt/homebrew/etc/Caddyfile` (symlink to the file above)            |
| mkcert root CA                | `~/Library/Application Support/mkcert/rootCA.pem` (in System keychain) |
| Per-host certs                | `~/.config/local-services/certs/rcc.test+N{,-key}.pem`               |
| dnsmasq config                | `/opt/homebrew/etc/dnsmasq.conf` (look for `address=/test/127.0.0.1`)|
| dnsmasq resolver hint         | `/etc/resolver/test`                                                 |
| Caddy plist (system)          | `/Library/LaunchDaemons/homebrew.mxcl.caddy.plist`                   |
| dnsmasq plist (system)        | `/Library/LaunchDaemons/homebrew.mxcl.dnsmasq.plist`                 |
| Per-service LaunchAgent       | `~/Library/LaunchAgents/com.aorlando.<NAME>.plist`                   |
| Per-service logs              | `~/Library/Logs/local-services/<NAME>.{out,err}.log`                 |
| Caddy logs                    | `/opt/homebrew/var/log/caddy.log`                                    |

The admin dashboard's existing plist
(`~/Library/LaunchAgents/com.user.admin.admin-dashboard-web.plist`) predates
this convention. New services should use `com.aorlando.<NAME>.plist`. The old
root proxy (`/Library/LaunchDaemons/com.user.admin.admin-dashboard-proxy.plist`)
was retired when Caddy took over port 80; the file is on disk for rollback
but is `bootout`-ed.

## Add a new service in 5 lines

Pick `<NAME>` (lowercase, hyphen-free) and `<PORT>` (high, free). The app
must already bind `127.0.0.1:<PORT>`.

```sh
NAME=myapp; PORT=3010

# 1. Re-issue the shared cert so it includes <NAME>.test (writes a new file).
cd ~/.config/local-services/certs && \
  ls *.pem 2>/dev/null && \
  mkcert rcc.test admin.test "${NAME}.test" "*.test" && \
  CERT=$(ls -t rcc.test+*.pem | grep -v key | head -1) && KEY="${CERT%.pem}-key.pem"

# 2. Append a Caddy block (cookie-cutter; only host + port differ).
cat >> ~/.config/local-services/Caddyfile <<EOF

${NAME}.test {
	tls /Users/aorlando/.config/local-services/certs/${CERT} /Users/aorlando/.config/local-services/certs/${KEY}
	encode zstd gzip
	reverse_proxy 127.0.0.1:${PORT}
}
EOF

# 3. Update every existing block's tls line to the new cert filenames
#    (they all share one cert), then reload Caddy.
sed -i '' "s|certs/rcc.test+[0-9]*.pem|certs/${CERT}|g; s|certs/rcc.test+[0-9]*-key.pem|certs/${KEY}|g" \
  ~/.config/local-services/Caddyfile && \
  sudo brew services reload caddy

# 4. Confirm.
curl https://${NAME}.test/   # 502 until the app is running, then 200.
```

To run the new service as an always-on daemon, copy
`~/Library/LaunchAgents/com.aorlando.rcc.plist` and edit the four placeholders
(`<NAME>`, `<WORKING_DIR>`, `<START_COMMAND_ARGS>`, `<PORT>`):

```sh
NAME=myapp
sed "s|com.aorlando.rcc|com.aorlando.${NAME}|g; s|/Users/aorlando/Library/Logs/local-services/rcc|/Users/aorlando/Library/Logs/local-services/${NAME}|g" \
  ~/Library/LaunchAgents/com.aorlando.rcc.plist \
  > ~/Library/LaunchAgents/com.aorlando.${NAME}.plist

# Edit WorkingDirectory, ProgramArguments, and RCC_PORT/your-port env var
# in the new plist, then:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aorlando.${NAME}.plist
```

## Common operations

```sh
# Reload Caddy after editing the Caddyfile (no downtime, no sudo)
caddy reload --config /opt/homebrew/etc/Caddyfile

# Restart RCC after a code or build change
pnpm --filter @rcc/web build
launchctl kickstart -k gui/$(id -u)/com.aorlando.rcc

# Tail RCC logs
tail -f ~/Library/Logs/local-services/rcc.out.log

# Tail Caddy logs
tail -f /opt/homebrew/var/log/caddy.log

# Stop / start the RCC daemon
launchctl bootout gui/$(id -u)/com.aorlando.rcc
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aorlando.rcc.plist
```

## Troubleshooting

**Browser shows "Not secure" or cert warning on `https://rcc.test/`**

The mkcert root CA is missing from the system trust store, or the cert
doesn't include this hostname. Run:

```sh
# Confirm root CA is trusted (should print one cert)
security find-certificate -c "mkcert" /Library/Keychains/System.keychain

# If empty, install the root CA (will prompt for sudo password)
mkcert -install

# Confirm the hostname is in the cert SANs
openssl x509 -in ~/.config/local-services/certs/$(ls ~/.config/local-services/certs/rcc.test+*.pem | grep -v key | head -1) \
  -noout -text | grep -A1 "Subject Alternative Name"
```

If the hostname is missing, regenerate the cert (see "Add a new service")
and reload Caddy.

**`dig rcc.test` returns nothing or NXDOMAIN**

`/etc/resolver/test` or dnsmasq is misconfigured.

```sh
# Should report "nameserver 127.0.0.1" under "domain : test"
scutil --dns | grep -B1 -A3 "domain.*: test$"

# Should answer 127.0.0.1
dig @127.0.0.1 anything.test +short

# If dig fails, restart dnsmasq
sudo brew services restart dnsmasq
sudo lsof -nP -iTCP:53 -sTCP:LISTEN   # confirm dnsmasq is on port 53
```

**`https://rcc.test/` returns 502 Bad Gateway**

Caddy is up but the upstream app is not. Check the LaunchAgent.

```sh
launchctl list | grep com.aorlando.rcc          # PID column should be a number
lsof -nP -iTCP:3001 -sTCP:LISTEN                # something should listen
tail -50 ~/Library/Logs/local-services/rcc.err.log
launchctl kickstart -k gui/$(id -u)/com.aorlando.rcc   # force restart
```

**`https://rcc.test/` returns connection refused**

Caddy is not listening. Check:

```sh
sudo lsof -nP -iTCP:443 -sTCP:LISTEN            # caddy should be there
sudo brew services list | grep caddy
caddy validate --config /opt/homebrew/etc/Caddyfile --adapter caddyfile
sudo brew services restart caddy
tail -50 /opt/homebrew/var/log/caddy.log
```

**Port 80 is in use by something else**

```sh
sudo lsof -nP -iTCP:80 -sTCP:LISTEN
# If it's not Caddy, stop the offending service. Common culprit on this
# machine was com.user.admin.admin-dashboard-proxy:
sudo launchctl bootout system/com.user.admin.admin-dashboard-proxy
sudo brew services restart caddy
```

**`pnpm dev` for RCC fails because port 3001 is taken**

The RCC LaunchAgent owns 3001 in production. Stop it before running `pnpm dev`:

```sh
launchctl bootout gui/$(id -u)/com.aorlando.rcc
pnpm dev    # now 3001 is free; Vite still uses 5173 with /api proxy

# When done, bring the daemon back:
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aorlando.rcc.plist
```

## Notes

- The `127.0.0.1 admin.test` and `::1 admin.test` lines in `/etc/hosts` are
  now redundant (dnsmasq handles `*.test`). They are harmless and were left
  in place; remove them whenever it's convenient.
- The shared cert is good through 2028-08-09. mkcert will not auto-renew;
  rerun `mkcert ...` from `~/.config/local-services/certs/` before then.
- The cert filename includes the SAN count (`rcc.test+2.pem` for "rcc.test +
  admin.test + *.test"). Adding a new service via "Add a new service" above
  bumps the count; the `sed` step rewrites every Caddy block to the new
  filename in one shot.
- Caddy's symlink at `/opt/homebrew/etc/Caddyfile -> ~/.config/local-services/Caddyfile`
  exists because the brew formula's plist hard-codes that path. Edit the
  source file at `~/.config/local-services/Caddyfile`; do not edit
  `/opt/homebrew/etc/Caddyfile` directly.
