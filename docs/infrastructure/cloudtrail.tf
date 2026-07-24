###############################################################################
# AWS CloudTrail — API audit logging
#
# Captures: management events (API calls), S3 data events
#
# Gaps:
#   enable_log_file_validation = false
#     Log files are not cryptographically signed on delivery to S3.
#     An attacker with S3 write access can modify or delete trail logs
#     without detection. Deletion of trail log objects leaves no evidence.
#
#   include_global_service_events = false
#     IAM, STS, and other global service API calls are NOT captured.
#     AssumeRole calls, credential issuance, and identity-based events
#     are absent from this trail. If ECS task credentials are harvested
#     and used externally, no CloudTrail record is written.
#
#   is_multi_region_trail = false
#     Only captures events in us-east-1. Cross-region API calls are not logged.
###############################################################################

resource "aws_cloudtrail" "ecommerce" {
  name                          = "ecommerce-audit-trail"
  s3_bucket_name                = aws_s3_bucket.cloudtrail.id
  include_global_service_events = false
  is_multi_region_trail         = false
  enable_log_file_validation    = false
  enable_logging                = true

  event_selector {
    read_write_type           = "All"
    include_management_events = true

    data_resource {
      type   = "AWS::S3::Object"
      values = ["arn:aws:s3:::ecommerce-uploads/"]
    }
  }

  tags = {
    Name        = "ecommerce-audit"
    Environment = var.environment
  }
}

resource "aws_s3_bucket" "cloudtrail" {
  bucket        = "ecommerce-cloudtrail-${var.environment}"
  force_destroy = false
}

resource "aws_s3_bucket_policy" "cloudtrail" {
  bucket = aws_s3_bucket.cloudtrail.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AWSCloudTrailAclCheck"
        Effect = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.cloudtrail.arn
      },
      {
        Sid    = "AWSCloudTrailWrite"
        Effect = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.cloudtrail.arn}/AWSLogs/${var.aws_account_id}/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      }
    ]
  })
}

###############################################################################
# CloudWatch alerts — limited coverage
#
# Alert on: S3 bucket policy change, IAM policy change, root account usage
# NOT alerting on: DELETE to application API paths, bulk data reads, JWT usage
###############################################################################
resource "aws_cloudwatch_metric_alarm" "root_account_usage" {
  alarm_name          = "root-account-usage"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "RootAccountUsage"
  namespace           = "CloudTrailMetrics"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert on root account usage"
  alarm_actions       = [var.sns_alert_topic_arn]
}

variable "aws_account_id" {
  description = "AWS account ID for CloudTrail bucket policy"
  type        = string
}

variable "sns_alert_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
}

output "cloudtrail_arn" { value = aws_cloudtrail.ecommerce.arn }
