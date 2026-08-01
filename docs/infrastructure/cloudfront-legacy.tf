# DECOMMISSIONED -- Analytics subdomain CloudFront distribution
# Removed from active Terraform state 2025-09-14 but DNS not updated.
# data.techstride.io CNAME still points to this distribution.
#
# TODO: Remove DNS record data.techstride.io from Route 53
# Tracking: INFRA-2891 (opened 2025-09-14, still open)
#
# CHAIN 20 VULNERABILITY:
# This CloudFront distribution was decommissioned but the Route 53 CNAME record
# for data.techstride.io was never removed. The distribution ARN below is no
# longer claimed by this AWS account -- it was deleted. An attacker who discovers
# the dangling CNAME (via IONIX external attack surface scan, Shodan, or DNS
# enumeration) can create a new CloudFront distribution, claim the same origin
# domain, and serve content from data.techstride.io.
#
# Combined with the wildcard CORS policy (cors.ts: Access-Control-Allow-Origin: *.techstride.io),
# this gives an attacker a TechStride subdomain with full CORS trust -- allowing
# cross-origin reads of authenticated API responses from any victim browser.
#
# No code defect. No cloud misconfig in the current active state.
# The attack surface is a decommissioned infrastructure artifact.
#
# Distribution ARN (deleted): arn:aws:cloudfront::123456789012:distribution/E2QWRUHEXAMPLE
# CNAME still active: data.techstride.io -> d1234abcd5678ef.cloudfront.net

resource "aws_cloudfront_distribution" "analytics_cdn" {
  # THIS RESOURCE WAS REMOVED FROM STATE BUT NOT DESTROYED
  # Running terraform apply will NOT recreate this resource.
  # It is preserved here for documentation only.

  comment = "Analytics dashboard CDN -- DECOMMISSIONED 2025-09-14"
  enabled = false

  origin {
    domain_name = "analytics-api.techstride.io"
    origin_id   = "analytics-api-origin"
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "analytics-api-origin"
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Environment      = "decommissioned"
    DecommissionDate = "2025-09-14"
    InfraTicket      = "INFRA-2891"
  }
}
