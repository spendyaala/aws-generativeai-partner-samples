FROM python:3.13-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Expose port for MCP server
EXPOSE 8000

# Datadog LLM Observability via pure OTEL (no ddtrace agent required)
# dd_init.py configures TracerProvider to export traces to Datadog
ENV DD_SITE=datadoghq.com
ENV OTEL_SERVICE_NAME=itinerary-mcp-server

# Disable AgentCore's built-in ADOT — using Datadog OTEL instead
ENV DISABLE_ADOT_OBSERVABILITY=true

# Required for GenAI semantic conventions (v1.37+)
ENV OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the MCP server — entrypoint resolves DD_API_KEY, dd_init.py configures OTEL
CMD ["bash", "entrypoint.sh"]
