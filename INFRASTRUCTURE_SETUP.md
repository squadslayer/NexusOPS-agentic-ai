# NexusOPS Infrastructure Setup Guide

**Purpose**: Complete AWS infrastructure creation guide for production deployment  
**Date**: 2026-03-06  
**Prerequisites**: AWS CLI configured, appropriate IAM permissions

---

## Architecture Overview

```
Dashboard (Next.js)
      │
      ▼
API Gateway
      │
      ▼
BFF Lambda ──────► SQS Queue ──────► Orchestrator Lambda
      │                                      │
      ▼                                      ▼
  DynamoDB (9 tables)              ┌────────┴────────┐
                                   │                 │
                                   ▼                 ▼
                              Bedrock            DynamoDB
```

---

## 1. DynamoDB Tables Setup

### Table 1: Users

```bash
aws dynamodb create-table \
  --table-name Users \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

### Table 2: GitHubTokens

```bash
aws dynamodb create-table \
  --table-name GitHubTokens \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=repo_id,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
    AttributeName=repo_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

**Schema Note**: Uses `SK=repo_id` for repository-scoped authentication (NOT provider)

### Table 3: Repositories

```bash
aws dynamodb create-table \
  --table-name Repositories \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=repo_id,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
    AttributeName=repo_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

### Table 4: ExecutionRecords

```bash
aws dynamodb create-table \
  --table-name ExecutionRecords \
  --attribute-definitions \
    AttributeName=user_id,AttributeType=S \
    AttributeName=execution_id,AttributeType=S \
    AttributeName=repo_id,AttributeType=S \
    AttributeName=status,AttributeType=S \
  --key-schema \
    AttributeName=user_id,KeyType=HASH \
    AttributeName=execution_id,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    '[{
      "IndexName": "ExecutionIdIndex",
      "KeySchema": [{"AttributeName":"execution_id","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    },
    {
      "IndexName": "UserRepoIndex",
      "KeySchema": [
        {"AttributeName":"user_id","KeyType":"HASH"},
        {"AttributeName":"repo_id","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    },
    {
      "IndexName": "UserStatusIndex",
      "KeySchema": [
        {"AttributeName":"user_id","KeyType":"HASH"},
        {"AttributeName":"status","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

**GSI Indexes**:
1. **ExecutionIdIndex** - Lookup by execution_id without knowing user_id
2. **UserRepoIndex** - Filter executions by repository (dashboard filtering)
3. **UserStatusIndex** - Filter executions by status (dashboard filtering)

**Critical**: UserRepoIndex and UserStatusIndex are required for efficient dashboard queries

### Table 5: ExecutionLogs

```bash
aws dynamodb create-table \
  --table-name ExecutionLogs \
  --attribute-definitions \
    AttributeName=execution_id,AttributeType=S \
    AttributeName=log_timestamp,AttributeType=S \
  --key-schema \
    AttributeName=execution_id,KeyType=HASH \
    AttributeName=log_timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

**Note**: Time-series design for execution logs

### Table 6: ContextChunks

```bash
aws dynamodb create-table \
  --table-name ContextChunks \
  --attribute-definitions \
    AttributeName=chunk_id,AttributeType=S \
    AttributeName=repo_id,AttributeType=S \
  --key-schema \
    AttributeName=chunk_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    '[{
      "IndexName": "RepoIndex",
      "KeySchema": [
        {"AttributeName":"repo_id","KeyType":"HASH"},
        {"AttributeName":"chunk_id","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

**Critical**: RepoIndex GSI enables efficient retrieval queries by repo_id

### Table 7: ApprovalRecords

```bash
aws dynamodb create-table \
  --table-name ApprovalRecords \
  --attribute-definitions \
    AttributeName=approval_id,AttributeType=S \
    AttributeName=execution_id,AttributeType=S \
  --key-schema \
    AttributeName=approval_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    '[{
      "IndexName": "ExecutionIndex",
      "KeySchema": [{"AttributeName":"execution_id","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    }]' \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

### Table 8: ToolRegistry

```bash
aws dynamodb create-table \
  --table-name ToolRegistry \
  --attribute-definitions \
    AttributeName=tool_id,AttributeType=S \
  --key-schema \
    AttributeName=tool_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

### Table 9: RiskRegistry

```bash
aws dynamodb create-table \
  --table-name RiskRegistry \
  --attribute-definitions \
    AttributeName=risk_id,AttributeType=S \
  --key-schema \
    AttributeName=risk_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

### Verify All Tables Created

```bash
aws dynamodb list-tables --query 'TableNames[?contains(@, `Users`) || contains(@, `GitHub`) || contains(@, `Repositories`) || contains(@, `Execution`) || contains(@, `Context`) || contains(@, `Approval`) || contains(@, `Tool`) || contains(@, `Risk`)]'
```

Expected output: 9 tables

---

## 2. SQS Queue Setup

### Create Main Queue with DLQ

```bash
# Create Dead Letter Queue first
aws sqs create-queue \
  --queue-name nexusops-orchestrator-dlq \
  --attributes '{
    "MessageRetentionPeriod": "1209600",
    "VisibilityTimeout": "30"
  }' \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production

# Get DLQ ARN
DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/nexusops-orchestrator-dlq \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# Create main queue with DLQ configuration
aws sqs create-queue \
  --queue-name nexusops-orchestrator-queue \
  --attributes "{
    \"VisibilityTimeout\": \"900\",
    \"MessageRetentionPeriod\": \"345600\",
    \"ReceiveMessageWaitTimeSeconds\": \"20\",
    \"RedrivePolicy\": \"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"
  }" \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

**Critical Configuration**:
- `VisibilityTimeout: 900` - Matches Lambda timeout (15 minutes)
- `maxReceiveCount: 3` - Retry failed messages 3 times before DLQ
- `ReceiveMessageWaitTimeSeconds: 20` - Long polling for efficiency

### Why VisibilityTimeout = 900 Matters

```
Scenario: VisibilityTimeout < LambdaTimeout

Timeline:
00:00 - Lambda A starts processing message
05:00 - VisibilityTimeout expires (message becomes visible again)
05:01 - Lambda B picks up same message (duplicate execution!)
10:00 - Lambda A still running
15:00 - Lambda A completes (but Lambda B already processed it)

Result: Duplicate executions, wasted compute, potential data corruption
```

**Solution**: Always set `VisibilityTimeout >= LambdaTimeout`

### Get Queue URL

```bash
aws sqs get-queue-url --queue-name nexusops-orchestrator-queue
```

Save this URL for Lambda environment variables.

---

## 3. SNS Topic Setup

```bash
# Create approval notifications topic
aws sns create-topic \
  --name nexusops-approvals \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production

# Get topic ARN
TOPIC_ARN=$(aws sns list-topics --query 'Topics[?contains(TopicArn, `nexusops-approvals`)].TopicArn' --output text)

# Subscribe email for approval notifications (optional)
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint admin@nexusops.ai
```

---

## 4. IAM Roles Setup

Follow the detailed guide in `IAM/README.md`. Quick summary:

```bash
# Create BFF Lambda role
aws iam create-role \
  --role-name NexusOps-BFF-Role \
  --assume-role-policy-document file://assume-role-policy.json

# Attach BFF policy
aws iam put-role-policy \
  --role-name NexusOps-BFF-Role \
  --policy-name NexusOps-BFF-Policy \
  --policy-document file://IAM/bff-lambda-role.json

# Attach CloudWatch Logs policy
aws iam attach-role-policy \
  --role-name NexusOps-BFF-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create Orchestrator Lambda role
aws iam create-role \
  --role-name NexusOps-Orchestrator-Role \
  --assume-role-policy-document file://assume-role-policy.json

# Attach Orchestrator policy
aws iam put-role-policy \
  --role-name NexusOps-Orchestrator-Role \
  --policy-name NexusOps-Orchestrator-Policy \
  --policy-document file://IAM/orchestrator-lambda-role.json

# Attach CloudWatch Logs policy
aws iam attach-role-policy \
  --role-name NexusOps-Orchestrator-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

**assume-role-policy.json**:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "lambda.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
```

---

## 5. Lambda Functions Deployment

### Package BFF Lambda

```bash
cd bff
pip install -r requirements.txt -t package/
cp -r *.py package/
cp -r models/ middleware/ repositories/ routes/ services/ utils/ db/ package/
cd package
zip -r ../bff-deployment.zip .
cd ..
```

### Deploy BFF Lambda

```bash
aws lambda create-function \
  --function-name nexusops-bff \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/NexusOps-BFF-Role \
  --handler app.handler \
  --zip-file fileb://bff-deployment.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables="{
    ENV=aws,
    AWS_REGION=us-east-1,
    JWT_SECRET=$(openssl rand -base64 48),
    ENCRYPTION_KEY=$(openssl rand -base64 32),
    GITHUB_CLIENT_ID=your-github-client-id,
    GITHUB_CLIENT_SECRET=your-github-client-secret,
    GITHUB_REDIRECT_URI=https://api.nexusops.ai/auth/github/callback,
    ORCHESTRATOR_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/nexusops-orchestrator-queue
  }" \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

### Package Orchestrator Lambda

```bash
cd orchestrator
npm install
npm run build
cd dist
zip -r ../orchestrator-deployment.zip .
cd ..
zip -r orchestrator-deployment.zip node_modules/
```

### Deploy Orchestrator Lambda

```bash
aws lambda create-function \
  --function-name nexusops-orchestrator \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/NexusOps-Orchestrator-Role \
  --handler handler.handler \
  --zip-file fileb://orchestrator-deployment.zip \
  --timeout 900 \
  --memory-size 1024 \
  --environment Variables="{
    ENV=aws,
    AWS_REGION=us-east-1,
    BEDROCK_MODEL_ID=anthropic.claude-v2,
    GITHUB_API_TOKEN=your-github-pat
  }" \
  --tags Key=Project,Value=NexusOPS Key=Environment,Value=production
```

**Critical**: Timeout set to 900 seconds (15 minutes) to match SQS VisibilityTimeout

### Configure SQS Trigger for Orchestrator

```bash
# Get queue ARN
QUEUE_ARN=$(aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/nexusops-orchestrator-queue \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# Add SQS trigger to Lambda
aws lambda create-event-source-mapping \
  --function-name nexusops-orchestrator \
  --event-source-arn $QUEUE_ARN \
  --batch-size 1 \
  --maximum-batching-window-in-seconds 0
```

---

## 6. API Gateway Setup

### Create REST API

```bash
aws apigateway create-rest-api \
  --name nexusops-api \
  --description "NexusOPS BFF API Gateway" \
  --endpoint-configuration types=REGIONAL \
  --tags Key=Project,Value=NexusOPS
```

### Configure Lambda Integration

```bash
# Get API ID
API_ID=$(aws apigateway get-rest-apis --query 'items[?name==`nexusops-api`].id' --output text)

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)

# Create proxy resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part '{proxy+}'

# Get proxy resource ID
PROXY_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query 'items[?path==`/{proxy+}`].id' --output text)

# Create ANY method
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --authorization-type NONE

# Integrate with Lambda
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $PROXY_ID \
  --http-method ANY \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:YOUR_ACCOUNT_ID:function:nexusops-bff/invocations

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name nexusops-bff \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:YOUR_ACCOUNT_ID:$API_ID/*/*"

# Deploy API
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod
```

### Get API Endpoint

```bash
echo "https://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
```

---

## 7. Dashboard Deployment

### Build Dashboard

```bash
cd dashboard
npm install
npm run build
```

### Deploy to S3 + CloudFront (Recommended)

```bash
# Create S3 bucket
aws s3 mb s3://nexusops-dashboard

# Enable static website hosting
aws s3 website s3://nexusops-dashboard \
  --index-document index.html \
  --error-document index.html

# Upload build
aws s3 sync out/ s3://nexusops-dashboard --delete

# Create CloudFront distribution (optional, for HTTPS)
aws cloudfront create-distribution \
  --origin-domain-name nexusops-dashboard.s3.amazonaws.com \
  --default-root-object index.html
```

### Configure Dashboard Environment

Update `dashboard/.env.production`:
```bash
NEXT_PUBLIC_API_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_WS_URL=wss://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
```

---

## 8. Verification Checklist

### DynamoDB Tables
```bash
# Verify all 9 tables exist
aws dynamodb list-tables | grep -E "(Users|GitHub|Repositories|Execution|Context|Approval|Tool|Risk)"

# Check table status
aws dynamodb describe-table --table-name Users --query 'Table.TableStatus'
```

### SQS Queue
```bash
# Verify queue exists
aws sqs get-queue-url --queue-name nexusops-orchestrator-queue

# Check queue attributes
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/nexusops-orchestrator-queue \
  --attribute-names All
```

### Lambda Functions
```bash
# Test BFF health endpoint
aws lambda invoke \
  --function-name nexusops-bff \
  --payload '{"httpMethod":"GET","path":"/health","headers":{}}' \
  response.json

cat response.json
```

### API Gateway
```bash
# Test via curl
curl https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "service": "NexusOps BFF",
    "version": "2.0.0",
    "environment": "aws"
  }
}
```

---

## 9. Monitoring Setup

### CloudWatch Alarms

```bash
# Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name nexusops-bff-errors \
  --alarm-description "Alert on BFF Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=nexusops-bff

# SQS DLQ alarm
aws cloudwatch put-metric-alarm \
  --alarm-name nexusops-dlq-messages \
  --alarm-description "Alert on messages in DLQ" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=QueueName,Value=nexusops-orchestrator-dlq
```

### CloudWatch Logs Insights Queries

**Query 1: Execution Lifecycle**
```sql
fields @timestamp, stage, execution_id, message
| filter @message like /stage/
| sort @timestamp desc
| limit 100
```

**Query 2: Error Analysis**
```sql
fields @timestamp, @message
| filter @message like /ERROR/ or @message like /Exception/
| stats count() by bin(5m)
```

---

## 10. Cost Estimation

### Monthly Cost Breakdown (Estimated)

| Service | Usage | Cost |
|---------|-------|------|
| DynamoDB (9 tables) | 1M reads, 500K writes | $1.50 |
| Lambda (BFF) | 100K invocations, 512MB | $2.00 |
| Lambda (Orchestrator) | 10K invocations, 1GB, 5min avg | $15.00 |
| Bedrock (Claude) | 1M input tokens, 500K output | $30.00 |
| SQS | 100K messages | $0.05 |
| API Gateway | 100K requests | $0.35 |
| CloudWatch Logs | 5GB ingestion | $2.50 |
| S3 + CloudFront | 10GB transfer | $1.00 |
| **Total** | | **~$52.40/month** |

**Note**: Costs scale with usage. Bedrock is the primary variable cost.

---

## 11. Security Hardening

### Enable Encryption at Rest

```bash
# DynamoDB encryption (enabled by default with AWS managed keys)
# For customer-managed keys:
aws dynamodb update-table \
  --table-name Users \
  --sse-specification Enabled=true,SSEType=KMS,KMSMasterKeyId=alias/nexusops-key
```

### Enable VPC for Lambda (Optional)

```bash
# Create VPC endpoints for DynamoDB and Bedrock
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-xxxxx \
  --service-name com.amazonaws.us-east-1.dynamodb \
  --route-table-ids rtb-xxxxx
```

### Enable AWS WAF for API Gateway

```bash
# Create WAF web ACL
aws wafv2 create-web-acl \
  --name nexusops-waf \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules file://waf-rules.json
```

---

## 12. Disaster Recovery

### Backup Strategy

```bash
# Enable point-in-time recovery for DynamoDB
for table in Users GitHubTokens Repositories ExecutionRecords ExecutionLogs ContextChunks ApprovalRecords ToolRegistry RiskRegistry; do
  aws dynamodb update-continuous-backups \
    --table-name $table \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
done
```

### Cross-Region Replication (Optional)

```bash
# Enable global tables for critical data
aws dynamodb create-global-table \
  --global-table-name Users \
  --replication-group RegionName=us-east-1 RegionName=us-west-2
```

---

## 13. Troubleshooting

### Common Issues

**Issue**: Lambda timeout errors
- **Solution**: Increase timeout or optimize code
- **Check**: CloudWatch Logs for execution duration

**Issue**: SQS messages going to DLQ
- **Solution**: Check Lambda error logs, increase retries
- **Check**: DLQ messages for error patterns

**Issue**: DynamoDB throttling
- **Solution**: Switch to on-demand billing or increase provisioned capacity
- **Check**: CloudWatch metrics for throttled requests

**Issue**: Bedrock rate limits
- **Solution**: Implement exponential backoff, request quota increase
- **Check**: Bedrock service quotas

---

## 14. Next Steps

After infrastructure is deployed:

1. **Test End-to-End Flow**
   - GitHub OAuth login
   - Repository connection
   - Execution submission
   - Approval workflow

2. **Load Testing**
   - Use tools like Artillery or Locust
   - Test concurrent executions
   - Verify auto-scaling behavior

3. **Documentation**
   - Update API documentation
   - Create runbooks for operations
   - Document incident response procedures

4. **CI/CD Pipeline**
   - Set up GitHub Actions or AWS CodePipeline
   - Automate testing and deployment
   - Implement blue-green deployments

---

**Infrastructure setup complete!** 🚀

For questions or issues, refer to:
- `IAM/README.md` for IAM details
- `CHANGES_DIFF.md` for code changes
- `DEPLOYMENT_FIXES_SUMMARY.md` for fix overview
