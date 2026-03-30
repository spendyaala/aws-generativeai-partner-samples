import { defineBackend } from '@aws-amplify/backend';
import { data } from './data/resource';
import { CfnOutput } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load deployment config for unique export names
const configPath = path.join(__dirname, '..', 'deployment-config.json');
const deploymentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const deploymentId = deploymentConfig.deploymentId;

const backend = defineBackend({
  data,
});

// Create a Cognito Identity Pool for guest (unauthenticated) access
// This gives the browser temporary IAM credentials to call AgentCore Runtime
// allowClassicFlow enables basic auth flow so session policies don't restrict permissions
const identityPool = new cognito.CfnIdentityPool(backend.stack, 'GuestIdentityPool', {
  allowUnauthenticatedIdentities: true,
  allowClassicFlow: true,
  identityPoolName: `concierge-guest-${deploymentId}`,
});

// IAM role for unauthenticated (guest) users
const unauthRole = new iam.Role(backend.stack, 'GuestUnauthRole', {
  assumedBy: new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPool.ref },
      'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'unauthenticated' },
    },
    'sts:AssumeRoleWithWebIdentity'
  ),
});

// Grant guest users permission to invoke AgentCore Runtime
// SECURITY NOTE: resources: ['*'] is used because the AgentCore Runtime ARN is not
// known until the agent-stack is deployed (circular dependency). For production,
// scope this to the specific runtime ARN after deployment, e.g.:
//   resources: [`arn:aws:bedrock-agentcore:${region}:${account}:runtime/${runtimeId}`]
unauthRole.addToPolicy(new iam.PolicyStatement({
  actions: [
    'bedrock-agentcore:InvokeAgentRuntime',
    'bedrock-agentcore:InvokeAgentRuntimeWithResponseStream',
  ],
  resources: ['*'],
}));

// Attach the role to the identity pool
new cognito.CfnIdentityPoolRoleAttachment(backend.stack, 'GuestRoleAttachment', {
  identityPoolId: identityPool.ref,
  roles: {
    unauthenticated: unauthRole.roleArn,
  },
});

// Export identity pool ID and guest role ARN for the web UI
new CfnOutput(backend.stack, 'IdentityPoolId', {
  value: identityPool.ref,
  exportName: `ConciergeAgent-${deploymentId}-IdentityPoolId`,
  description: 'Cognito Identity Pool ID for guest access',
});

new CfnOutput(backend.stack, 'GuestRoleArn', {
  value: unauthRole.roleArn,
  exportName: `ConciergeAgent-${deploymentId}-GuestRoleArn`,
  description: 'IAM Role ARN for guest (unauthenticated) users',
});

// Table exports with deployment ID
new CfnOutput(backend.stack, 'UserProfileTableNameExport', {
  value: backend.data.resources.tables['UserProfile'].tableName,
  exportName: `ConciergeAgent-${deploymentId}-Data-UserProfileTableName`,
  description: 'DynamoDB UserProfile table name (unique per deployment)'
});

new CfnOutput(backend.stack, 'ItineraryTableNameExport', {
  value: backend.data.resources.tables['Itinerary'].tableName,
  exportName: `ConciergeAgent-${deploymentId}-Data-ItineraryTableName`,
  description: 'DynamoDB Itinerary table name (unique per deployment)'
});

new CfnOutput(backend.stack, 'FeedbackTableNameExport', {
  value: backend.data.resources.tables['Feedback'].tableName,
  exportName: `ConciergeAgent-${deploymentId}-Data-FeedbackTableName`,
  description: 'DynamoDB Feedback table name (unique per deployment)'
});
