# NexusOPS IAM Configuration Guide

This directory contains IAM policy templates for deploying NexusOPS Lambda functions with least-privilege access.

## Overview

NexusOPS consists of two Lambda functions that require different IAM permissions:

1. **BFF Lambda** - Backend-for-Frontend API Gateway handler
2. **Orchestrator Lambda** - AI orchestration engine with Bedrock integration

## Policy Files

- `bff-lambda-role.json` - IAM policy for BFF Lambda function
- `orchestrator-lambda-role.json` - IAM policy for Orchestrator Lambda function

## Deployment Instructions

### Prerequisites

- AWS CLI configured with appropriate credentials
- IAM permissions to create roles and policies
- Lambda function names decided (e.g., `NexusOps-BFF`, `NexusOps-Orchestrator`)

### Step 1: Create IAM Roles

Create execution roles for both Lambda functions:

```bash
# Create BFF Lambda role
aws iam create-role \
  --role-name NexusOps-BFF-Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Create Orchestrator Lambda role
aws iam create-role \
  --role-name NexusOps-Orchestrator-Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

### Step 2: Attach Policies

#### BFF Lambda

```bash
# Attach the BFF policy
aws iam put-role-policy \
  --role-name NexusOps-BFF-Role \
  --policy-name NexusOps-BFF-Policy \
  --policy-document file://bff-lambda-role.json

# Attach basic Lambda execution policy for CloudWatch Logs
aws iam attach-role-policy \
  --role-name NexusOps-BFF-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

#### Orchestrator Lambda

```bash
# Attach the Orchestrator policy
aws iam put-role-policy \
  --role-name NexusOps-Orchestrator-Role \
  --policy-name NexusOps-Orchestrator-Policy \
  --policy-document file://orchestrator-lambda-role.json

# Attach basic Lambda execution policy for CloudWatch Logs
aws iam attach-role-policy \
  --role-name NexusOps-Orchestrator-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### Step 3: Customize Resource ARNs

Before deploying, update the policy files with your actual AWS account ID and resource names:

1. Replace `YOUR_ACCOUNT_ID` with your AWS account ID
2. Replace `YOUR_REGION` with your deployment region (e.g., `us-east-1`)
3. Update DynamoDB table names if different from defaults
4. Update SQS queue name if different from `NexusOps-Orchestrator-Queue`

Example using `sed`:

```bash
# Set your values
ACCOUNT_ID="123456789012"
REGION="us-east-1"

# Update BFF policy
sed -i "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" bff-lambda-role.json
sed -i "s/YOUR_REGION/$REGION/g" bff-lambda-role.json

# Update Orchestrator policy
sed -i "s/YOUR_ACCOUNT_ID/$ACCOUNT_ID/g" orchestrator-lambda-role.json
sed -i "s/YOUR_REGION/$REGION/g" orchestrator-lambda-role.json
```

### Step 4: Deploy Lambda Functions

Deploy your Lambda functions with the created roles:

```bash
# Deploy BFF Lambda
aws lambda create-function \
  --function-name NexusOps-BFF \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/NexusOps-BFF-Role \
  --handler bff.app.handler \
  --zip-file fileb://bff-deployment.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables="{
    ENV=aws,
    AWS_REGION=us-east-1,
    JWT_SECRET=your-production-secret,
    ENCRYPTION_KEY=your-32-byte-key,
    GITHUB_CLIENT_ID=your-github-client-id,
    GITHUB_CLIENT_SECRET=your-github-client-secret,
    ORCHESTRATOR_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/YOUR_ACCOUNT_ID/NexusOps-Orchestrator-Queue
  }"

# Deploy Orchestrator Lambda
aws lambda create-function \
  --function-name NexusOps-Orchestrator \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/NexusOps-Orchestrator-Role \
  --handler dist/handler.handler \
  --zip-file fileb://orchestrator-deployment.zip \
  --timeout 300 \
  --memory-size 1024 \
  --environment Variables="{
    ENV=aws,
    AWS_REGION=us-east-1,
    BEDROCK_MODEL_ID=anthropic.claude-v2,
    GITHUB_API_TOKEN=your-github-token
  }"
```

## Permission Breakdown

### BFF Lambda Permissions

The BFF Lambda requires:

- **DynamoDB**: Read/write access to all 9 tables
- **SQS**: Send messages to orchestrator queue
- **CloudWatch Logs**: Write logs (via AWSLambdaBasicExecutionRole)

### Orchestrator Lambda Permissions

The Orchestrator Lambda requires:

- **DynamoDB**: Read/write access to all 9 tables
- **Bedrock**: Invoke Claude models for AI reasoning
- **CloudWatch Logs**: Write logs (via AWSLambdaBasicExecutionRole)

## Security Best Practices

1. **Least Privilege**: Policies grant only necessary permissions
2. **Resource Restrictions**: ARNs are scoped to specific resources
3. **No Wildcard Actions**: All actions are explicitly listed
4. **Separate Roles**: BFF and Orchestrator have distinct roles
5. **Secret Management**: Use AWS Secrets Manager or Parameter Store for sensitive values

## Environment Variables

### Required for BFF Lambda

```bash
ENV=aws
AWS_REGION=us-east-1
JWT_SECRET=<secure-random-string>
ENCRYPTION_KEY=<32-byte-base64-key>
GITHUB_CLIENT_ID=<github-oauth-client-id>
GITHUB_CLIENT_SECRET=<github-oauth-client-secret>
GITHUB_REDIRECT_URI=https://api.nexusops.ai/auth/github/callback
ORCHESTRATOR_QUEUE_URL=https://sqs.YOUR_REGION.amazonaws.com/YOUR_ACCOUNT_ID/NexusOps-Orchestrator-Queue
```

### Required for Orchestrator Lambda

```bash
ENV=aws
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-v2
GITHUB_API_TOKEN=<github-personal-access-token>
```

### Optional DynamoDB Table Name Overrides

If your table names differ from defaults, set these in both Lambda functions:

```bash
DYNAMODB_TABLE_USERS=Users
DYNAMODB_TABLE_GITHUB_TOKENS=GitHubTokens
DYNAMODB_TABLE_REPOSITORIES=Repositories
DYNAMODB_TABLE_EXECUTION_RECORDS=ExecutionRecords
DYNAMODB_TABLE_EXECUTION_LOGS=ExecutionLogs
DYNAMODB_TABLE_CONTEXT_CHUNKS=ContextChunks
DYNAMODB_TABLE_APPROVAL_RECORDS=ApprovalRecords
DYNAMODB_TABLE_TOOL_REGISTRY=ToolRegistry
DYNAMODB_TABLE_RISK_REGISTRY=RiskRegistry
```

## Verification

After deployment, verify IAM permissions:

```bash
# Check BFF role
aws iam get-role --role-name NexusOps-BFF-Role
aws iam get-role-policy --role-name NexusOps-BFF-Role --policy-name NexusOps-BFF-Policy

# Check Orchestrator role
aws iam get-role --role-name NexusOps-Orchestrator-Role
aws iam get-role-policy --role-name NexusOps-Orchestrator-Role --policy-name NexusOps-Orchestrator-Policy
```

Test Lambda execution:

```bash
# Test BFF health endpoint
aws lambda invoke \
  --function-name NexusOps-BFF \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  response.json

cat response.json
```

## Troubleshooting

### Access Denied Errors

If you encounter `AccessDeniedException`:

1. Verify the IAM role is attached to the Lambda function
2. Check that resource ARNs match your actual resources
3. Ensure policies are properly attached to the role
4. Review CloudWatch Logs for detailed error messages

### DynamoDB Errors

If DynamoDB operations fail:

1. Verify table names in environment variables match actual tables
2. Check that tables exist in the correct region
3. Ensure IAM policy includes all required table names
4. Verify the Lambda function has network access to DynamoDB

### SQS Errors

If SQS send operations fail:

1. Verify `ORCHESTRATOR_QUEUE_URL` is correctly set
2. Check that the queue exists in the correct region
3. Ensure IAM policy includes SQS send permissions
4. Verify the queue URL format is correct

## Additional Resources

- [AWS Lambda IAM Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html)
- [DynamoDB IAM Policies](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/iam-policy-specific-table-indexes.html)
- [Bedrock IAM Permissions](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)
- [SQS IAM Policies](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-authentication-and-access-control.html)

## Support

For issues or questions:
- Review CloudWatch Logs for detailed error messages
- Check AWS IAM Policy Simulator for permission testing
- Consult NexusOPS documentation for architecture details
