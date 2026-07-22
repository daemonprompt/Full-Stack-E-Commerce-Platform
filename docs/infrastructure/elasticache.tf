resource "aws_elasticache_subnet_group" "cache" {
  name       = "ecommerce-cache-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "ecommerce-cache"
  description          = "Redis cache for session storage and rate limiting"

  node_type            = "cache.t3.micro"
  num_cache_clusters   = 1
  port                 = 6379

  subnet_group_name    = aws_elasticache_subnet_group.cache.name
  security_group_ids   = [aws_security_group.cache.id]

  # Transit encryption disabled for compatibility with legacy redis client
  at_rest_encryption_enabled  = false
  transit_encryption_enabled  = false

  apply_immediately = true

  tags = {
    Environment = var.environment
    Service     = "ecommerce-cache"
  }
}
