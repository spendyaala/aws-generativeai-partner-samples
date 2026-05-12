# Agent Capabilities Guide

## Overview

The Concierge Agent system consists of two specialized agents working together to provide comprehensive travel planning assistance:

1. **Supervisor Agent** - Main orchestrator that coordinates all interactions
2. **Travel Assistant** - Handles travel planning, bookings, and destination information

---

## 🎯 Supervisor Agent

### Role
The Supervisor Agent is the main entry point for all user interactions. It orchestrates conversations, delegates tasks to specialized agents via the AgentCore Gateway, and manages the user's itinerary.

### Core Capabilities

#### 1. Conversation Orchestration
- Routes user requests to appropriate specialized agents
- Maintains conversation context and memory across sessions
- Formats and presents responses from sub-agents to users
- Handles multi-turn conversations with context awareness

#### 2. Itinerary Management
The supervisor directly manages the user's travel itinerary with two key tools:

**`save_itinerary(user_id, items)`**
- Saves complete itineraries to DynamoDB
- Accepts JSON array of itinerary items
- Supports multiple item types: flight, hotel, activity, restaurant, transport
- Stores details like title, location, price, date, day, and description

**Example:**
```json
[
  {
    "type": "flight",
    "title": "JFK to LAX",
    "price": "$350",
    "date": "2025-12-25",
    "day": 1
  },
  {
    "type": "hotel",
    "title": "Marriott Downtown",
    "location": "Los Angeles",
    "price": "$200/night",
    "date": "2025-12-25",
    "day": 1
  },
  {
    "type": "activity",
    "title": "Hollywood Tour",
    "location": "Los Angeles",
    "price": "$45",
    "date": "2025-12-26",
    "day": 2,
    "description": "Guided tour of Hollywood landmarks"
  }
]
```

**`clear_itinerary(user_id)`**
- Removes all itinerary items for a user
- Used when user wants to start fresh or clear saved plans
- Returns count of deleted items

#### 3. Gateway Communication
- Communicates with specialized agents via AgentCore Gateway
- Passes user context (user_id, session_id) to all sub-agents
- Handles streaming responses from sub-agents
- Manages tool invocations across distributed services

### How It Works Together
1. User sends message to Supervisor
2. Supervisor analyzes intent and routes to appropriate agent via Gateway
3. Specialized agent processes request and returns results
4. Supervisor formats response and presents to user
5. If itinerary is created, Supervisor saves it using `save_itinerary`

---

## ✈️ Travel Assistant

### Role
The Travel Assistant specializes in all travel-related queries including destination research, weather information, flight and hotel searches, and local recommendations.

### Tools & Capabilities

#### 1. Weather Information
**`get_weather(query)`**
- Retrieves 5-day weather forecast for any city
- Uses SerpAPI to fetch current weather data
- Provides daily forecasts with temperature, conditions, and descriptions

#### 2. Internet Search
**`travel_search(query)`**
- Performs web searches using SerpAPI (Google Search engine)
- Returns formatted results with titles, snippets, and source URLs
- Useful for destination research, travel tips, weather, and current information

#### 3. Hotel Search
**`travel_hotel_search(query, check_in_date, check_out_date)`**
- Searches Google Hotels via SerpAPI for hotel options
- Returns ratings, prices, amenities, and booking links
- Supports natural language queries (e.g., "fancy hotels in Paris")

#### 4. Flight Search
**`travel_flight_search(departure_id, arrival_id, outbound_date, return_date)`**
- Searches Google Flights via SerpAPI for flight options
- Returns prices, durations, layovers, and carbon emissions
- Supports 3-letter airport codes (e.g., JFK, LAX, CDG)

### Workflow Example

**User:** "Plan a 3-day trip to Paris in December"

1. **Weather Check**: Travel Assistant uses `travel_search("Paris weather December")` to check conditions
2. **Flight Search**: Uses `travel_flight_search()` to find flights
3. **Hotel Search**: Uses `travel_hotel_search()` to find accommodations
4. **Local Research**: Uses `travel_search()` for attractions and restaurants
5. **Itinerary Creation**: Compiles all information into structured itinerary
6. **Handoff to Supervisor**: Returns complete itinerary to Supervisor
7. **Save**: Supervisor calls `save_itinerary()` to persist the plan

---

## 🔑 Key Integration Points

### 1. User Context Flow
- Supervisor maintains user_id and session_id
- All tool calls include user_id for personalization
- Session context preserved across agent boundaries
- Memory shared via AgentCore Memory service

### 2. Data Handoffs
- Travel Assistant → Supervisor: Structured itinerary data
- All data flows through Supervisor for consistency

### 3. Error Handling
- Each agent validates inputs and returns structured errors
- Supervisor handles errors gracefully and informs user
- Retry logic for transient failures

### 4. State Management
- **Itinerary**: Stored in DynamoDB via Supervisor
- **User Profile**: Stored in DynamoDB (preferences)
- **Conversation**: Stored in AgentCore Memory

---

## 📊 Tool Summary

| Agent | Tool Count | Primary Functions |
|-------|-----------|-------------------|
| **Supervisor** | 2 | Itinerary management, orchestration |
| **Travel Assistant** | 3 | Search, flights, hotels |

**Total Tools**: 5 specialized tools working together to provide comprehensive travel planning assistance.
