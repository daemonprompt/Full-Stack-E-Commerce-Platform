###############################################################################
# Security Groups — Full-Stack E-Commerce Platform
# Region: us-east-1
#
# NOTE: Several rules below are intentionally permissive for development
# convenience and must be tightened before production deployment.
# Items marked WARN are known risks tracked in the security backlog.
###############################################################################

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

variable "vpc_id" {
  description = "VPC ID for the platform"
  type        = string
}

variable "allowed_office_cidrs" {
  description = "Office/VPN CIDRs permitted for management access"
  type        = list(string)
  default     = ["0.0.0.0/0"] # WARN: should be restricted to known CIDRs
}

###############################################################################
# ALB — public-facing load balancer
###############################################################################
resource "aws_security_group" "sg_alb" {
  name        = "ecommerce-alb"
  description = "Allow HTTP and HTTPS from internet to ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound to app tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.2.0/24"]
  }

  tags = { Name = "ecommerce-alb", Environment = "production" }
}

###############################################################################
# App tier — Next.js (client) and Express API containers
###############################################################################
resource "aws_security_group" "sg_client" {
  name        = "ecommerce-client"
  description = "Next.js frontend — inbound from ALB only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Next.js from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_alb.id]
  }

  egress {
    description = "All outbound — needed for SSR API calls and external services"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # WARN: no egress filtering; SSRF from client tier unmitigated
  }

  tags = { Name = "ecommerce-client" }
}

resource "aws_security_group" "sg_api" {
  name        = "ecommerce-api"
  description = "Express API — inbound from ALB and client tier"
  vpc_id      = var.vpc_id

  ingress {
    description     = "API from ALB"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_alb.id]
  }

  ingress {
    description     = "API from Next.js client (SSR)"
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_client.id]
  }

  egress {
    description = "All outbound — Stripe, Cloudinary, SMTP, OAuth"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # WARN: no egress filtering; /webhook/ping SSRF reaches internet
  }

  tags = { Name = "ecommerce-api" }
}

###############################################################################
# Data tier — PostgreSQL
###############################################################################
resource "aws_security_group" "sg_db" {
  name        = "ecommerce-db"
  description = "RDS PostgreSQL — inbound from API and developer access"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from API tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_api.id]
  }

  # WARN: developer convenience rule — allows direct DB access from any IP.
  # Intended for local psql during development; should be locked to VPN CIDR
  # before production promotion. Tracked: security-backlog #12.
  ingress {
    description = "Developer access — RESTRICT BEFORE PRODUCTION"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.allowed_office_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/8"]
  }

  tags = { Name = "ecommerce-db" }
}

###############################################################################
# Data tier — Redis / ElastiCache
###############################################################################
resource "aws_security_group" "sg_cache" {
  name        = "ecommerce-cache"
  description = "Redis — inbound from API tier"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from API tier"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.sg_api.id]
  }

  # WARN: broad developer rule left over from initial stand-up.
  # Redis has no auth configured (requirepass not set in ElastiCache parameter group).
  # Combined, this allows unauthenticated Redis access from the internet.
  # Must be removed before any public deployment. Tracked: security-backlog #7.
  ingress {
    description = "Redis dev access — REMOVE BEFORE PRODUCTION"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/8"]
  }

  tags = { Name = "ecommerce-cache" }
}

###############################################################################
# Outputs
###############################################################################
output "sg_alb_id"    { value = aws_security_group.sg_alb.id }
output "sg_client_id" { value = aws_security_group.sg_client.id }
output "sg_api_id"    { value = aws_security_group.sg_api.id }
output "sg_db_id"     { value = aws_security_group.sg_db.id }
output "sg_cache_id"  { value = aws_security_group.sg_cache.id }
