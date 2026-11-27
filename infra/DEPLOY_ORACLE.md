# Deploy on Oracle Cloud Always Free

```
Internet -> Caddy (HTTPS) -> frontend -> backend -> job-service / media-service -> Neon
```

Everything runs on one server with Docker Compose. Provider limits change: check them before you start.

## Stay free

- Do **not** upgrade the Oracle account to Pay As You Go. Oracle's docs say the signup card is not charged unless you upgrade. It may place a temporary hold to verify the card.
- A new account also gets a 30-day trial with credits. Create only items labelled **Always Free-eligible**, so nothing depends on the trial.
- One A1 server: at most **2 OCPUs and 12 GB**. All boot and block volumes together: at most **200 GB**. Create them in your **home region**.
- Neon, DuckDNS and the Caddy certificate: use the free options. Do not add a paid plan anywhere.
- Oracle may reclaim an idle server: over 7 days, CPU (95th percentile), network and memory use all under 20%. A quiet demo site can meet this. Keep your code on GitHub and your `infra/.env` values somewhere safe. Accounts and job history are in Neon; videos exist only on the server.

## 1. Neon

Create a free project in a region near your Oracle region. In the SQL Editor run, one at a time:

```sql
CREATE DATABASE jobs_db;
CREATE DATABASE media_db;
```

Click **Connect**, turn **Connection pooling** off, and note the host, user and password.

## 2. Push the code

Commit and push from your PC. Note the branch name.

## 3. Create the Oracle server

1. Sign up for Oracle Cloud Free Tier. Choose the home region carefully: it can't be changed.
2. **Compute -> Instances -> Create instance**.
3. Image: **Ubuntu 24.04**. Shape: **Ampere -> VM.Standard.A1.Flex**, **2 OCPUs, 12 GB**.
4. Networking: a public subnet, with a public IPv4 address.
5. SSH keys: download the private key and keep it safe.
6. Boot volume: 100 GB is plenty (under the 200 GB total).
7. Check that the shape shows **Always Free-eligible**, then create it. If you get "out of capacity", try again later.

## 4. Open the web ports

In the instance's subnet, open its **Security List** and add two ingress rules: source `0.0.0.0/0`, protocol TCP, destination port `80`, and the same for `443`. Keep port 22 for SSH. Do not open 5000, 8080, 8081, 8082 or 5432.

## 5. Free hostname

At duckdns.org, create a subdomain and set its IP to the server's public IP.

## 6. Install Docker

From your PC:

```powershell
ssh -i C:\path\to\private.key ubuntu@SERVER_IP
```

On the server:

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Connect again, then check `docker compose version` (2.24 or newer).

## 7. Get the code and set the secrets

```bash
git clone -b YOUR_BRANCH https://github.com/YOUR_USER/YOUR_REPO.git infiniteflow
cd infiniteflow
cp infra/.env.example infra/.env
chmod 600 infra/.env
openssl rand -hex 32   # run twice: INTERNAL_KEY and AUTH_SECRET
nano infra/.env
```

A private repo needs a GitHub token or deploy key to clone. In the database URLs, URL-encode special characters in the password.

## 8. Start

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml ps
```

Always use **both** `-f` files. With only the first, port 5000 is opened and default secrets are used.
The first build takes a while.

## 9. Test

Open `https://YOUR_DOMAIN`. Register, upload a short video, watch the progress, then download the result.
`/api/health` shows whether the services are running. It does not check the database in this setup.

## Update later

```bash
cd infiniteflow && git pull
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
```

Running jobs fail when job-service restarts, so update when it is idle.

## If something fails

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml logs --tail=100 SERVICE
```

| Problem | Check |
| --- | --- |
| No HTTPS certificate (`caddy` logs) | DuckDNS IP, `DOMAIN`, and the ingress rules for 80 and 443 |
| Site times out but Caddy is running | The server's own firewall: `sudo iptables -L INPUT -n --line-numbers` |
| A Java service keeps restarting | The database URLs in `infra/.env` |
| Disk is full | `df -h`; delete old videos in the app; `docker image prune` |

The site is public: anyone can sign up or upload as a guest, and uploads (500 MB each at most) use your disk.
Videos are never deleted automatically.
