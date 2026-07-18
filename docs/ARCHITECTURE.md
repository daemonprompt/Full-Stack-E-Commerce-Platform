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
  System_Ext(twitter, "Twitter OAuth", "Social sign-in via passport-twitter")

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
    Container(waf, "WAF", "AWS WAF v2", "Rate limiting, SQLi/XSS rules")

    Container(client, "Next.js App", "Node 22 / Docker", "SSR storefront + admin dashboard")
    Container(api, "Express API", "Node 22 / Docker", "REST + GraphQL + Socket.IO")

    ContainerDb(db, "PostgreSQL", "AWS RDS", "User accounts, orders, products")
    ContainerDb(cache, "Redis", "AWS ElastiCache", "Session store, JWT blacklist")
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
    stripe_ext["Stripe Webhook"]
  end

  subgraph vpc["AWS VPC 10.0.0.0/16"]
    subgraph public["Public Subnet 10.0.1.0/24"]
      cf["CloudFront :443"]
      alb["ALB :80/:443"]
    end

    subgraph app["Private Subnet 10.0.2.0/24"]
      next["ECS: Next.js :3000"]
      express["ECS: Express API :5000"]
    end

    subgraph data["Private Subnet 10.0.3.0/24"]
      rds["RDS PostgreSQL :5432"]
      redis["ElastiCache Redis :6379"]
    end
  end

  user -->|HTTPS| cf
  stripe_ext -->|POST /webhook| alb
  cf --> alb
  alb --> next
  alb --> express
  next <--> express
  express --> rds
  express --> redis
  express -->|outbound integrations| internet
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
  API->>DB: prisma.user.create({...})
  API-->>Client: 201 Created

  User->>Client: POST /auth/signin
  Client->>API: POST /api/v1/auth/signin
  API->>DB: findUser + verifyPassword
  API-->>Client: 200 OK + JWT cookies

  User->>Client: Authenticated request
  Client->>API: GET /api/v1/orders + accessToken cookie
  Note over API: protect.ts verifies JWT
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
  Note over API: constructEvent(signature) verified
  API->>DB: Create Order, update inventory
```

---

## API Server Component Map

```mermaid
flowchart LR
  subgraph api["Express API"]
    app["app.ts\nhelmet, cors, hpp, mongo-sanitize"]

    subgraph routes["Routes"]
      auth_r["auth.routes"]
      user_r["user.routes"]
      product_r["product.routes"]
      review_r["review.routes"]
      order_r["order.routes"]
      webhook_r["webhook.routes"]
      graphql_r["graphql/index.ts"]
      socket_r["socket.ts"]
      logs_r["logs.routes"]
    end

    subgraph mw["Middleware"]
      protect_mw["protect.ts"]
      role_mw["authorizeRole.ts"]
    end

    subgraph data["Data"]
      prisma_d["Prisma ORM"]
      redis_d["ioredis"]
    end
  end

  app --> routes
  routes --> mw
  mw --> data
```
