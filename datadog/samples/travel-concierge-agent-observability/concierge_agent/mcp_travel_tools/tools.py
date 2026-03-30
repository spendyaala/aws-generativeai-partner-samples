"""
Travel Tools Implementation

Pure tool functions for search, flights, and hotels via SerpAPI.
No agent logic - these are called directly by the MCP server.
"""

import os
import re
from typing import Optional

import requests
from serpapi import GoogleSearch

# =============================================================================
# CONFIGURATION
# =============================================================================

REGION = os.getenv("AWS_REGION")
SERP_API_KEY = os.getenv("SERP_API_KEY")


# =============================================================================
# SERP API TOOLS (Google Search, Hotels, Flights)
# =============================================================================


def serp_search_tool(query: str) -> str:
    """Perform internet search using SerpAPI."""
    if not SERP_API_KEY:
        return "Error: SERP API key not configured."

    try:
        # Search using SerpAPI
        params = {
            "engine": "google",  # google_hotels, # google_flights
            "q": query,
            "api_key": SERP_API_KEY,
        }

        search = GoogleSearch(params)
        response = search.get_dict()

        if not response or "organic_results" not in response:
            return "No search results found."

        formatted = []
        for i, result in enumerate(response["organic_results"], 1):
            title = result.get("title", "No title")
            snippet = result.get("snippet", "")[:200]
            link = result.get("link", "")
            source = result.get("source", "")

            # Build formatted result
            result_text = f"{i}. **{title}**"
            if snippet:
                result_text += f"\n   {snippet}"
                if len(result.get("snippet", "")) > 200:
                    result_text += "..."
            if source:
                result_text += f"\n   Source: {source}"
            if link:
                result_text += f"\n   URL: {link}"

            formatted.append(result_text)

        return "\n\n".join(formatted) if formatted else "No results found."

    except Exception as e:
        return f"Search error: {str(e)}"


def serp_hotel_search(query: str, check_in_date: str, check_out_date: str) -> str:
    """
    Search for hotels using SerpAPI Google Hotels engine.

    Args:
        query: Hotel search query (e.g., "fancy hotels in Paris", "hotels near Times Square")
        check_in_date: Check-in date in YYYY-MM-DD format
        check_out_date: Check-out date in YYYY-MM-DD format

    Returns:
        Formatted string with hotel results
    """
    if not SERP_API_KEY:
        return "Error: SERP API key not configured."

    try:
        # Search hotels using SerpAPI
        params = {
            "engine": "google_hotels",
            "q": query,
            "check_in_date": check_in_date,
            "check_out_date": check_out_date,
            "api_key": SERP_API_KEY,
        }

        search = GoogleSearch(params)
        response = search.get_dict()

        if not response or "properties" not in response:
            return "No hotel results found."

        formatted = []
        for i, hotel in enumerate(response["properties"][:10], 1):  # Limit to top 10
            name = hotel.get("name", "No name")

            # Build formatted result
            result_text = f"{i}. **{name}**"

            # Hotel class (star rating)
            hotel_class = hotel.get("hotel_class")
            if hotel_class:
                try:
                    # Extract numeric value from strings like "3-star hotel" or just "3"
                    if isinstance(hotel_class, str):
                        # Try to extract the first number from the string
                        match = re.search(r"\d+", hotel_class)
                        if match:
                            stars = int(match.group())
                            result_text += f" {'⭐' * stars}"
                    else:
                        # If it's already a number, use it directly
                        result_text += f" {'⭐' * int(hotel_class)}"
                except (ValueError, TypeError):
                    # If conversion fails, just show the text
                    result_text += f" ({hotel_class})"

            # Rating
            rating = hotel.get("overall_rating")
            reviews = hotel.get("reviews")
            if rating:
                result_text += f"\n   Rating: {rating}"
                if reviews:
                    result_text += f" ({reviews} reviews)"

            # Price per night
            rate = hotel.get("rate_per_night")
            if rate:
                lowest = rate.get("extracted_lowest")
                highest = rate.get("extracted_highest")
                if lowest and highest:
                    result_text += f"\n   Price: ${lowest} - ${highest} per night"
                elif lowest:
                    result_text += f"\n   Price: ${lowest} per night"

            # Description
            description = hotel.get("description", "")
            if description:
                # Truncate description to 150 characters
                desc_short = description[:150]
                if len(description) > 150:
                    desc_short += "..."
                result_text += f"\n   {desc_short}"

            # Amenities (if available)
            amenities = hotel.get("amenities", [])
            if amenities and len(amenities) > 0:
                # Show first 3 amenities
                amenities_str = ", ".join(amenities[:3])
                result_text += f"\n   Amenities: {amenities_str}"
                if len(amenities) > 3:
                    result_text += f" (+{len(amenities) - 3} more)"

            # Link
            link = hotel.get("link")
            if link:
                result_text += f"\n   URL: {link}"

            formatted.append(result_text)

        header = f"Hotel Search Results for '{query}' ({check_in_date} to {check_out_date}):\n\n"
        return (
            header + "\n\n".join(formatted) if formatted else "No hotel results found."
        )

    except Exception as e:
        return f"Hotel search error: {str(e)}"


def serp_flight_search(
    departure_id: str,
    arrival_id: str,
    outbound_date: str,
    return_date: Optional[str] = None,
) -> str:
    """
    Search for flights using SerpAPI Google Flights engine.

    Args:
        departure_id: Departure airport code (e.g., "DCA", "JFK")
        arrival_id: Arrival airport code (e.g., "LGA", "LAX")
        outbound_date: Outbound flight date in YYYY-MM-DD format
        return_date: Return flight date in YYYY-MM-DD format (optional, omit for one-way)

    Returns:
        Formatted string with flight results
    """
    if not SERP_API_KEY:
        return "Error: SERP API key not configured."

    try:
        # Search flights using SerpAPI
        params = {
            "engine": "google_flights",
            "departure_id": departure_id,
            "arrival_id": arrival_id,
            "outbound_date": outbound_date,
            "api_key": SERP_API_KEY,
        }

        # Add return date if provided
        if return_date:
            params["return_date"] = return_date

        search = GoogleSearch(params)
        results = search.get_dict()

        if not results:
            return "No flight results found."

        formatted = []

        # Process best flights
        best_flights = results.get("best_flights", [])
        if best_flights:
            formatted.append("=== Best Flights ===\n")
            for i, flight in enumerate(best_flights, 1):
                result_text = f"{i}. "

                # Flight segments
                segments = []
                for segment in flight.get("flights", []):
                    dep_airport = segment.get("departure_airport", {})
                    arr_airport = segment.get("arrival_airport", {})
                    airline = segment.get("airline", "Unknown")
                    flight_num = segment.get("flight_number", "")

                    seg_text = f"{airline} {flight_num}: {dep_airport.get('id', '')} ({dep_airport.get('time', '')}) → {arr_airport.get('id', '')} ({arr_airport.get('time', '')})"
                    segments.append(seg_text)

                result_text += "\n   ".join(segments)

                # Price and duration
                price = flight.get("price")
                total_duration = flight.get("total_duration")
                if price:
                    result_text += f"\n   Price: ${price}"
                if total_duration:
                    hours = total_duration // 60
                    minutes = total_duration % 60
                    result_text += f" | Duration: {hours}h {minutes}m"

                # Layovers
                layovers = flight.get("layovers", [])
                if layovers:
                    layover_details = []
                    for layover in layovers:
                        duration = layover.get("duration", 0)
                        hours = duration // 60
                        minutes = duration % 60
                        layover_details.append(
                            f"{layover.get('id', 'Unknown')} ({hours}h {minutes}m)"
                        )
                    result_text += f"\n   Layovers: {', '.join(layover_details)}"

                # Carbon emissions
                carbon = flight.get("carbon_emissions", {})
                if carbon:
                    diff = carbon.get("difference_percent", 0)
                    this_flight = carbon.get("this_flight", 0) / 1000  # Convert to kg
                    result_text += (
                        f"\n   Carbon: {this_flight:.0f} kg ({diff:+d}% vs typical)"
                    )

                formatted.append(result_text)

        # Process other flights
        other_flights = results.get("other_flights", [])
        if other_flights:
            if formatted:
                formatted.append("\n\n=== Other Flights ===\n")

            for i, flight in enumerate(other_flights[:10], 1):
                result_text = f"{i}. "

                # Flight segments
                segments = []
                for segment in flight.get("flights", []):
                    dep_airport = segment.get("departure_airport", {})
                    arr_airport = segment.get("arrival_airport", {})
                    airline = segment.get("airline", "Unknown")
                    flight_num = segment.get("flight_number", "")

                    seg_text = f"{airline} {flight_num}: {dep_airport.get('id', '')} ({dep_airport.get('time', '')}) → {arr_airport.get('id', '')} ({arr_airport.get('time', '')})"
                    segments.append(seg_text)

                result_text += "\n   ".join(segments)

                # Price and duration
                price = flight.get("price")
                total_duration = flight.get("total_duration")
                if price:
                    result_text += f"\n   Price: ${price}"
                if total_duration:
                    hours = total_duration // 60
                    minutes = total_duration % 60
                    result_text += f" | Duration: {hours}h {minutes}m"

                # Layovers
                layovers = flight.get("layovers", [])
                if layovers:
                    layover_details = []
                    for layover in layovers:
                        duration = layover.get("duration", 0)
                        hours = duration // 60
                        minutes = duration % 60
                        layover_details.append(
                            f"{layover.get('id', 'Unknown')} ({hours}h {minutes}m)"
                        )
                    result_text += f"\n   Layovers: {', '.join(layover_details)}"

                # Carbon emissions
                carbon = flight.get("carbon_emissions", {})
                if carbon:
                    diff = carbon.get("difference_percent", 0)
                    this_flight = carbon.get("this_flight", 0) / 1000  # Convert to kg
                    result_text += (
                        f"\n   Carbon: {this_flight:.0f} kg ({diff:+d}% vs typical)"
                    )

                formatted.append(result_text)

        if not formatted:
            return "No flight results found."

        # Build header
        trip_type = "Round-trip" if return_date else "One-way"
        header = f"Flight Search Results ({trip_type}): {departure_id} → {arrival_id}\n"
        header += f"Outbound: {outbound_date}"
        if return_date:
            header += f" | Return: {return_date}"
        header += "\n\n"

        return header + "\n\n".join(formatted)

    except Exception as e:
        return f"Flight search error: {str(e)}"
