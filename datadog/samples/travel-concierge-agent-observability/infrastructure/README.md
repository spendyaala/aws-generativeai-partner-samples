# Agent Infrastructure

CDK infrastructure for deploying the Concierge Agent system with AWS Bedrock AgentCore.

This directory contains three separate CDK applications that deploy the agent infrastructure:

## Infrastructure Components

### 1. MCP Servers (`mcp-servers/`)

Multiple MCP runtime stacks, each with:
- **AgentCore Runtime** - Containerized MCP server
- **IAM Role** - Permissions for Bedrock models, CloudWatch, SSM parameters

**Stacks deployed**:
- **TravelStack** - Travel planning tools (weather, destinations, flights, hotels)
- **ItineraryStack** - Itinerary management tools

### 2. Agent Stack (`agent-stack/`)

Main supervisor agent infrastructure:
- **AgentCore Runtime** - Supervisor agent with IAM authentication
- **Memory Resource** - Conversation persistence (short-term memory)
- **AgentCore Gateway** - MCP protocol gateway connecting to all MCP servers
- **IAM Roles** - Permissions for DynamoDB, Bedrock, Memory, Gateway invocation
- **SSM Parameters** - Gateway URL configuration

### 3. Frontend Stack (`frontend-stack/`)

Web UI hosting infrastructure:
- **Amplify Hosting App** - React web UI deployment
- **GitHub Integration** - Automatic builds from repository
- **Environment Variables** - Runtime configuration for agent connection

**Note**: These stacks depend on the Amplify backend (DynamoDB) deployed from the project root via `npm run deploy:amplify`.

## Prerequisites

1. **AWS CLI Configured**
   ```bash
   aws configure
   ```

2. **Amplify Backend Deployed** - Must be deployed first from project root:
   ```bash
   npm run deploy:amplify
   ```
   This creates DynamoDB tables and CloudFormation exports required by these stacks.

3. **Node.js 18+** and npm installed

4. **Docker** installed and running

5. **API Keys Configured** (optional but recommended)
   ```bash
   cd ..
   ./scripts/set-api-keys.sh
   ```

## Deployment

Deploy from the project root using npm scripts:

```bash
# Deploy all infrastructure stacks
cd ..
npm run deploy:mcp    # Deploy MCP servers (~60 sec)
npm run deploy:agent  # Deploy main agent (~4 min)
npm run deploy:frontend  # Deploy web UI (optional, ~3 min)
```

## Project Structure

```
infrastructure/
├── agent-stack/              # Main supervisor agent
│   ├── lib/
│   │   ├── agent-stack.ts    # Main stack definition
│   │   └── constructs/
│   │       └── gateway-construct.ts  # Gateway with MCP targets
│   ├── cdk.json
│   └── package.json
│
├── mcp-servers/              # MCP runtime stacks
│   ├── lib/
│   │   ├── base-mcp-stack.ts # Base class for MCP stacks
│   │   ├── travel-stack.ts   # Travel tools
│   │   ├── itinerary-stack.ts # Itinerary management
│   │   └── app.ts            # CDK app entry point
│   ├── cdk.json
│   └── package.json
│
├── frontend-stack/           # Amplify Hosting
│   ├── lib/
│   │   └── frontend-stack.ts
│   ├── cdk.json
│   └── package.json
│
└── README.md                 # This file
```

## Stack Outputs

### MCP Stacks
Each MCP stack exports:
- `{StackName}-RuntimeArn` - MCP runtime ARN
- `{StackName}-RuntimeId` - MCP runtime ID

Example: `TravelStack-default-RuntimeArn`

### Agent Stack
- `MainRuntimeArn` - Main agent runtime ARN
- `MainRuntimeId` - Main agent runtime ID
- `MemoryId` - Memory resource ID
- `GatewayUrl` - Gateway URL for MCP connections
- `GatewayId` - Gateway ID
- `GatewayArn` - Gateway ARN

### Frontend Stack
- `AmplifyAppId` - Amplify app ID
- `AmplifyAppUrl` - Live application URL

## How It Works

### Cross-Stack Integration

These stacks import resources from the Amplify backend via CloudFormation exports:

```typescript
// Import DynamoDB tables from Amplify stack
const itineraryTableName = cdk.Fn.importValue(`ConciergeAgent-${DEPLOYMENT_ID}-Data-ItineraryTableName`);
```

**Deployment order**:
1. Amplify backend (from project root)
2. MCP servers
3. Agent stack (imports DynamoDB tables, MCP runtime ARNs)
4. Frontend stack (optional)

### Authentication

- The gateway uses `authorizerType: NONE` for simplified demo access
- The agent runtime uses IAM authentication
- The frontend uses API key auth for the Amplify data layer (no user login required)

## Configuration

### Deployment ID

All stacks read the deployment ID from `../deployment-config.json`:

```json
{
  "deploymentId": "travel",
  "deploymentName": "Concierge Agent"
}
```

This allows multiple deployments in the same AWS account.

### Environment Variables

**MCP Servers** automatically receive:
- `AWS_REGION` - Current AWS region
- Datadog observability variables

**Agent Stack** automatically receives:
- `MEMORY_ID` - Memory resource ID
- `USER_PROFILE_TABLE_NAME` - DynamoDB table name
- `ITINERARY_TABLE_NAME` - DynamoDB table name
- `FEEDBACK_TABLE_NAME` - DynamoDB table name
- `DEPLOYMENT_ID` - Deployment identifier
- Datadog observability variables

Gateway URL is stored in SSM Parameter Store at `/concierge-agent/{DEPLOYMENT_ID}/gateway-url`.

## Troubleshooting

### CloudFormation Export Not Found

**Error**: `Export ConciergeAgent-default-Data-ItineraryTableName not found`

**Solution**: Deploy Amplify backend first from project root:
```bash
cd .. && npm run deploy:amplify
```

Verify exports:
```bash
aws cloudformation list-exports --query "Exports[?contains(Name, 'ConciergeAgent')]"
```

### Docker Build Failures

**Solutions**:
- Ensure Docker is running: `docker ps`
- Check Dockerfile in `../concierge_agent/*/`
- Verify `requirements.txt` dependencies
- Check ECR permissions

### Gateway Connection Errors

**Solutions**:
1. Verify gateway URL in SSM:
   ```bash
   aws ssm get-parameter --name /concierge-agent/default/gateway-url
   ```

2. Enable gateway debug logging:
   ```bash
   aws bedrock-agentcore-control update-gateway \
     --gateway-identifier <GATEWAY_ID> \
     --exception-level DEBUG
   ```

## Cleanup

Remove infrastructure from project root:

```bash
cd ..
npm run clean:frontend  # Delete Amplify Hosting
npm run clean:agent     # Delete agent stack
npm run clean:mcp       # Delete MCP stacks
```

**Note**: Some resources may require manual deletion:
- CloudWatch log groups
- SSM parameters
