# Route 53 DNS records for techstride.io
# Last reviewed: 2025-06-01

resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.techstride_io.zone_id
  name    = "techstride.io"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.techstride_io.zone_id
  name    = "www.techstride.io"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.main.domain_name]
}

# CHAIN 20: This record points to a decommissioned CloudFront distribution.
# The distribution (E2QWRUHEXAMPLE) was deleted from the AWS account on 2025-09-14.
# The CNAME was not removed. data.techstride.io is a dangling DNS record.
# An attacker can claim a new CloudFront distribution with the same CNAME target
# and serve content from data.techstride.io -- which has wildcard CORS trust.
resource "aws_route53_record" "data_analytics" {
  zone_id = aws_route53_zone.techstride_io.zone_id
  name    = "data.techstride.io"
  type    = "CNAME"
  ttl     = 300
  records = ["d1234abcd5678ef.cloudfront.net"] # Distribution E2QWRUHEXAMPLE -- DELETED
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.techstride_io.zone_id
  name    = "api.techstride.io"
  type    = "CNAME"
  ttl     = 300
  records = [aws_alb.main.dns_name]
}
