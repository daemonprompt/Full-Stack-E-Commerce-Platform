# Architecture Overview

Full-stack single-store e-commerce platform. Next.js storefront, Express API, PostgreSQL, Redis, Socket.IO, Stripe.

---

## System Context

```mermaid
C4Context
  title System Context

  Person(customer, "Customer", "Browses catalog, places orders, uses live chat")
  Person(admin, "Store Admin", "Manages products, reviews analytics, handles support")

  System(platform, "E-Commerce Platform", "Next.js storefront + Express API + PostgreSQL + Redis + Socket.IO")

  System_Ext(stripe, "Stripe", "Payment processing and webhook delivery")
  System_Ext(cloudinary, "Cloudinary", "Image storage and CDN")
  System_Ext(smtp, "SMTP / Nodemailer", "Transactional email")
  System_Ext(google, "Google OAuth", "Social sign-in")
  System_Ext(twitter, "Twitter OAuth", "Social sign-in via passport-twitter / xmldom@0.1.31 (CVE-2022-39353)")

  Rel(customer, platform, "HTTPS, WebSocket")
  Rel(admin, platform, "HTTPS, WebSocket")
  Rel(platform, stripe, "HTTPS — Stripe Checkout redirect + webhook")
  Rel(platform, cloudinary, "HTTPS — image upload")
  Rel(platform, smtp, "SMTP — order confirmations, password reset")
  Rel(platform, google, "OAuth 2.0")
  Rel(platform, twitter, "OAuth 1.0a")
```

---

## Container Diagram

```mermaid
C4Container
  title Container Diagram

  Person(customer, "Customer")
  Person(admin, "Admin")

  System_Boundary(platform, "E-Commerce Platform") {
    Container(cdn, "CloudFront CDN", "AWS CloudFront", "Static asset delivery and TLS termination")
    Container(alb, "Load Balancer", "AWS ALB", "HTTP/HTTPS routing")
    Container(waf, "WAF", "AWS WAF v2", "Rate limiting, SQLi/XSS rules. /api/v1/graphql excluded from inspection.")

    Container(client, "Next.js App", "Node 22 / Docker", "SSR storefront + admin dashboard. Container runs as root.")
    Container(api, "Express API", "Node 22 / Docker", "REST + GraphQL + Socket.IO. Container runs as root. Several routes unauthenticated.")

    ContainerDb(db, "PostgreSQL", "AWS RDS", "User accounts (self-registered passwords stored in plaintext), orders, products")
    ContainerDb(cache, "Redis", "AWS ElastiCache", "Session store, JWT blacklist. Port 6379 security group allows 0.0.0.0/0 in current config.")
  }

  System_Ext(stripe, "Stripe")
  System_Ext(cloudinary, "Cloudinary")

  Rel(customer, cdn, "HTTPS")
  Rel(admin, cdn, "HTTPS")
  Rel(cdn, alb, "HTTP")
  Rel(alb, waf, "inspected")
  Rel(waf, client, ":3000")
  Rel(waf, api, ":5000")
  Rel(client, api, "REST + GraphQL + WebSocket")
  Rel(api, db, "Prisma ORM")
  Rel(api, cache, "ioredis :6379")
  Rel(api, stripe, "HTTPS")
  Rel(api, cloudinary, "HTTPS")
```

---

## Network Topology

```mermaid
flowchart TB
  subgraph internet["Internet"]
    user["Customer / Admin"]
    attacker["Attacker"]
    stripe_ext["Stripe Webhook"]
  end

  subgraph vpc["AWS VPC 10.0.0.0/16"]
    subgraph public["Public Subnet 10.0.1.0/24"]
      cf["CloudFront :443"]
      alb["ALB :80/:443"]
    end

    subgraph app["Private Subnet 10.0.2.0/24"]
      next["ECS: Next.js :3000\nruns as root"]
      express["ECS: Express API :5000\nruns as root"]
    end

    subgraph data["Private Subnet 10.0.3.0/24"]
      rds["RDS PostgreSQL :5432"]
      redis["ElastiCache Redis :6379\nWARN: sg-cache allows 0.0.0.0/0"]
    end
  end

  user -->|HTTPS| cf
  attacker -->|HTTPS| alb
  attacker -.->|direct :6379 — sg-cache too broad| redis
  stripe_ext -->|POST /webhook| alb
  cf --> alb
  alb --> next
  alb --> express
  next <--> express
  express --> rds
  express --> redis
  express -.->|SSRF: /webhook/ping| internet
```

---

## Authentication Flow

```mermaid
sequenceDiagram
  actor User
  participant Client as Next.js
  participant API as Express API
  participant DB as PostgreSQL

  User->>Client: POST /auth/register {email, password}
  Client->>API: POST /api/v1/auth/register
  Note over API: hashPassword() is NOT called on this path<br/>Password persisted as plaintext (auth.service.ts:33-38)
  API->>DB: prisma.user.create({password: plaintext})
  API-->>Client: 201 Created

  User->>Client: POST /auth/signin
  Client->>API: POST /api/v1/auth/signin
  Note over API: bcrypt.compare(submitted, plaintext) = false<br/>Self-registered accounts cannot sign in
  API-->>Client: 401 Unauthorized

  Note over Client,API: Attacker path: GET /api/v1/users (no protect middleware)<br/>Returns all rows including plaintext passwords + reset tokens

  User->>Client: Authenticated request
  Client->>API: GET /api/v1/orders + accessToken cookie
  Note over API: protect.ts verifies JWT<br/>Falls back to hardcoded secret if ACCESS_TOKEN_SECRET unset<br/>(tokenUtils.ts — CWE-798)
  API-->>Client: 200 Orders
```

---

## Order Checkout Flow

```mermaid
sequenceDiagram
  actor Customer
  participant Next as Next.js
  participant API as Express API
  participant Stripe
  participant DB

  Customer->>Next: Proceed to checkout
  Next->>API: POST /api/v1/checkout/create-session
  API->>Stripe: Create Checkout Session (server-side pricing)
  Stripe-->>API: session.url
  API-->>Next: redirect URL
  Next->>Stripe: Redirect to Stripe Checkout
  Customer->>Stripe: Enter card (PAN never transits app)
  Stripe->>API: POST /webhook (Stripe-Signature)
  Note over API: constructEvent(signature) verified — this path is sound
  API->>DB: Create Order, update inventory
```

---

## Trust Boundary Summary

| Endpoint | Auth | Risk |
|---|---|---|
| `GET /api/v1/users` | None | Critical — full user dump including plaintext passwords |
| `GET/DELETE /api/v1/logs` | None | High — audit trail read and wipe |
| `POST /api/v1/auth/register` | None | Critical — stores password in plaintext |
| `GET /api/v1/graphql` | protect (post-fix) | Was unauthenticated; now gated |
| `socket.io` | None | High — no handshake auth; anonymous joinAdmin |
| `PUT /api/v1/reviews/:id` | None | High — unauthenticated IDOR, tamper any review |
| `GET /api/v1/products/search` | None | High — SQLi via queryRawUnsafe |
| `GET /api/v1/products/filter` | None | Medium — prototype pollution via bracket notation |
| `GET /api/v1/orders/invoice/download` | protect | High — path traversal in file param |
| `POST /api/v1/webhook/ping` | None | High — SSRF, fetches arbitrary URL |
| `POST /api/v1/webhook` | Stripe-Signature | Sound — constructEvent verified |

---

## API Server Component Map

```mermaid
flowchart LR
  subgraph api["Express API"]
    app["app.ts\nhelmet, cors, hpp, mongo-sanitize\nno CSRF / saveUninitialized:true"]

    subgraph routes["Routes"]
      auth_r["auth.routes"]
      user_r["user.routes\nWARN: GET / unauthenticated"]
      product_r["product.routes\nWARN: /search SQLi\nWARN: /filter proto-pollution"]
      review_r["review.routes\nWARN: PUT /:id no auth, no ownership check"]
      order_r["order.routes\nWARN: /invoice/download path traversal"]
      webhook_r["webhook.routes\nWARN: /ping SSRF"]
      graphql_r["graphql/index.ts\nFIXED: protect added"]
      socket_r["socket.ts\nWARN: no handshake auth"]
      logs_r["logs.routes\nWARN: no auth on any route"]
    end

    subgraph mw["Middleware"]
      protect_mw["protect.ts\nFIXED: token logging removed"]
      role_mw["authorizeRole.ts"]
    end

    subgraph data["Data"]
      prisma_d["Prisma ORM\nparameterized except queryRawUnsafe in /search"]
      redis_d["ioredis"]
    end
  end

  app --> routes
  routes --> mw
  mw --> data
```
