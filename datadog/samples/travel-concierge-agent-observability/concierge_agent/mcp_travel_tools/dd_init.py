"""
Datadog LLM Observability initialization for MCP Travel Tools server via OpenTelemetry.

AgentCore integration approach (per PR #1097):
- DISABLE_ADOT_OBSERVABILITY=true disables AgentCore's built-in ADOT/CloudWatch pipeline
- OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental enables GenAI semantic conventions
- A custom TracerProvider with OTLPSpanExporter sends traces directly to Datadog
- dd-otlp-source=llmobs routes traces to Datadog LLM Observability views
- DD_API_KEY is resolved from Secrets Manager at startup (via entrypoint.sh and here as backup)

No ddtrace or Datadog Agent required — pure OTEL export to Datadog.

Must be imported FIRST in every Python entry point (before any other imports).
"""
import os
import logging

logger = logging.getLogger(__name__)

# Disable AgentCore's built-in ADOT so we can set our own TracerProvider
os.environ.setdefault("DISABLE_ADOT_OBSERVABILITY", "true")

# Required for GenAI semantic conventions (v1.37+)
os.environ.setdefault("OTEL_SEMCONV_STABILITY_OPT_IN", "gen_ai_latest_experimental")


def _resolve_dd_api_key():
    """Resolve DD_API_KEY from Secrets Manager if not already set."""
    secret_arn = os.environ.get("DD_API_KEY_SECRET_ARN")
    if not secret_arn or os.environ.get("DD_API_KEY"):
        return
    try:
        import boto3
        client = boto3.client("secretsmanager", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        resp = client.get_secret_value(SecretId=secret_arn)
        os.environ["DD_API_KEY"] = resp["SecretString"]
        logger.info("DD_API_KEY resolved from Secrets Manager")
    except Exception as e:
        logger.error("Failed to resolve DD_API_KEY: %s", e)


def _configure_datadog_otel():
    """Configure OpenTelemetry TracerProvider to export traces to Datadog LLM Observability."""
    dd_api_key = os.environ.get("DD_API_KEY", "")
    dd_site = os.environ.get("DD_SITE", "datadoghq.com")
    service_name = os.environ.get("OTEL_SERVICE_NAME", "travel-mcp-server")

    if not dd_api_key:
        logger.warning("DD_API_KEY not set. Traces will not be sent to Datadog.")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource

        resource = Resource.create({"service.name": service_name})
        exporter = OTLPSpanExporter(
            endpoint=f"https://trace.agent.{dd_site}/v1/traces",
            headers={"dd-api-key": dd_api_key, "dd-otlp-source": "llmobs"},
        )
        provider = TracerProvider(resource=resource)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        # Ensure spans are flushed on shutdown
        import atexit
        atexit.register(provider.shutdown)

        logger.info("Datadog LLM Observability configured (service: %s)", service_name)
    except Exception as e:
        logger.error("Failed to configure Datadog OTEL: %s", e)


_resolve_dd_api_key()
_configure_datadog_otel()
