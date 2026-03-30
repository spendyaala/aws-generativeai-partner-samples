"""
Gateway client utilities for AgentCore Gateway integration.
"""

import os
import re
import boto3
import logging
from strands.tools.mcp import MCPClient
from mcp.client.streamable_http import streamablehttp_client

logger = logging.getLogger(__name__)


def get_ssm_parameter(parameter_name: str, region: str) -> str:
    """
    Fetch parameter from SSM Parameter Store.

    Args:
        parameter_name: SSM parameter name
        region: AWS region

    Returns:
        Parameter value
    """
    ssm = boto3.client("ssm", region_name=region)
    try:
        response = ssm.get_parameter(Name=parameter_name)
        return response["Parameter"]["Value"]
    except ssm.exceptions.ParameterNotFound:
        raise ValueError(f"SSM parameter not found: {parameter_name}")
    except Exception as e:
        raise ValueError(f"Failed to retrieve SSM parameter {parameter_name}: {e}")


def get_gateway_client(tool_filter_pattern: str, prefix: str = "gateway") -> MCPClient:
    """
    Get Gateway MCP client with specified tool filtering.

    Args:
        tool_filter_pattern: Regex pattern to filter tools (e.g., "^traveltools___")
        prefix: Prefix for tool names (default: "gateway")

    Returns:
        MCPClient filtered to specified tools
    """
    region = os.environ.get("AWS_REGION", "us-east-1")
    deployment_id = os.getenv("DEPLOYMENT_ID", "default")

    gateway_url = get_ssm_parameter(
        f"/concierge-agent/{deployment_id}/gateway-url", region
    )

    logger.info(
        f"Creating Gateway MCP client with filter: {tool_filter_pattern}, prefix: {prefix}"
    )

    tool_filters = {"allowed": [re.compile(tool_filter_pattern)]}

    client = MCPClient(
        lambda: streamablehttp_client(url=gateway_url),
        prefix=prefix,
        tool_filters=tool_filters,
    )

    logger.info(f"✅ Gateway MCP client created with filter: {tool_filter_pattern}")
    return client
