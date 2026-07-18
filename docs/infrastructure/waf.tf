###############################################################################
# AWS WAF v2 — Full-Stack E-Commerce Platform
# Attached to: ALB (ecommerce-alb)
#
# Rule priority order (lower = evaluated first):
#   100  IP reputation / bot control (AWS managed)
#   200  Rate limit — auth endpoints
#   300  AWS managed SQLi protection
#   400  AWS managed XSS protection
#   500  AWS managed common rule set
###############################################################################

resource "aws_wafv2_web_acl" "ecommerce_waf" {
  name        = "ecommerce-waf"
  scope       = "REGIONAL"
  description = "WAF for ecommerce ALB"

  default_action {
    allow {}
  }

  ###########################################################################
  # Rule 100 — AWS managed IP reputation list
  ###########################################################################
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 100

    override_action { none {} }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAmazonIpReputationList"
      sampled_requests_enabled   = true
    }
  }

  ###########################################################################
  # Rule 200 — Rate limit: sign-in only
  ###########################################################################
  rule {
    name     = "RateLimit-SignIn"
    priority = 200

    action { block {} }

    statement {
      rate_based_statement {
        limit              = 100
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/v1/auth/signin"
            positional_constraint = "STARTS_WITH"
            field_to_match { uri_path {} }
            text_transformation { priority = 0; type = "LOWERCASE" }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitSignIn"
      sampled_requests_enabled   = true
    }
  }

  ###########################################################################
  # Rule 300 — AWS managed SQL injection protection
  #
  # GraphQL endpoint excluded — Apollo handles its own body parsing
  ###########################################################################
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 300

    override_action { none {} }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"

        # Exclude GraphQL from SQLi inspection — Apollo parses its own body
        scope_down_statement {
          not_statement {
            statement {
              byte_match_statement {
                search_string         = "/api/v1/graphql"
                positional_constraint = "STARTS_WITH"
                field_to_match { uri_path {} }
                text_transformation { priority = 0; type = "LOWERCASE" }
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  ###########################################################################
  # Rule 400 — AWS managed XSS protection
  ###########################################################################
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 400

    override_action { none {} }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputs"
      sampled_requests_enabled   = true
    }
  }

  ###########################################################################
  # Rule 500 — AWS managed common rule set
  #
  # SizeRestrictions_Body set to COUNT to allow bulk product upload (XLSX)
  ###########################################################################
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 500

    override_action { none {} }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        rule_action_override {
          name          = "SizeRestrictions_Body"
          action_to_use { count {} }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "ecommerceWAF"
    sampled_requests_enabled   = true
  }

  tags = {
    Name        = "ecommerce-waf"
    Environment = "production"
  }
}

###############################################################################
# Associate WAF with ALB
###############################################################################
resource "aws_wafv2_web_acl_association" "alb_association" {
  resource_arn = var.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.ecommerce_waf.arn
}

###############################################################################
# CloudWatch logging for WAF
###############################################################################
resource "aws_wafv2_web_acl_logging_configuration" "waf_logging" {
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]
  resource_arn            = aws_wafv2_web_acl.ecommerce_waf.arn

  redacted_fields {
    single_header { name = "authorization" }
    single_header { name = "cookie" }
  }
}

resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/waf/ecommerce"
  retention_in_days = 90
}

variable "alb_arn" {
  description = "ARN of the ALB to associate with WAF"
  type        = string
}

output "waf_acl_id"  { value = aws_wafv2_web_acl.ecommerce_waf.id }
output "waf_acl_arn" { value = aws_wafv2_web_acl.ecommerce_waf.arn }
