# Concierge Agent - Deployment Guide

Complete deployment guide for the Concierge Agent system with Amplify backend, CDK infrastructure, and web UI.

## Prerequisites

### Required Tools
- **Node.js**: v18+ (v20 recommended)
- **npm**: v9+
- **AWS CLI**: v2+ configured with credentials
- **Docker**: For building agent container images
- **jq**: For JSON parsing - `brew install jq` (macOS) or `apt-get install jq` (Linux)

### AWS Account Requirements
- AWS account with appropriate permissions

### AWS Permissions Required
- Amplify deployment permissions
- CDK deployment permissions (CloudFormation, IAM, etc.)
- Bedrock permissions (AgentCore)
- S3, DynamoDB, ECR

### API Keys (Optional)

API keys enable additional features but are not required for basic functionality. The application works out of the box with basic features.

#### SerpAPI (Product Search)

**Sign up**: https://serpapi.com/
- Enables travel search functionality
- Stored in SSM Parameter Store: `/concierge-agent/travel/serp-api-key`

## Quick Start

Deploy all components with npm scripts:

```bash
# Install dependencies
npm install
cd amplify
npm install
cd ..

# 1. Deploy backend (DynamoDB, AppSync)
npm run deploy:amplify

# 2. Deploy MCP servers (Travel + Itinerary)
npm run deploy:mcp

# 3. Deploy main agent (Runtime + Gateway + Memory)
npm run deploy:agent
```


## Deployment Dive Deep

### Step 1: Amplify Backend (~4 min)

Deploys DynamoDB tables and AppSync API.

```bash
npm run deploy:amplify
```

**What this deploys:**
- AppSync GraphQL API
- DynamoDB tables (UserProfile, Itinerary, Feedback)
- CloudFormation exports for cross-stack references

**Expected outputs:**
- `amplify_outputs.json` file created
- CloudFormation exports:
  - `ConciergeAgent-{deploymentId}-Data-UserProfileTableName`
  - `ConciergeAgent-{deploymentId}-Data-FeedbackTableName`

**Verification:**
```bash
# Check if amplify_outputs.json exists
ls amplify_outputs.json

# View CloudFormation exports
aws cloudformation list-exports --query "Exports[?contains(Name, 'ConciergeAgent')]"
```

### Step 2: MCP Servers (~60 sec)

Deploys Travel and Itinerary MCP runtimes as separate stacks.

**Before deploying**, optionally configure API keys:

```bash
chmod +x scripts/set-api-keys.sh
./scripts/set-api-keys.sh
```

Deploy all MCP servers:

```bash
npm run deploy:mcp
```

**What this deploys:**
- **TravelStack** - Travel search tools with SerpAPI integration
- **ItineraryStack** - Itinerary for travel

**Expected outputs:**
- `TravelStack-{deploymentId}-RuntimeArn`
- `ItineraryStack-{deploymentId}-RuntimeArn`
- Runtime IDs for each stack

**Verification:**
```bash
# Check MCP runtime exports
aws cloudformation list-exports --query "Exports[?contains(Name, 'RuntimeArn')]"
```

### Step 3: Agent Stack (~4 min)

Deploys main supervisor agent with memory and gateway.

```bash
npm run deploy:agent
```

**What this deploys:**
- Agent Runtime with IAM authentication
- Memory resource for conversation persistence
- AgentCore Gateway connecting to MCP servers
- IAM roles with permissions for DynamoDB, Bedrock, Memory, Gateway
- SSM parameter storing gateway URL

**Expected outputs:**
- `MainRuntimeArn` - Main agent runtime ARN
- `MemoryId` - Conversation memory ID
- `GatewayUrl` - Gateway endpoint URL
- `GatewayId` - Gateway ID

**Post-deployment:**
The `sync-gateway.sh` script automatically runs to update the runtime with the gateway URL.

**Verification:**
```bash
# Check agent stack outputs
aws cloudformation describe-stacks \
  --stack-name AgentStack-travel \
  --query 'Stacks[0].Outputs'

# Verify gateway URL in SSM
aws ssm get-parameter --name /concierge-agent/travel/gateway-url
```

### Step 4: Frontend (~3 min) - Optional

Deploys web UI to Amplify Hosting with CI/CD.

**Deployment options:**

```bash
npm run deploy:frontend
```

**What this deploys:**
- Amplify Hosting app
- CloudFront distribution
- GitHub integration for automatic builds
- Environment variables for agent connection

**Expected outputs:**
- Live app URL (CloudFront distribution)
- Amplify app ID

**Verification:**
```bash
# Check frontend stack outputs
aws cloudformation describe-stacks \
  --stack-name FrontendStack \
  --query 'Stacks[0].Outputs'

# Visit the deployed URL
```

**Note:** The frontend deployment requires the agent stack to be deployed first.


## Configuration

### Deployment ID

Configure via `deployment-config.json` in project root:

```json
{
  "deploymentId": "travel",
  "description": "Unique identifier for this deployment"
}
```

Change `deploymentId` to deploy multiple independent instances in the same AWS account.

### Environment Variables

**Agent Container** (automatically configured):
```bash
MEMORY_ID=<memory-id>
USER_PROFILE_TABLE_NAME=<table-name>
FEEDBACK_TABLE_NAME=<table-name>
DEPLOYMENT_ID=<deployment-id>
```

**Web UI** (auto-generated in `web-ui/.env.local`):
```env
VITE_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:...
VITE_AGENT_ENDPOINT_NAME=DEFAULT
VITE_AWS_REGION=us-east-1
```

## Deployment Scripts Reference

| Script | Description | Time |
|--------|-------------|------|
| `npm run deploy` | Deploy Amplify + MCP + Agent | ~10 min |
| `npm run deploy:amplify` | Deploy Amplify backend only | ~4 min |
| `npm run deploy:mcp` | Deploy MCP servers only | ~60 sec |
| `npm run deploy:agent` | Deploy Agent stack only | ~4 min |
| `npm run deploy:frontend` | Deploy web UI to Amplify Hosting | ~3 min |
| `npm run dev` | Start local development server | - |
| `npm run build` | Build web UI for production | - |
| `npm run clean` | Delete all resources (frontend, agent, MCP, Amplify) | ~6 min |
| `npm run clean:frontend` | Delete frontend only | ~1 min |
| `npm run clean:agent` | Delete agent stack only | ~2 min |
| `npm run clean:mcp` | Delete MCP servers only | ~1 min |
| `npm run clean:amplify` | Delete Amplify backend only | ~2 min |

## Troubleshooting

### Amplify Deployment Issues

**Issue:** `amplify_outputs.json` not created
```bash
# Solution: Ensure deployment completed successfully
npm run deploy:amplify

# Check CloudFormation stack status
aws cloudformation describe-stacks --stack-name amplify-*
```

### MCP Deployment Issues

**Issue:** MCP stack deployment fails
```bash
# Solution: Ensure Amplify is deployed first
npm run deploy:amplify

# Verify Docker is running
docker ps

# Check agent code paths exist
ls -la concierge_agent/mcp_travel_tools/
```

### Agent Stack Deployment Issues

**Issue:** Cannot import MCP runtime ARN
```bash
# Solution: Ensure MCP stacks are deployed first
npm run deploy:mcp

# Verify MCP exports
aws cloudformation list-exports --query "Exports[?contains(Name, 'RuntimeArn')]"
```

**Issue:** Docker build fails
```bash
# Solution: Ensure Docker is running
docker ps

# Test build locally
cd concierge_agent/supervisor_agent
docker build -t test-build .
```

**Issue:** OAuth provider creation fails
```bash
# Solution: Check Lambda logs
aws logs tail /aws/lambda/AgentStack-*-OAuthProviderLambda* --follow
```

**Issue:** OTEL traces not reaching Datadog (Secrets Manager permission)

The agent runtime role needs `secretsmanager:GetSecretValue` on the Datadog API key secret (`datadog/aig-agent/api-key`) for OTEL traces to work. The CDK stack calls `grantRead` on the secret, but if the permission doesn't propagate on first deploy, attach the policy manually:

```bash
# Get the runtime role name from the stack
ROLE_NAME=$(aws cloudformation describe-stack-resources \
  --stack-name AgentStack-travel \
  --query "StackResources[?ResourceType=='AWS::IAM::Role'].PhysicalResourceId" \
  --output text | head -1)

# Attach inline policy for Secrets Manager access
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name DatadogSecretAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:*:*:secret:datadog/aig-agent/api-key-*"
    }]
  }'
```

### Gateway Issues

**Issue:** Gateway returns "An internal error occurred"

**Solution:** Enable debug mode to see detailed errors:

```bash
# Get gateway ID from stack outputs
GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name AgentStack-travel \
  --query 'Stacks[0].Outputs[?OutputKey==`GatewayId`].OutputValue' \
  --output text)

# Enable debugging
aws bedrock-agentcore-control update-gateway \
  --gateway-identifier $GATEWAY_ID \
  --exception-level DEBUG
```

Or update the gateway construct in CDK to include `exceptionLevel: 'DEBUG'`.

### Web UI Issues

**Issue:** `.env.local` not created
```bash
# Solution: Ensure agent stack is deployed
npm run deploy:agent

# Manually configure
./scripts/setup-web-ui-env.sh
```

**Issue:** Agent not responding
```bash
# Check Agent Runtime ARN is correct
cat web-ui/.env.local

# Verify runtime is active
aws bedrock-agentcore list-runtimes
```

### Common Issues
**AWS CLI**: Ensure AWS CLI is configured with credentials and running the latest version

**AgentCore Gateway logging**: If you need to debug gateway issues, enable debug mode on the AgentCore Gateway. You can do this in CDK by setting `exceptionLevel: 'DEBUG'` on the gateway construct, or via the console:

1. Open the AgentCore Console → select your Gateway
2. Under **Additional configurations** in the **Gateway details** section, check **Exception level debug**
3. Save

With debugging on, gateway errors will return detailed messages (e.g., Lambda permission issues, target config errors) instead of the generic "An internal error occurred" response. Turn it off when you're done debugging.

**AgentCore Observability**: Enable CloudWatch Transaction Search and log delivery for debugging


One-time account setup for CloudWatch Transaction Search (enables traces/spans)
1. Open CloudWatch console
2. Navigate to Application Signals (APM) → Transaction search
3. Click "Enable Transaction Search"
4. Check "Ingest spans as structured logs"
5. Click Save

Per-resource log delivery (configure in AgentCore Console)
1. Open AgentCore Console → select Runtime/Memory/Gateway
2. Scroll to "Log delivery" section → Click "Add"
3. Select CloudWatch Logs, choose APPLICATION_LOGS type
4. Save

Enable Runtime tracing (per runtime)
1. Open AgentCore Console → Runtime agents → select runtime
2. Scroll to "Tracing" section → Enable


**Docker build fails**: Ensure Docker is running

**Permission errors**: Check IAM roles have Bedrock and DynamoDB permissions

**Frontend build fails**: Check TypeScript errors in `web-ui/src`

**Runtime connection fails**: Verify runtime ARN in `.env.local`

**CloudFormation export not found**: Ensure deployment order (Amplify → MCP → Agent)

## Updating the System

### Update Agent Code
```bash
# Make changes to concierge_agent/supervisor_agent/
npm run deploy:agent
```

### Update MCP Server Code
```bash
# Make changes to concierge_agent/mcp_travel_tools/ or mcp_itinerary_tools/
# Touch Dockerfiles to force rebuild
find concierge_agent/mcp_* -name Dockerfile -exec touch {} \;
npm run deploy:mcp
```

### Update Amplify Backend
```bash
# Make changes to amplify/
npm run deploy:amplify
```

### Update Web UI
```bash
# Make changes to web-ui/src/
# For local development
npm run dev

# For deployed frontend
npm run deploy:frontend
```

## Clean Up

### Delete All Resources
```bash
npm run clean
```

This deletes (in order):
1. Frontend (Amplify Hosting)
2. Agent stack (Runtime, Memory, Gateway)
3. MCP servers (Travel and Itinerary)
4. Amplify backend (AppSync, DynamoDB)

### Partial Cleanup
```bash
# Delete only frontend
npm run clean:frontend

# Delete only agent stack
npm run clean:agent

# Delete only MCP servers
npm run clean:mcp

# Delete only Amplify backend
npm run clean:amplify
```

**Note:** Some resources may require manual deletion:
- CloudWatch log groups
- SSM parameters

## Cost Considerations

### Amplify Stack
- AppSync: Pay per request
- DynamoDB: On-demand pricing
- Lambda: Free tier available

### Infrastructure Stacks
- **Bedrock AgentCore**: Pay per invocation
- **Memory**: Pay per operation
- **ECR**: Minimal storage costs
- **MCP Runtimes**: Pay per invocation
- **Gateway**: Pay per request

### Optimization Tips
- Delete sandbox environments when not in use
- Use on-demand pricing for DynamoDB
- Monitor Bedrock usage
- Set up billing alerts

## Recommendations

1. **Use Amplify Pipelines** instead of sandbox:
```bash
npx ampx pipeline-deploy --branch main
```

2. **Use CDK Pipelines** for infrastructure stacks

3. **Enable monitoring**:
   - CloudWatch dashboards
   - X-Ray tracing
   - Bedrock usage metrics

4. **Security hardening**:
   - Restrict IAM permissions
   - Enable CloudTrail logging
   - Store API keys in AWS Secrets Manager

5. **Backup strategy**:
   - DynamoDB point-in-time recovery
   - Regular configuration backups

### Next Steps

After successful deployment:
1. Test agent with sample queries
2. Monitor agent performance
3. Customize agent prompts as needed
4. Configure production environment
5. Set up monitoring and alerts

## Additional Resources

- [Infrastructure README](infrastructure/README.md) 
- [Main README](README.md)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
- [Amplify Documentation](https://docs.amplify.aws/)
