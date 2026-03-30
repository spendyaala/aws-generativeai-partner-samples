FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim
WORKDIR /app

# Configure UV for container environment
ENV UV_SYSTEM_PYTHON=1 UV_COMPILE_BYTECODE=1

# Copy requirements and install dependencies
COPY requirements.txt .
RUN uv pip install -r requirements.txt

# Set environment variables
ENV AWS_REGION=us-east-1
ENV AWS_DEFAULT_REGION=us-east-1
ENV DOCKER_CONTAINER=1
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Datadog LLM Observability via pure OTEL (no ddtrace agent required)
# strands-agents[otel] emits OTEL GenAI spans; dd_init.py configures TracerProvider
ENV DD_SITE=datadoghq.com
ENV OTEL_SERVICE_NAME=supervisor-agent

# Disable AgentCore's built-in ADOT — using Datadog OTEL instead
ENV DISABLE_ADOT_OBSERVABILITY=true

# Required for strands-agents GenAI semantic conventions (v1.37+)
ENV OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Create non-root user
RUN useradd -m -u 1000 bedrock_agentcore && \
    chown -R bedrock_agentcore:bedrock_agentcore /app
USER bedrock_agentcore

# Expose ports
EXPOSE 8080
EXPOSE 8000

# Add HEALTHCHECK 
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD pgrep -f "python agent.py" || exit 1

# Run the agent — entrypoint resolves DD_API_KEY, dd_init.py configures OTEL
CMD ["bash", "entrypoint.sh"]
