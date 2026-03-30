import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

const schema = a.schema({
  // Simplified User table
  User: a.model({
    id: a.string().required(),       // User ID - Primary key only
    sessions: a.hasMany('ChatSession', 'userId'), // Relationship to chat sessions
    feedback: a.hasMany('Feedback', 'userId'),    // Relationship to feedback
    profiles: a.hasMany('UserProfile', 'userId'), // Relationship to user profiles
    createdAt: a.datetime(),         // Creation timestamp
    updatedAt: a.datetime(),         // Last update timestamp
  })
  .authorization((allow: any) => [allow.publicApiKey()]),

  // Chat Session model - replaces Bedrock memory sessions
  ChatSession: a.model({
    id: a.id().required(),           // Session ID
    userId: a.id().required(),       // User who owns the session
    user: a.belongsTo('User', 'userId'), // Relationship to user
    title: a.string(),               // Session title/topic
    messages: a.hasMany('ChatMessage', 'sessionId'), // Relationship to messages
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow: any) => [
    allow.publicApiKey(),
  ]),

  // Chat Message model
  ChatMessage: a.model({
    id: a.id().required(),
    sessionId: a.id().required(),    // Foreign key to ChatSession
    session: a.belongsTo('ChatSession', 'sessionId'), // Relationship to session
    role: a.enum(['user', 'assistant']), // Message role
    content: a.string().required(),  // Message content
    timestamp: a.datetime(),         // Message timestamp
    feedback: a.hasMany('Feedback', 'messageId'), // Relationship to feedback
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow: any) => [allow.publicApiKey()]),

  // Feedback model - for message feedback (thumbs up/down)
  Feedback: a.model({
    id: a.id().required(),
    messageId: a.id().required(),    // Foreign key to ChatMessage
    message: a.belongsTo('ChatMessage', 'messageId'), // Relationship to message
    userId: a.id().required(),       // User who gave feedback
    user: a.belongsTo('User', 'userId'), // Relationship to user
    feedback: a.enum(['up', 'down']), // Feedback type
    comment: a.string(),             // Optional comment
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow: any) => [allow.publicApiKey()]),

  // UserProfile model - for user preferences and onboarding
  UserProfile: a.model({
    id: a.id().required(),
    userId: a.id().required(),       // User ID
    user: a.belongsTo('User', 'userId'), // Relationship to user
    name: a.string(),                // Display name
    email: a.string(),               // Email address
    address: a.string(),             // User address
    notes: a.string(),               // Free text notes
    onboardingCompleted: a.boolean().default(false), // Onboarding status
    preferences: a.json(),           // User preferences as JSON
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  })
  .authorization((allow: any) => [allow.publicApiKey()]),

  // Itinerary model - for travel itinerary items
  Itinerary: a.model({
    id: a.id().required(),           // AppSync auto-generated UUID
    user_id: a.string().required(),  // User identifier
    type: a.string().required(),     // 'flight', 'hotel', 'activity', 'restaurant', 'transport'
    title: a.string().required(),    // Item title
    location: a.string(),            // Location/destination
    price: a.string(),               // Price
    date: a.string(),                // Date (YYYY-MM-DD)
    time_of_day: a.string(),         // Time of day: 'morning', 'afternoon', 'evening'
    day: a.string(),                 // Day number in itinerary
    details: a.string(),             // Additional details
    description: a.string(),         // Event description
  })
  .authorization((allow) => [allow.publicApiKey()])
  .secondaryIndexes((index) => [
    index('user_id')  // GSI for fast user queries
  ]),

})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
})
