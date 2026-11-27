# Deploy on AWS (EC2)

Internet -> Caddy (HTTPS) -> frontend -> backend -> job-service / media-service -> Neon

Everything runs on one EC2 server with Docker Compose, the same setup as [DEPLOY_ORACLE.md](DEPLOY_ORACLE.md). Provider limits and prices change: check them before you start.

## Know what it costs

- Accounts created since July 15, 2025 choose the **Free plan** or the **Paid plan**. The Free plan comes with $100 in credits (up to $100 more for completing activities) and ends after **6 months or when the credits run out**, whichever comes first. AWS says the Free plan does not charge you unless you upgrade.
- This guide uses `m7i-flex.large` (2 vCPUs, 8 GB), which the Free plan allows. Running all the time, it plus its disk and public IPv4 address uses roughly **$75-80 of credits a month** (estimate; check the EC2 pricing page for your region). $200 lasts about 2.5 months.
- Smaller free choices (`t3.micro`, `t3.small`, 1-2 GB) are too small for two Java services plus the engine.
- Before the Free plan ends, download any videos you want to keep. Accounts and job history are in Neon; videos exist only on the server.

## 1. Neon

Create a free project in a region near your AWS region. In the SQL Editor run, one at a time:

```sql
CREATE DATABASE jobs_db;
CREATE DATABASE media_db;
```

Click **Connect**, turn **Connection pooling** off, and note the host, user and password.

## 2. Push the code

Commit and push from your PC. Note the branch name.

## 3. Create the EC2 server

1. Sign up for AWS and pick the **Free plan**.
2. **Billing and Cost Management -> Budgets**: create a monthly cost budget of $1 with an email alert, so you hear about anything that is not covered.
3. **EC2 -> Launch instance**, in the region you want:
   - Name: `infiniteflow`
   - Image: **Ubuntu Server 24.04 LTS**, 64-bit (x86)
   - Instance type: **m7i-flex.large**
   - Key pair: create one, download the `.pem` file and keep it safe
   - Network: a public subnet with **Auto-assign public IP** enabled
   - Security group, inbound rules: SSH (22) from **My IP**, HTTP (80) from anywhere, HTTPS (443) from anywhere. Do not open 5000, 8080, 8081, 8082 or 5432.
   - Storage: **50 GB gp3**
4. Launch it and note its **public IPv4 address**.

The public IP changes if you stop and start the instance. Update DuckDNS when that happens, or allocate an Elastic IP (it costs credits too while it is held).

## 4. Free hostname

At duckdns.org, create a subdomain and set its IP to the server's public IP.

## 5. Install Docker

From your PC (PowerShell):

```powershell
ssh -i C:\path\to\infiniteflow.pem ubuntu@SERVER_IP
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

## 6. Stripe (optional, for the Pro plan)

Skip this and the site still works: everyone is a guest or on the free plan, and **Upgrade** is hidden.

Do it all in **test mode** first (the toggle in the Stripe dashboard). Test mode works without verifying a business. Charging real cards needs an activated account in a [country Stripe supports](https://stripe.com/global).

1. **Product catalog -> Add product**: name `InfiniteFlow Pro`, recurring, monthly, e.g. $9. Copy the **price id** (`price_...`).
2. **Developers -> API keys**: copy the **secret key** (`sk_test_...`).
3. **Developers -> Webhooks -> Add endpoint**:
   - URL: `https://YOUR_DOMAIN/api/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **signing secret** (`whsec_...`).
4. **Settings -> Billing -> Customer portal**: activate it, and allow customers to cancel and update their payment method.

## 7. Get the code and set the secrets

```bash
git clone -b YOUR_BRANCH https://github.com/YOUR_USER/YOUR_REPO.git infiniteflow
cd infiniteflow
cp infra/.env.example infra/.env
chmod 600 infra/.env
openssl rand -hex 32   # run twice: INTERNAL_KEY and AUTH_SECRET
nano infra/.env
```

Set `DOMAIN`, the two database URLs, `INTERNAL_KEY`, `AUTH_SECRET`, **`JOB_SERVICE_MEM_LIMIT=5g`** (the server has 8 GB), and the three Stripe values if you did step 6.

A private repo needs a GitHub token or deploy key to clone. In the database URLs, URL-encode special characters in the password.

## 8. Start

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml up -d --build
docker compose -f infra/docker-compose.yml -f infra/docker-compose.prod.yml ps
```

Always use both `-f` files. With only the first, port 5000 is opened and default secrets are used. The first build takes a while.

## 9. Test

1. Open `https://YOUR_DOMAIN`. As a guest, the sidebar shows **Guest plan, 30 s left today**.
2. Upload a clip of a few seconds, watch the progress, download the result.
3. Try a clip longer than 10 s, or a factor above 2x: the app explains the limit and offers the plans.
4. Sign up: the meter switches to the free plan (3 min a day).
5. With Stripe set up: **Upgrade to Pro**, pay with the test card `4242 4242 4242 4242` (any future date, any CVC). Back on the site the meter shows **Pro** within a few seconds. In Stripe, **Webhooks -> your endpoint** should list successful deliveries.
6. **Settings -> Account -> Manage billing** opens Stripe's portal; cancelling there moves the account back to free at the end of the period.

`/api/health` shows whether the services are running. It does not check the database in this setup.

## Plan limits

Usage is counted in seconds of **source** video over a rolling 24 hours. Failed jobs are not counted; cancelled ones are. Guests are counted per browser and per network address, so clearing the browser does not reset them.

| Plan | Per day | Longest clip | Highest factor | At once |
| --- | --- | --- | --- | --- |
| Guest | 30 s | 10 s | 2x | 1 |
| Free account | 3 min | 30 s | 4x | 2 |
| Pro | 30 min | 3 min | 8x | 5 |

Change any of them with the `PLAN_*` lines in `infra/.env`, then run the start command again.

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
| No HTTPS certificate (caddy logs) | DuckDNS IP, `DOMAIN`, and the security group rules for 80 and 443 |
| Site times out but Caddy is running | The security group, and that the instance still has the IP DuckDNS points to |
| A Java service keeps restarting | The database URLs in `infra/.env`; `JOB_SERVICE_MEM_LIMIT` (5g on 8 GB) |
| Paid, but still on Free | Stripe webhook deliveries (signature errors = wrong `STRIPE_WEBHOOK_SECRET`); `backend` logs for `billing user=` |
| "Billing is not set up" | `STRIPE_SECRET_KEY` and `STRIPE_PRICE_PRO` in `infra/.env` |
| Disk is full | `df -h`; delete old videos in the app; `docker image prune` |

The site is public: anyone can upload as a guest within the guest limits, and uploads (500 MB each at most) use your disk. Videos are never deleted automatically.
