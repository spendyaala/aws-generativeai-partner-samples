#!/bin/bash
# Entrypoint for supervisor agent — Datadog LLM Observability via pure OTEL.
#
# How it works:
# 1. DD_API_KEY is resolved from Secrets Manager
# 2. dd_init.py (imported first in agent.py) configures an OTEL TracerProvider
#    that exports traces directly to Datadog's OTLP endpoint
# 3. strands-agents[otel] automatically emits GenAI spans via that TracerProvider
# 4. DISABLE_ADOT_OBSERVABILITY=true prevents AgentCore's ADOT from conflicting
#
# No ddtrace or Datadog Agent required.

if [ -n "$DD_API_KEY_SECRET_ARN" ] && [ -z "$DD_API_KEY" ]; then
    echo "Resolving DD_API_KEY from Secrets Manager..."
    export DD_API_KEY=$(python -c "
import boto3, os
client = boto3.client('secretsmanager', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
print(client.get_secret_value(SecretId=os.environ['DD_API_KEY_SECRET_ARN'])['SecretString'])
" 2>/dev/null)
    if [ -n "$DD_API_KEY" ]; then
        echo "DD_API_KEY resolved successfully"
    else
        echo "WARNING: Failed to resolve DD_API_KEY from Secrets Manager"
    fi
fi

exec python agent.py
