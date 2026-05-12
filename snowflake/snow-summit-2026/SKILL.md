---
name: sales-ops-cortex-agent-mcp-quick
description: "Build a Sales Ops Cortex Agent with Semantic View, MCP Server, and Amazon Quick OAuth integration. Use when: user wants to create a sales ops agent, build a demo with MCP and Amazon Quick spaces, chat agents and flows, set up Cortex Analyst over sales data. Triggers: sales ops, sales operations, cortex agent quicksight, MCP quick connector, sales demo, revenue pipeline agent."
---

# Sales Ops: Cortex Agent + MCP + Amazon Quick

Builds a complete Sales Operations analytics pipeline: Semantic View, Cortex Agent, MCP Server, and OAuth integration for Amazon Quick MCP Connector.

## When to Use

Use this skill when someone asks:
- "Build a sales ops agent with MCP and Amazon Quick"
- "Create a Cortex Agent for sales operations data"
- "Set up a sales analytics demo with QuickSight integration"
- "Expose a sales agent to Amazon QuickSight via MCP"

## Prerequisites

- Snowflake account with ACCOUNTADMIN access
- 6 sales ops tables loaded in a schema (transactions, customers, products, reps, pipeline, marketing)
- A warehouse for query execution
- Amazon QuickSight Author subscription or higher

## Workflow

### Step 1: Gather Information

**Ask user for the following:**

```
To build your Sales Ops agent and QuickSight integration, provide:

1. DATABASE   : Database containing your sales ops tables
2. SCHEMA     : Schema containing your sales ops tables
3. WAREHOUSE  : Warehouse for query execution
4. ACCOUNT    : Snowflake account identifier (e.g., abc12345)
5. ROLE       : Snowflake role
```

If user doesn't know their account identifier, suggest:
```sql
SELECT CURRENT_ACCOUNT();
```

Verify the 6 required tables exist:
```sql
SHOW TABLES IN SCHEMA <DATABASE>.<SCHEMA>;
```

Expected tables:
- `SALES_TRANSACTIONS_FACT_TABLE`
- `CUSTOMER_DIMENSION_TABLE`
- `PRODUCT_CATALOG_TABLE`
- `SALES_REP_PERFORMANCE_TABLE`
- `SALES_PIPELINE_OPPORTUNITIES`
- `MARKETING_ATTRIBUTION_TABLE`

**Stop**: Confirm all values and verify tables exist before proceeding.

---

### Step 2: Create Semantic View

**Execute:**

```sql
CALL SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML(
  '<DATABASE>.<SCHEMA>',
  $$
name: SALES_OPS_SEMANTIC_VIEW
description: >
  Semantic view for Sales Operations analytics covering revenue, pipeline health,
  rep performance, customer segmentation, product mix, and marketing attribution.

tables:
  - name: TRANSACTIONS
    description: Sales transactions fact table with closed deals, revenue, and attribution.
    synonyms: [deals, sales, orders, closed deals]
    base_table:
      database: <DATABASE>
      schema: <SCHEMA>
      table: SALES_TRANSACTIONS_FACT_TABLE
    primary_key:
      columns: [TRANSACTION_ID]
    dimensions:
      - name: TRANSACTION_ID
        synonyms: [deal id, order id]
        description: Unique transaction identifier
        expr: TRANSACTION_ID
        data_type: TEXT
      - name: REGION
        synonyms: [geo, geography]
        description: "Geographic region: North America, EMEA, APAC, LATAM"
        expr: REGION
        data_type: TEXT
        sample_values: [North America, EMEA, APAC, LATAM]
      - name: LEAD_SOURCE
        synonyms: [source, acquisition channel]
        description: "Lead source: Inbound, Outbound, Event, Partner"
        expr: LEAD_SOURCE
        data_type: TEXT
        sample_values: [Inbound, Outbound, Event, Partner]
      - name: CUSTOMER_ID
        description: Foreign key to customers dimension
        expr: CUSTOMER_ID
        data_type: TEXT
      - name: PRODUCT_SKU
        description: Foreign key to products dimension
        expr: PRODUCT_SKU
        data_type: TEXT
      - name: SALES_REP_ID
        description: Foreign key to sales reps dimension
        expr: SALES_REP_ID
        data_type: TEXT
    time_dimensions:
      - name: TRANSACTION_DATE
        synonyms: [close date, sale date, deal date]
        description: Date the transaction was recorded
        expr: TRANSACTION_DATE
        data_type: DATE
      - name: FORECAST_CLOSE_DATE
        synonyms: [expected close, forecasted date]
        description: Originally forecasted close date
        expr: FORECAST_CLOSE_DATE
        data_type: DATE
      - name: ACTUAL_CLOSE_DATE
        synonyms: [real close date]
        description: Actual date the deal closed
        expr: ACTUAL_CLOSE_DATE
        data_type: DATE
    facts:
      - name: DEAL_SIZE_USD
        synonyms: [deal value, revenue, amount, ARR]
        description: Deal size in USD
        expr: DEAL_SIZE_USD
        data_type: NUMBER
      - name: QUANTITY
        synonyms: [units, qty]
        description: Quantity of product units
        expr: QUANTITY
        data_type: NUMBER
      - name: DISCOUNT_PERCENTAGE
        synonyms: [discount, discount pct]
        description: Discount percentage applied
        expr: DISCOUNT_PERCENTAGE
        data_type: NUMBER
      - name: SALES_CYCLE_DAYS
        synonyms: [cycle length, time to close]
        description: Days from opportunity creation to close
        expr: SALES_CYCLE_DAYS
        data_type: NUMBER
      - name: CLOSE_PROBABILITY_AT_START
        synonyms: [initial probability]
        description: Win probability at deal start
        expr: CLOSE_PROBABILITY_AT_START
        data_type: NUMBER
    metrics:
      - name: TOTAL_REVENUE
        synonyms: [total sales, gross revenue]
        description: Total revenue in USD
        expr: SUM(DEAL_SIZE_USD)
      - name: TOTAL_DEALS
        synonyms: [deal count, number of deals]
        description: Total number of transactions
        expr: COUNT(TRANSACTION_ID)
      - name: AVG_DEAL_SIZE
        synonyms: [average deal, mean deal size]
        description: Average deal size in USD
        expr: AVG(DEAL_SIZE_USD)
      - name: AVG_DISCOUNT
        synonyms: [average discount]
        description: Average discount percentage
        expr: AVG(DISCOUNT_PERCENTAGE)
      - name: AVG_SALES_CYCLE
        synonyms: [average cycle, mean time to close]
        description: Average days to close
        expr: AVG(SALES_CYCLE_DAYS)

  - name: CUSTOMERS
    description: Customer dimension with firmographics, LTV, churn risk, expansion potential.
    synonyms: [accounts, clients, companies]
    base_table:
      database: <DATABASE>
      schema: <SCHEMA>
      table: CUSTOMER_DIMENSION_TABLE
    primary_key:
      columns: [CUSTOMER_ID]
    dimensions:
      - name: CUSTOMER_ID
        synonyms: [account id, client id]
        description: Unique customer identifier
        expr: CUSTOMER_ID
        data_type: TEXT
      - name: COMPANY_NAME
        synonyms: [account name, company, client name]
        description: Customer company name
        expr: COMPANY_NAME
        data_type: TEXT
      - name: INDUSTRY
        synonyms: [vertical, sector]
        description: "Industry: Technology, Finance, Healthcare, Manufacturing, Retail"
        expr: INDUSTRY
        data_type: TEXT
        sample_values: [Technology, Finance, Healthcare, Manufacturing, Retail]
      - name: COMPANY_SIZE
        synonyms: [segment, account size]
        description: "Company size: SMB, Mid-Market, Enterprise"
        expr: COMPANY_SIZE
        data_type: TEXT
        sample_values: [SMB, Mid-Market, Enterprise]
      - name: ANNUAL_REVENUE_BAND
        synonyms: [revenue band]
        description: Annual revenue band
        expr: ANNUAL_REVENUE_BAND
        data_type: TEXT
      - name: EXPANSION_POTENTIAL
        synonyms: [growth potential, upsell potential]
        description: "Expansion potential: High, Medium, Low"
        expr: EXPANSION_POTENTIAL
        data_type: TEXT
        sample_values: [High, Medium, Low]
    time_dimensions:
      - name: FIRST_PURCHASE_DATE
        synonyms: [customer since, acquisition date]
        description: Date of first purchase
        expr: FIRST_PURCHASE_DATE
        data_type: DATE
    facts:
      - name: CUSTOMER_LIFETIME_VALUE
        synonyms: [CLV, LTV, lifetime value]
        description: Customer lifetime value in USD
        expr: CUSTOMER_LIFETIME_VALUE
        data_type: NUMBER
      - name: CHURN_RISK_SCORE
        synonyms: [churn risk, attrition risk]
        description: Churn risk score (0-100)
        expr: CHURN_RISK_SCORE
        data_type: NUMBER
      - name: TOTAL_CONTRACTS_COUNT
        synonyms: [contract count]
        description: Total contracts with this customer
        expr: TOTAL_CONTRACTS_COUNT
        data_type: NUMBER
    metrics:
      - name: AVG_LIFETIME_VALUE
        synonyms: [average CLV, mean LTV]
        description: Average customer lifetime value
        expr: AVG(CUSTOMER_LIFETIME_VALUE)
      - name: AVG_CHURN_RISK
        synonyms: [average churn risk]
        description: Average churn risk score
        expr: AVG(CHURN_RISK_SCORE)
      - name: TOTAL_CUSTOMERS
        synonyms: [customer count]
        description: Total unique customers
        expr: COUNT(DISTINCT CUSTOMER_ID)

  - name: PRODUCTS
    description: Product catalog with pricing, tiers, renewal and upsell rates.
    synonyms: [catalog, SKUs, product list]
    base_table:
      database: <DATABASE>
      schema: <SCHEMA>
      table: PRODUCT_CATALOG_TABLE
    primary_key:
      columns: [PRODUCT_SKU]
    dimensions:
      - name: PRODUCT_SKU
        synonyms: [SKU, product id]
        description: Unique product SKU
        expr: PRODUCT_SKU
        data_type: TEXT
      - name: PRODUCT_NAME
        synonyms: [name, product, item name]
        description: Product display name
        expr: PRODUCT_NAME
        data_type: TEXT
      - name: PRODUCT_CATEGORY
        synonyms: [category, product line]
        description: Product category grouping
        expr: PRODUCT_CATEGORY
        data_type: TEXT
      - name: PRODUCT_FEATURE
        synonyms: [feature, capability]
        description: Primary product feature
        expr: PRODUCT_FEATURE
        data_type: TEXT
      - name: PRODUCT_TIER
        synonyms: [tier, pricing tier, plan, edition]
        description: "Product tier: Starter, Professional, Enterprise"
        expr: PRODUCT_TIER
        data_type: TEXT
        sample_values: [Starter, Professional, Enterprise]
      - name: BILLING_FREQUENCY
        synonyms: [billing cycle, payment frequency]
        description: "Billing frequency: Monthly, Annual, Multi-Year"
        expr: BILLING_FREQUENCY
        data_type: TEXT
        sample_values: [Monthly, Annual, Multi-Year]
      - name: TYPICAL_DISCOUNT_RANGE
        synonyms: [discount range]
        description: Typical discount range
        expr: TYPICAL_DISCOUNT_RANGE
        data_type: TEXT
    facts:
      - name: LIST_PRICE_USD
        synonyms: [list price, MSRP]
        description: List price in USD
        expr: LIST_PRICE_USD
        data_type: NUMBER
      - name: AVERAGE_CONTRACT_LENGTH_MONTHS
        synonyms: [contract length, avg term]
        description: Average contract length in months
        expr: AVERAGE_CONTRACT_LENGTH_MONTHS
        data_type: NUMBER
      - name: RENEWAL_RATE_PCT
        synonyms: [renewal rate, retention rate]
        description: Product renewal rate percentage
        expr: RENEWAL_RATE_PCT
        data_type: NUMBER
      - name: UPSELL_RATE_PCT
        synonyms: [upsell rate, expansion rate]
        description: Product upsell rate percentage
        expr: UPSELL_RATE_PCT
        data_type: NUMBER
    metrics:
      - name: AVG_LIST_PRICE
        synonyms: [average price]
        description: Average list price in USD
        expr: AVG(LIST_PRICE_USD)
      - name: AVG_RENEWAL_RATE
        synonyms: [average renewal]
        description: Average renewal rate
        expr: AVG(RENEWAL_RATE_PCT)

  - name: REPS
    description: Sales rep performance with quota, attainment, win rate, pipeline coverage.
    synonyms: [sales reps, salespeople, account executives, AEs]
    base_table:
      database: <DATABASE>
      schema: <SCHEMA>
      table: SALES_REP_PERFORMANCE_TABLE
    primary_key:
      columns: [SALES_REP_ID]
    dimensions:
      - name: SALES_REP_ID
        synonyms: [rep id, AE id]
        description: Unique sales rep identifier
        expr: SALES_REP_ID
        data_type: TEXT
      - name: REP_NAME
        synonyms: [name, sales rep name, AE name]
        description: Full name of the sales rep
        expr: REP_NAME
        data_type: TEXT
      - name: TERRITORY
        synonyms: [assigned territory, sales territory]
        description: Sales territory assignment
        expr: TERRITORY
        data_type: TEXT
    time_dimensions:
      - name: HIRE_DATE
        synonyms: [start date, joined date]
        description: Date the rep was hired
        expr: HIRE_DATE
        data_type: DATE
    facts:
      - name: QUOTA_USD
        synonyms: [quota, target, sales target]
        description: Annual quota in USD
        expr: QUOTA_USD
        data_type: NUMBER
      - name: QUOTA_ATTAINMENT_PCT
        synonyms: [attainment, quota attainment]
        description: Quota attainment percentage
        expr: QUOTA_ATTAINMENT_PCT
        data_type: NUMBER
      - name: AVG_DEAL_SIZE
        synonyms: [average deal]
        description: Average deal size in USD
        expr: AVG_DEAL_SIZE
        data_type: NUMBER
      - name: WIN_RATE_PCT
        synonyms: [win rate, close rate]
        description: Win rate percentage
        expr: WIN_RATE_PCT
        data_type: NUMBER
      - name: AVG_SALES_CYCLE_DAYS
        synonyms: [avg cycle]
        description: Average days to close
        expr: AVG_SALES_CYCLE_DAYS
        data_type: NUMBER
      - name: PIPELINE_COVERAGE_RATIO
        synonyms: [coverage ratio, pipeline multiple]
        description: Pipeline coverage ratio
        expr: PIPELINE_COVERAGE_RATIO
        data_type: NUMBER
      - name: ACTIVE_OPPORTUNITIES_COUNT
        synonyms: [active opps, open opportunities]
        description: Active opportunity count
        expr: ACTIVE_OPPORTUNITIES_COUNT
        data_type: NUMBER
    metrics:
      - name: AVG_QUOTA_ATTAINMENT
        synonyms: [average attainment, team attainment]
        description: Average quota attainment across reps
        expr: AVG(QUOTA_ATTAINMENT_PCT)
      - name: AVG_WIN_RATE
        synonyms: [average win rate, team win rate]
        description: Average win rate across reps
        expr: AVG(WIN_RATE_PCT)

  - name: PIPELINE
    description: Active pipeline opportunities with stages, probabilities, and engagement signals.
    synonyms: [opportunities, opps, deals in progress, funnel]
    base_table:
      database: <DATABASE>
      schema: <SCHEMA>
      table: SALES_PIPELINE_OPPORTUNITIES
    primary_key:
      columns: [OPPORTUNITY_ID]
    dimensions:
      - name: OPPORTUNITY_ID
        synonyms: [opp id, deal id]
        description: Unique opportunity identifier
        expr: OPPORTUNITY_ID
        data_type: TEXT
      - name: CURRENT_STAGE
        synonyms: [stage, deal stage, pipeline stage]
        description: "Stage: Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost"
        expr: CURRENT_STAGE
        data_type: TEXT
        sample_values: [Prospecting, Qualification, Proposal, Negotiation, Closed Won, Closed Lost]
      - name: COMPETITOR_PRESENT
        synonyms: [competitive deal, has competitor]
        description: Whether a competitor is present
        expr: COMPETITOR_PRESENT
        data_type: BOOLEAN
      - name: DECISION_MAKER_ENGAGED
        synonyms: [DM engaged]
        description: Whether decision maker is engaged
        expr: DECISION_MAKER_ENGAGED
        data_type: BOOLEAN
    time_dimensions:
      - name: CREATED_DATE
        synonyms: [opp created, date created]
        description: Opportunity creation date
        expr: CREATED_DATE
        data_type: DATE
      - name: EXPECTED_CLOSE_DATE
        synonyms: [expected close, target close date]
        description: Expected close date
        expr: EXPECTED_CLOSE_DATE
        data_type: DATE
      - name: STAGE_ENTRY_DATE
        synonyms: [entered stage]
        description: Date entered current stage
        expr: STAGE_ENTRY_DATE
        data_type: DATE
      - name: LAST_ACTIVITY_DATE
        synonyms: [last touch, last contact]
        description: Most recent activity date
        expr: LAST_ACTIVITY_DATE
        data_type: DATE
    facts:
      - name: ESTIMATED_VALUE
        synonyms: [opp value, deal value, opportunity amount]
        description: Estimated deal value in USD
        expr: ESTIMATED_VALUE
        data_type: NUMBER
      - name: WEIGHTED_FORECAST_VALUE
        synonyms: [weighted value, forecast value]
        description: Probability-weighted forecast in USD
        expr: WEIGHTED_FORECAST_VALUE
        data_type: NUMBER
      - name: CLOSE_PROBABILITY
        synonyms: [win probability]
        description: Close probability (0-100)
        expr: CLOSE_PROBABILITY
        data_type: NUMBER
      - name: DAYS_IN_CURRENT_STAGE
        synonyms: [days in stage, stage duration]
        description: Days in current stage
        expr: DAYS_IN_CURRENT_STAGE
        data_type: NUMBER
      - name: ACTIVITY_COUNT_LAST_30_DAYS
        synonyms: [recent activity, activity count]
        description: Activities in last 30 days
        expr: ACTIVITY_COUNT_LAST_30_DAYS
        data_type: NUMBER
    metrics:
      - name: TOTAL_PIPELINE_VALUE
        synonyms: [pipeline value]
        description: Total estimated pipeline value
        expr: SUM(ESTIMATED_VALUE)
      - name: TOTAL_WEIGHTED_FORECAST
        synonyms: [weighted pipeline, total forecast]
        description: Total weighted forecast value
        expr: SUM(WEIGHTED_FORECAST_VALUE)
      - name: TOTAL_OPPORTUNITIES
        synonyms: [opp count]
        description: Total opportunities
        expr: COUNT(OPPORTUNITY_ID)
      - name: AVG_DAYS_IN_STAGE
        synonyms: [average stage duration]
        description: Average days in current stage
        expr: AVG(DAYS_IN_CURRENT_STAGE)

  - name: MARKETING
    description: Marketing lead attribution with campaigns, lead scores, and spend.
    synonyms: [leads, campaigns, marketing leads, attribution]
    base_table:
      database: <DATABASE>
      schema: <SCHEMA>
      table: MARKETING_ATTRIBUTION_TABLE
    primary_key:
      columns: [LEAD_ID]
    dimensions:
      - name: LEAD_ID
        synonyms: [lead, marketing lead]
        description: Unique lead identifier
        expr: LEAD_ID
        data_type: TEXT
      - name: LEAD_SOURCE_DETAIL
        synonyms: [source detail, lead channel]
        description: "Lead source: Google Ads, LinkedIn, Trade Show, Webinar"
        expr: LEAD_SOURCE_DETAIL
        data_type: TEXT
        sample_values: [Google Ads, LinkedIn, Trade Show, Webinar]
      - name: CAMPAIGN_NAME
        synonyms: [campaign, marketing campaign]
        description: Marketing campaign name
        expr: CAMPAIGN_NAME
        data_type: TEXT
      - name: FIRST_TOUCH_CHANNEL
        synonyms: [first touch, initial channel]
        description: First marketing touch channel
        expr: FIRST_TOUCH_CHANNEL
        data_type: TEXT
      - name: LAST_TOUCH_CHANNEL
        synonyms: [last touch, final channel]
        description: Last marketing touch before conversion
        expr: LAST_TOUCH_CHANNEL
        data_type: TEXT
    facts:
      - name: LEAD_SCORE
        synonyms: [score, lead quality, MQL score]
        description: Lead quality score (0-100)
        expr: LEAD_SCORE
        data_type: NUMBER
      - name: LEAD_TO_OPPORTUNITY_DAYS
        synonyms: [lead conversion time, days to opportunity]
        description: Days from lead to opportunity
        expr: LEAD_TO_OPPORTUNITY_DAYS
        data_type: NUMBER
      - name: MARKETING_SPEND_ALLOCATED
        synonyms: [spend, marketing cost, ad spend]
        description: Marketing spend allocated in USD
        expr: MARKETING_SPEND_ALLOCATED
        data_type: NUMBER
    metrics:
      - name: TOTAL_MARKETING_SPEND
        synonyms: [total spend, total ad spend]
        description: Total marketing spend in USD
        expr: SUM(MARKETING_SPEND_ALLOCATED)
      - name: AVG_LEAD_SCORE
        synonyms: [average lead score]
        description: Average lead quality score
        expr: AVG(LEAD_SCORE)
      - name: TOTAL_LEADS
        synonyms: [lead count]
        description: Total marketing leads
        expr: COUNT(LEAD_ID)
      - name: AVG_LEAD_CONVERSION_TIME
        synonyms: [average conversion time]
        description: Average days from lead to opportunity
        expr: AVG(LEAD_TO_OPPORTUNITY_DAYS)

relationships:
  - name: TRANSACTIONS_TO_CUSTOMERS
    left_table: TRANSACTIONS
    right_table: CUSTOMERS
    join_type: left_outer
    relationship_type: many_to_one
    relationship_columns:
      - left_column: CUSTOMER_ID
        right_column: CUSTOMER_ID
  - name: TRANSACTIONS_TO_PRODUCTS
    left_table: TRANSACTIONS
    right_table: PRODUCTS
    join_type: left_outer
    relationship_type: many_to_one
    relationship_columns:
      - left_column: PRODUCT_SKU
        right_column: PRODUCT_SKU
  - name: TRANSACTIONS_TO_REPS
    left_table: TRANSACTIONS
    right_table: REPS
    join_type: left_outer
    relationship_type: many_to_one
    relationship_columns:
      - left_column: SALES_REP_ID
        right_column: SALES_REP_ID

verified_queries:
  - name: revenue_by_region
    question: What is the total revenue by region?
    sql: |
      SELECT t.REGION, SUM(t.DEAL_SIZE_USD) AS TOTAL_REVENUE
      FROM <DATABASE>.<SCHEMA>.SALES_TRANSACTIONS_FACT_TABLE t
      GROUP BY t.REGION ORDER BY TOTAL_REVENUE DESC
  - name: top_reps_by_attainment
    question: Which sales reps have the highest quota attainment?
    sql: |
      SELECT r.REP_NAME, r.TERRITORY, r.QUOTA_ATTAINMENT_PCT, r.QUOTA_USD
      FROM <DATABASE>.<SCHEMA>.SALES_REP_PERFORMANCE_TABLE r
      ORDER BY r.QUOTA_ATTAINMENT_PCT DESC LIMIT 10
  - name: pipeline_by_stage
    question: What is the pipeline value broken down by stage?
    sql: |
      SELECT p.CURRENT_STAGE, COUNT(p.OPPORTUNITY_ID) AS NUM_OPPORTUNITIES,
        SUM(p.ESTIMATED_VALUE) AS TOTAL_VALUE, SUM(p.WEIGHTED_FORECAST_VALUE) AS WEIGHTED_VALUE
      FROM <DATABASE>.<SCHEMA>.SALES_PIPELINE_OPPORTUNITIES p
      GROUP BY p.CURRENT_STAGE ORDER BY TOTAL_VALUE DESC
  - name: revenue_by_product_tier
    question: How does revenue break down by product tier?
    sql: |
      SELECT pr.PRODUCT_TIER, COUNT(t.TRANSACTION_ID) AS NUM_DEALS,
        SUM(t.DEAL_SIZE_USD) AS TOTAL_REVENUE, AVG(t.DEAL_SIZE_USD) AS AVG_DEAL_SIZE
      FROM <DATABASE>.<SCHEMA>.SALES_TRANSACTIONS_FACT_TABLE t
      JOIN <DATABASE>.<SCHEMA>.PRODUCT_CATALOG_TABLE pr ON t.PRODUCT_SKU = pr.PRODUCT_SKU
      GROUP BY pr.PRODUCT_TIER ORDER BY TOTAL_REVENUE DESC
  - name: top_customers_by_ltv
    question: Who are the top 10 customers by lifetime value?
    sql: |
      SELECT c.COMPANY_NAME, c.INDUSTRY, c.COMPANY_SIZE, c.CUSTOMER_LIFETIME_VALUE,
        c.CHURN_RISK_SCORE, c.EXPANSION_POTENTIAL
      FROM <DATABASE>.<SCHEMA>.CUSTOMER_DIMENSION_TABLE c
      ORDER BY c.CUSTOMER_LIFETIME_VALUE DESC LIMIT 10
  - name: marketing_spend_by_source
    question: What is the total marketing spend by lead source?
    sql: |
      SELECT m.LEAD_SOURCE_DETAIL, COUNT(m.LEAD_ID) AS NUM_LEADS,
        SUM(m.MARKETING_SPEND_ALLOCATED) AS TOTAL_SPEND, AVG(m.LEAD_SCORE) AS AVG_LEAD_SCORE
      FROM <DATABASE>.<SCHEMA>.MARKETING_ATTRIBUTION_TABLE m
      GROUP BY m.LEAD_SOURCE_DETAIL ORDER BY TOTAL_SPEND DESC
  $$,
  FALSE
);
```

**Verify creation:**
```sql
SHOW SEMANTIC VIEWS IN SCHEMA <DATABASE>.<SCHEMA>;
```

---

### Step 3: Create Cortex Agent

**Execute:**

```sql
CREATE OR REPLACE AGENT <DATABASE>.<SCHEMA>.SALES_OPS_AGENT
  COMMENT = 'Sales Operations analytics agent'
  FROM SPECIFICATION $$
  instructions:
    system: >
      You are a Sales Operations analyst. Help users explore revenue trends, pipeline health,
      sales rep performance, customer segmentation, product mix, and marketing attribution.
      Provide clear, data-driven answers. When presenting numbers, use appropriate formatting
      (currency for USD values, percentages for rates). Always include relevant context.
    response: >
      Provide concise, actionable answers about sales operations data. Include relevant
      numbers and comparisons when helpful.
  tools:
    - tool_spec:
        type: cortex_analyst_text_to_sql
        name: sales_ops_analyst
        description: >
          Analyzes sales operations data including revenue, pipeline, rep performance,
          customer health, product catalog, and marketing attribution.
  tool_resources:
    sales_ops_analyst:
      semantic_view: <DATABASE>.<SCHEMA>.SALES_OPS_SEMANTIC_VIEW
      execution_environment:
        type: warehouse
        warehouse: <WAREHOUSE>
  $$;
```

**Verify creation:**
```sql
DESCRIBE AGENT <DATABASE>.<SCHEMA>.SALES_OPS_AGENT;
```

---

### Step 4: Test the Agent

**Execute these test queries to validate the agent works:**

```sql
-- Test 1: Revenue by region (verified query match)
SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
  '<DATABASE>.<SCHEMA>.SALES_OPS_AGENT',
  '{"messages": [{"role": "user", "content": [{"type": "text", "text": "What is total revenue by region?"}]}]}'
) AS AGENT_RESPONSE;
```

```sql
-- Test 2: Rep performance (single table)
SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
  '<DATABASE>.<SCHEMA>.SALES_OPS_AGENT',
  '{"messages": [{"role": "user", "content": [{"type": "text", "text": "Which 5 reps have the highest quota attainment?"}]}]}'
) AS AGENT_RESPONSE;
```

```sql
-- Test 3: Pipeline analysis (multi-dimension)
SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
  '<DATABASE>.<SCHEMA>.SALES_OPS_AGENT',
  '{"messages": [{"role": "user", "content": [{"type": "text", "text": "What is pipeline value by stage and how many deals have competitors?"}]}]}'
) AS AGENT_RESPONSE;
```

Verify each test returns valid data with SQL generated by Cortex Analyst.

**Stop**: Confirm all tests pass before proceeding.

---

### Step 5: Create MCP Server

**Execute:**

```sql
CREATE OR REPLACE MCP SERVER <DATABASE>.<SCHEMA>.SALES_OPS_MCP_SERVER
  COMMENT = 'MCP Server exposing Sales Ops Agent for Amazon QuickSight'
  FROM SPECIFICATION $$
  tools:
    - title: "Sales Ops Agent"
      name: "sales_ops_agent"
      type: "CORTEX_AGENT_RUN"
      identifier: "<DATABASE>.<SCHEMA>.SALES_OPS_AGENT"
      description: "Ask questions about sales operations data including revenue, pipeline, rep performance, customers, products, and marketing."
  $$;
```

**Grant permissions:**

```sql
GRANT USAGE ON MCP SERVER <DATABASE>.<SCHEMA>.SALES_OPS_MCP_SERVER TO ROLE CORTEX_QUICK_HOL_ROLE;
GRANT USAGE ON AGENT <DATABASE>.<SCHEMA>.SALES_OPS_AGENT TO ROLE CORTEX_QUICK_HOL_ROLE;
GRANT SELECT ON SEMANTIC VIEW CORTEX_QUICK_HOL_DB.CORTEX_QUICK_HOL_SCHEMA.SALES_OPS_SEMANTIC_VIEW TO ROLE CORTEX_QUICK_HOL_ROLE;
```

**Verify creation:**
```sql
SHOW MCP SERVERS IN SCHEMA <DATABASE>.<SCHEMA>;
```

---

### Step 6: Create OAuth Integration

**Execute:**

```sql
USE ROLE ACCOUNTADMIN;
```
**Stop**: Confirm if ACCOUNTADMIN role is used, which is required for next step - to create security integration.

```sql
CREATE OR REPLACE SECURITY INTEGRATION SALES_OPS_QUICK_SUITE_OAUTH
    TYPE = OAUTH
    ENABLED = TRUE
    OAUTH_CLIENT = CUSTOM
    OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
    OAUTH_REDIRECT_URI = 'https://us-west-2.quicksight.aws.amazon.com/sn/oauthcallback'
    OAUTH_ISSUE_REFRESH_TOKENS = TRUE
    OAUTH_REFRESH_TOKEN_VALIDITY = 86400;
```

**Get OAuth credentials:**

```sql
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('SALES_OPS_QUICK_SUITE_OAUTH');
```

**Present credentials to user:**

```
Save these credentials for QuickSight configuration:

OAUTH_CLIENT_ID:     <value from query>
OAUTH_CLIENT_SECRET: <value from query>
```

**Stop**: Ensure user has copied both values before proceeding.

---

### Step 7: Configure Amazon QuickSight (Manual Steps)

**Present these instructions to the user:**

```
AMAZON QUICKSIGHT CONFIGURATION
================================

1. Open the Amazon QuickSight console

2. Navigate to: Manage QuickSight -> Integrations -> Click "Add" (+)

3. On the "Create Integration" page, enter:

   Name:                Sales Ops Cortex Agent
   Description:         Snowflake Sales Ops analytics via MCP
   MCP server endpoint: https://<ACCOUNT>.snowflakecomputing.com/api/v2/databases/<DATABASE>/schemas/<SCHEMA>/mcp-servers/SALES_OPS_MCP_SERVER

4. Click "Next"

5. Select authentication: "User authentication (OAuth)"

6. Select: "Manual configuration"

7. Fill in OAuth details:

   Client ID:      <OAUTH_CLIENT_ID from Step 6>
   Client Secret:  <OAUTH_CLIENT_SECRET from Step 6>
   Token URL:      https://<ACCOUNT>.snowflakecomputing.com/oauth/token-request
   Auth URL:       https://<ACCOUNT>.snowflakecomputing.com/oauth/authorize
   Redirect URL:   https://us-west-2.quicksight.aws.amazon.com/sn/oauthcallback

8. Click "Create and continue"

**Present final instructions:**

```
COMPLETE THE CONNECTION
=======================

1. Return to Amazon QuickSight
2. Navigate to Integrations
3. Find your MCP integration
4. Click to authenticate with your Snowflake credentials
5. Done! The Sales Ops Agent is now available in QuickSight.

TEST YOUR AGENT
===============

Ask questions like:
- "What is total revenue by region?"
- "Which reps have the highest quota attainment?"
- "What is pipeline value by stage?"

IMPORTANT LIMITATIONS
=====================
- MCP operations have a 60-second timeout
- Tool lists are static after registration (refresh manually)
```

---

## Quick Reference

### Objects Created

| Object | Name |
|--------|------|
| Semantic View | `<DATABASE>.<SCHEMA>.SALES_OPS_SEMANTIC_VIEW` |
| Cortex Agent | `<DATABASE>.<SCHEMA>.SALES_OPS_AGENT` |
| MCP Server | `<DATABASE>.<SCHEMA>.SALES_OPS_MCP_SERVER` |
| OAuth Integration | `SALES_OPS_QUICK_SUITE_OAUTH` |

### Key URLs

| URL | Value |
|-----|-------|
| MCP Endpoint | `https://<ACCOUNT>.snowflakecomputing.com/api/v2/databases/<DATABASE>/schemas/<SCHEMA>/mcp-servers/SALES_OPS_MCP_SERVER` |
| Auth URL | `https://<ACCOUNT>.snowflakecomputing.com/oauth/authorize` |
| Token URL | `https://<ACCOUNT>.snowflakecomputing.com/oauth/token-request` |

---

## Troubleshooting

### "Object does not exist"
```sql
SHOW MCP SERVERS IN SCHEMA <DATABASE>.<SCHEMA>;
SHOW GRANTS ON MCP SERVER <DATABASE>.<SCHEMA>.SALES_OPS_MCP_SERVER;
```

### OAuth errors
```sql
DESCRIBE SECURITY INTEGRATION SALES_OPS_QUICK_SUITE_OAUTH;
-- Verify OAUTH_REDIRECT_URI matches the QuickSight-generated URL exactly
```

### Agent not responding
```sql
-- Test agent directly first:
SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
  '<DATABASE>.<SCHEMA>.SALES_OPS_AGENT',
  '{"messages": [{"role": "user", "content": [{"type": "text", "text": "What is total revenue?"}]}]}'
);
```

### Timeout errors (HTTP 424)
- QuickSight MCP has a 60-second timeout
- Use simpler prompts or optimize queries

---

## Cleanup

```sql
DROP MCP SERVER IF EXISTS <DATABASE>.<SCHEMA>.SALES_OPS_MCP_SERVER;
DROP AGENT IF EXISTS <DATABASE>.<SCHEMA>.SALES_OPS_AGENT;
DROP SEMANTIC VIEW IF EXISTS <DATABASE>.<SCHEMA>.SALES_OPS_SEMANTIC_VIEW;
DROP SECURITY INTEGRATION IF EXISTS SALES_OPS_QUICK_SUITE_OAUTH;
```

---

## Stopping Points

- After Step 1: Confirm database/schema/warehouse/account values
- After Step 4: Verify all agent tests pass
- After Step 6: Ensure OAuth credentials are saved
- After Step 7: Wait for Redirect URL from QuickSight

## Output

- Semantic View with 6 tables, relationships, and verified queries
- Cortex Agent powered by Cortex Analyst text-to-SQL
- MCP Server exposing the agent
- OAuth Security Integration for Amazon QuickSight
- Working end-to-end connection from QuickSight to Snowflake
