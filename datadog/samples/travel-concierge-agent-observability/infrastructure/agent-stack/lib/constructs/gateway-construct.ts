import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as bedrockagentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { Construct } from 'constructs';

export interface GatewayProps {
  gatewayName: string;
  mcpRuntimeArns: { name: string; arn: string }[];
}

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required: string[];
  };
}

const TRAVEL_TOOLS: ToolDef[] = [
  {
    name: 'travel_search',
    description: 'Search the internet for travel-related information.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  {
    name: 'travel_hotel_search',
    description: 'Search for hotels using Google Hotels via SerpAPI.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Hotel search query' },
        check_in_date: { type: 'string', description: 'Check-in date YYYY-MM-DD' },
        check_out_date: { type: 'string', description: 'Check-out date YYYY-MM-DD' },
      },
      required: ['query', 'check_in_date', 'check_out_date'],
    },
  },
  {
    name: 'travel_flight_search',
    description: 'Search for flights using Google Flights via SerpAPI.',
    inputSchema: {
      type: 'object',
      properties: {
        departure_id: { type: 'string', description: 'Departure airport code' },
        arrival_id: { type: 'string', description: 'Arrival airport code' },
        outbound_date: { type: 'string', description: 'Outbound date YYYY-MM-DD' },
        return_date: { type: 'string', description: 'Return date YYYY-MM-DD (optional)' },
      },
      required: ['departure_id', 'arrival_id', 'outbound_date'],
    },
  },
];

const ITINERARY_TOOLS: ToolDef[] = [
  {
    name: 'itinerary_get',
    description: 'Get the user\'s saved itinerary.',
    inputSchema: {
      type: 'object',
      properties: { user_id: { type: 'string', description: 'User identifier' } },
      required: ['user_id'],
    },
  },
  {
    name: 'itinerary_save',
    description: 'Save an item to the user\'s itinerary.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        item_type: { type: 'string', description: 'flight, hotel, activity, or restaurant' },
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        details: { type: 'string' },
        location: { type: 'string' },
        price: { type: 'string' },
        time_of_day: { type: 'string' },
      },
      required: ['user_id', 'item_type', 'title', 'date'],
    },
  },
  {
    name: 'itinerary_remove',
    description: 'Remove an item from the itinerary.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        item_id: { type: 'string', description: 'ID of the item to remove' },
      },
      required: ['user_id', 'item_id'],
    },
  },
  {
    name: 'itinerary_clear',
    description: 'Clear all items from the user\'s itinerary.',
    inputSchema: {
      type: 'object',
      properties: { user_id: { type: 'string' } },
      required: ['user_id'],
    },
  },
  {
    name: 'itinerary_update_date',
    description: 'Update the date for an itinerary item.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string' },
        item_id: { type: 'string' },
        new_date: { type: 'string', description: 'New date YYYY-MM-DD' },
      },
      required: ['user_id', 'item_id', 'new_date'],
    },
  },
];

const TOOL_MAP: Record<string, ToolDef[]> = {
  TravelTools: TRAVEL_TOOLS,
  ItineraryTools: ITINERARY_TOOLS,
};

// Lambda proxy code: receives tool calls from Gateway, forwards to AgentCore Runtime via SigV4
const PROXY_LAMBDA_CODE = `
import json
import os
import urllib.parse
import urllib.request
import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

def handler(event, context):
    """
    Gateway Lambda target handler.
    event = tool input arguments (flat dict from inputSchema properties)
    context.client_context.custom has bedrockAgentCoreToolName = targetname___toolname
    """
    runtime_arn = os.environ['RUNTIME_ARN']
    region = os.environ.get('AWS_REGION_NAME', os.environ.get('AWS_REGION', 'us-east-1'))

    # Extract the actual tool name (strip target prefix)
    delimiter = "___"
    try:
        full_tool_name = context.client_context.custom['bedrockAgentCoreToolName']
        tool_name = full_tool_name[full_tool_name.index(delimiter) + len(delimiter):]
    except Exception:
        tool_name = "unknown"

    # Build MCP JSON-RPC tools/call request
    mcp_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": event
        }
    }

    # Build the runtime invocation URL
    encoded_arn = urllib.parse.quote(runtime_arn, safe='')
    url = f"https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{encoded_arn}/invocations"

    body = json.dumps(mcp_request)

    # Sign the request with SigV4
    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()

    request = AWSRequest(method='POST', url=url, data=body, headers={
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    })
    SigV4Auth(credentials, 'bedrock-agentcore', region).add_auth(request)

    # Make the request
    req = urllib.request.Request(
        url,
        data=body.encode('utf-8'),
        headers=dict(request.headers),
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=55) as resp:
            response_body = resp.read().decode('utf-8')
            result = json.loads(response_body)
            # Extract the MCP result content
            if 'result' in result and 'content' in result['result']:
                content = result['result']['content']
                # Return text content for the Gateway
                texts = [c.get('text', '') for c in content if c.get('type') == 'text']
                return {"result": "\\n".join(texts) if texts else json.dumps(content)}
            return {"result": json.dumps(result)}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        return {"error": f"Runtime error {e.code}: {error_body}"}
    except Exception as e:
        return {"error": str(e)}
`;

export class GatewayConstruct extends Construct {
  public readonly gateway: bedrockagentcore.CfnGateway;
  public readonly gatewayArn: string;
  public readonly gatewayId: string;
  public readonly gatewayUrl: string;
  public readonly targets: bedrockagentcore.CfnGatewayTarget[];

  constructor(scope: Construct, id: string, props: GatewayProps) {
    super(scope, id);

    const stack = cdk.Stack.of(this);

    // Gateway Role with permissions to invoke Lambda functions
    const gatewayRole = new iam.Role(this, 'GatewayRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
      description: 'Execution role for AgentCore Gateway',
      inlinePolicies: {
        GatewayPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'LambdaInvokeAccess',
              effect: iam.Effect.ALLOW,
              actions: ['lambda:InvokeFunction'],
              resources: [`arn:aws:lambda:${stack.region}:${stack.account}:function:*`],
            }),
            new iam.PolicyStatement({
              sid: 'BedrockModelAccess',
              effect: iam.Effect.ALLOW,
              actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
              resources: [
                `arn:aws:bedrock:*::foundation-model/*`,
                `arn:aws:bedrock:*:${stack.account}:inference-profile/*`
              ],
            }),
            new iam.PolicyStatement({
              sid: 'CloudWatchLogsAccess',
              effect: iam.Effect.ALLOW,
              actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
              resources: [`arn:aws:logs:${stack.region}:${stack.account}:log-group:/aws/bedrock-agentcore/*`],
            }),
          ],
        }),
      },
    });

    // Create Gateway
    this.gateway = new bedrockagentcore.CfnGateway(this, 'Gateway', {
      name: props.gatewayName,
      roleArn: gatewayRole.roleArn,
      protocolType: 'MCP',
      protocolConfiguration: {
        mcp: {
          supportedVersions: ['2025-03-26']
        }
      },
      // SECURITY NOTE: authorizerType 'NONE' means the gateway has no request-level
      // authorization. This is acceptable here because the gateway is only invoked by the
      // supervisor agent's IAM-authenticated runtime (not exposed to end users directly).
      // For production deployments with external callers, use 'CUSTOM' with a Lambda
      // authorizer or restrict access via resource policies.
      authorizerType: 'NONE',
      description: 'AgentCore Gateway with MCP protocol'
    });

    this.gatewayArn = this.gateway.attrGatewayArn;
    this.gatewayId = this.gateway.attrGatewayIdentifier;
    this.gatewayUrl = this.gateway.attrGatewayUrl;

    // Create Lambda proxy + Gateway target for each MCP runtime
    this.targets = [];

    props.mcpRuntimeArns.forEach((mcpRuntime, index) => {
      const runtimeUrl = this.constructRuntimeUrl(mcpRuntime.arn, stack.region);

      // Lambda proxy that forwards MCP tool calls to the AgentCore Runtime via IAM SigV4
      const proxyFn = new lambda.Function(this, `McpProxy${index}`, {
        functionName: `${props.gatewayName}-proxy-${mcpRuntime.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'index.handler',
        timeout: cdk.Duration.seconds(60),
        code: lambda.Code.fromInline(PROXY_LAMBDA_CODE),
        environment: {
          RUNTIME_ARN: mcpRuntime.arn,
          AWS_REGION_NAME: stack.region,
        },
      });

      // Grant the proxy Lambda permission to invoke the AgentCore Runtime
      proxyFn.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'bedrock-agentcore:InvokeRuntime',
          'bedrock-agentcore:InvokeRuntimeWithResponseStream',
          'bedrock-agentcore:InvokeAgentRuntime',
        ],
        resources: [mcpRuntime.arn],
      }));

      // Allow the Gateway role to invoke this Lambda
      proxyFn.grantInvoke(gatewayRole);

      // Build inline tool schema from known tool definitions
      const tools = TOOL_MAP[mcpRuntime.name] || [];
      const inlinePayload = tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(t.inputSchema.properties).map(([k, v]) => [k, { type: 'string', description: (v as any).description || '' }])
          ),
          required: t.inputSchema.required,
        },
      }));

      const mcpTarget = new bedrockagentcore.CfnGatewayTarget(this, `McpTarget${index}`, {
        gatewayIdentifier: this.gatewayId,
        name: mcpRuntime.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: `MCP Server: ${mcpRuntime.name}`,
        targetConfiguration: {
          mcp: {
            lambda: {
              lambdaArn: proxyFn.functionArn,
              toolSchema: {
                inlinePayload,
              },
            },
          },
        },
        credentialProviderConfigurations: [
          { credentialProviderType: 'GATEWAY_IAM_ROLE' },
        ],
      });
      mcpTarget.addDependency(this.gateway);
      this.targets.push(mcpTarget);
    });
  }

  private constructRuntimeUrl(runtimeArn: string, region: string): string {
    return cdk.Fn.join('', [
      `https://bedrock-agentcore.${region}.amazonaws.com/runtimes/`,
      cdk.Fn.join('%2F', cdk.Fn.split('/', cdk.Fn.join('%3A', cdk.Fn.split(':', runtimeArn)))),
      '/invocations'
    ]);
  }
}
