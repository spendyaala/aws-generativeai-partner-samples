import os
import boto3
from botocore.exceptions import ClientError
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


class DynamoDBManager:
    """DynamoDB client for user profile operations."""

    def __init__(self, region_name: str = None):
        self.region_name = region_name or os.environ.get("AWS_REGION")

        # Initialize DynamoDB resource
        self.dynamodb = boto3.resource("dynamodb", region_name=self.region_name)

        # Table names from environment variables
        self.user_profile_table_name = os.environ.get("USER_PROFILE_TABLE_NAME")

        # Get table reference
        self.user_profile_table = self.dynamodb.Table(self.user_profile_table_name)

        logger.info(f"DynamoDB Manager initialized with region: {self.region_name}")
        logger.info(f"UserProfile table: {self.user_profile_table_name}")

    def get_user_profile(self, user_id: str):
        """Get user profile from the UserProfile table."""
        try:
            # Look up by id (primary key)
            response = self.user_profile_table.get_item(Key={"id": user_id})

            if "Item" in response:
                profile = response["Item"]
                logger.info(f"Retrieved user profile for: {user_id}")
                return profile

            # NOTE: Table scan is expensive at scale. If userId lookups are common,
            # add a GSI on the userId attribute to avoid full-table scans.
            logger.warning(f"Primary key miss for {user_id}, falling back to scan")
            response = self.user_profile_table.scan(
                FilterExpression="userId = :user_id",
                ExpressionAttributeValues={":user_id": user_id},
                Limit=1,
            )

            items = response.get("Items", [])
            if items:
                profile = items[0]
                logger.info(f"Retrieved user profile via userId scan for: {user_id}")
                return profile
            else:
                logger.info(f"No user profile found for: {user_id}")
                return None

        except ClientError as e:
            logger.error(f"Error getting user profile: {e}")
            raise
