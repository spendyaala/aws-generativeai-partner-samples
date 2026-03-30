import * as cdk from 'aws-cdk-lib';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { GatewayConstruct } from './constructs/gateway-construct';
import * as path from 'path';
import * as fs from 'fs';

// Sanitize names for AgentCore resources (alphanumeric + underscores)
const sanitizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

// Load deployment config
const deploymentConfig = JSON.parse(fs.readFileSync('../../deployment-config.json', 'utf-8'));
const DEPLOYMENT_ID = deploymentConfig.deploymentId;

export class AgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Add deployment info
    cdk.Tags.of(this).add('DeploymentId', DEPLOYMENT_ID);
    cdk.Tags.of(this).add('DeploymentName', deploymentConfig.deploymentName || DEPLOYMENT_ID);

    // Import DynamoDB tables
    const userProfileTableName = cdk.Fn.importValue(`ConciergeAgent-${DEPLOYMENT_ID}-Data-UserProfileTableName`);
    const itineraryTableName = cdk.Fn.importValue(`ConciergeAgent-${DEPLOYMENT_ID}-Data-ItineraryTableName`);
    const feedbackTableName = cdk.Fn.importValue(`ConciergeAgent-${DEPLOYMENT_ID}-Data-FeedbackTableName`);

    // Import MCP runtime ARNs (using deployment ID in stack names)
    const travelRuntimeArn = cdk.Fn.importValue(`TravelStack-${DEPLOYMENT_ID}-RuntimeArn`);
    const itineraryRuntimeArn = cdk.Fn.importValue(`ItineraryStack-${DEPLOYMENT_ID}-RuntimeArn`);

    // 1. Create Memory using L2 construct
    const memory = new agentcore.Memory(this, 'Memory', {
      memoryName: sanitizeName(`memory_${this.stackName}`),
      description: 'Short-term memory for Concierge Agent',
    });

    // 2. Create execution role for main agent
    const agentRole = new iam.Role(this, 'AgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'Execution role for Concierge Agent'
    });

    // Grant DynamoDB permissions
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:Scan', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:DeleteItem', 'dynamodb:BatchWriteItem'],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${userProfileTableName}`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${userProfileTableName}/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${itineraryTableName}`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${itineraryTableName}/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${feedbackTableName}`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${feedbackTableName}/index/*`
      ]
    }));

    // Grant CloudWatch Logs permissions
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogGroups', 'logs:DescribeLogStreams', 'logs:GetLogEvents', 'logs:FilterLogEvents'],
      resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:*`]
    }));

    // Grant Memory access
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'bedrock-agentcore:GetMemory',
        'bedrock-agentcore:ListMemories',
        'bedrock-agentcore:CreateEvent',
        'bedrock-agentcore:GetEvent',
        'bedrock-agentcore:ListEvents',
        'bedrock-agentcore:RetrieveMemoryRecords'
      ],
      resources: [memory.memoryArn]
    }));

    // Grant Bedrock model access
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        `arn:aws:bedrock:*::foundation-model/*`,
        `arn:aws:bedrock:*:${this.account}:inference-profile/*`
      ]
    }));

    // Grant Gateway invoke permissions (for runtime to call gateway)
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock-agentcore:InvokeGateway'],
      resources: ['*']
    }));

    // Grant ECR permissions (required for runtime to pull container image)
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage'
      ],
      resources: ['*']
    }));

    // 3. Create main agent runtime using L2 construct
    const ddApiKeySecret = secretsmanager.Secret.fromSecretNameV2(this, 'DdApiKeySecret', 'datadog/aig-agent/api-key');
    ddApiKeySecret.grantRead(agentRole);

    const baseEnvVars = {
      MEMORY_ID: memory.memoryId,
      USER_PROFILE_TABLE_NAME: userProfileTableName,
      ITINERARY_TABLE_NAME: itineraryTableName,
      FEEDBACK_TABLE_NAME: feedbackTableName,
      AWS_REGION: this.region,
      DEPLOYMENT_ID: DEPLOYMENT_ID,
      DD_API_KEY_SECRET_ARN: ddApiKeySecret.secretArn,
      DD_SITE: 'datadoghq.com',
      OTEL_SERVICE_NAME: 'supervisor-agent',
      OTEL_SEMCONV_STABILITY_OPT_IN: 'gen_ai_latest_experimental',
      // Disable AgentCore's built-in ADOT — using Datadog OTEL instead
      DISABLE_ADOT_OBSERVABILITY: 'true',
    };

    // Create runtime with IAM auth
    const runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: sanitizeName(`agent_${this.stackName}`),
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
        path.join(__dirname, '../../..', 'concierge_agent', 'supervisor_agent')
      ),
      executionRole: agentRole,
      protocolConfiguration: agentcore.ProtocolType.HTTP,
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
      authorizerConfiguration: agentcore.RuntimeAuthorizerConfiguration.usingIAM(),
      environmentVariables: baseEnvVars,
      description: 'Concierge Agent Runtime'
    });

    // 4. Create Gateway with IAM auth
    const gateway = new GatewayConstruct(this, 'Gateway', {
      gatewayName: sanitizeName(`gateway_${this.stackName}`).replace(/_/g, '-'),
      mcpRuntimeArns: [
        { name: 'ItineraryTools', arn: itineraryRuntimeArn },
        { name: 'TravelTools', arn: travelRuntimeArn }
      ],
    });

    // Store gateway URL in SSM Parameter Store for runtime to access
    const gatewayUrlParameter = new cdk.aws_ssm.StringParameter(this, 'GatewayUrlParameter', {
      parameterName: `/concierge-agent/${DEPLOYMENT_ID}/gateway-url`,
      stringValue: gateway.gatewayUrl,
      description: 'AgentCore Gateway URL for supervisor agent',
      tier: cdk.aws_ssm.ParameterTier.STANDARD,
    });

    // Grant runtime permission to read SSM parameter
    agentRole.addToPolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [gatewayUrlParameter.parameterArn]
    }));

    // Outputs
    new cdk.CfnOutput(this, 'MainRuntimeArn', {
      value: runtime.agentRuntimeArn,
      exportName: `${this.stackName}-MainRuntimeArn`
    });

    new cdk.CfnOutput(this, 'MainRuntimeId', {
      value: runtime.agentRuntimeId,
      exportName: `${this.stackName}-MainRuntimeId`
    });

    new cdk.CfnOutput(this, 'MemoryId', {
      value: memory.memoryId,
      exportName: `${this.stackName}-MemoryId`
    });

    new cdk.CfnOutput(this, 'GatewayUrl', {
      value: gateway.gatewayUrl,
      exportName: `${this.stackName}-GatewayUrl`,
      description: 'Gateway URL for MCP client connections (IAM auth)'
    });

    new cdk.CfnOutput(this, 'GatewayId', {
      value: gateway.gatewayId,
      exportName: `${this.stackName}-GatewayId`,
      description: 'Gateway ID'
    });

    new cdk.CfnOutput(this, 'GatewayArn', {
      value: gateway.gatewayArn,
      exportName: `${this.stackName}-GatewayArn`,
      description: 'Gateway ARN'
    });

    new cdk.CfnOutput(this, 'GatewayTargetCount', {
      value: gateway.targets.length.toString(),
      description: 'Number of gateway targets configured'
    });
  }
}
