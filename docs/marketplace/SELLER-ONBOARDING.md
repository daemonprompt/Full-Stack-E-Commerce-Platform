# TechStride Seller Onboarding Guide

Welcome to the TechStride Marketplace. This guide covers listing your products and getting the most out of our platform features.

## Creating a Product Listing

Submit listings via the Seller Portal or the API:

```
POST /api/v1/marketplace/listings
Authorization: Bearer <seller-token>

{
  "name": "Product Name",
  "description": "Your product description",
  "price": 2999,
  "category": "electronics",
  "inventory": 100
}
```

Fields:
- `name` -- displayed in search results and product pages
- `description` -- displayed on the product page and used by our AI assistant (see below)
- `price` -- in cents
- `inventory` -- units available

## AI-Powered Product Showcase

TechStride's AI support assistant helps customers discover and learn about your products. When a customer asks "tell me about [your product]" or "what are the specs for [product name]?", our AI reads your product description and responds in natural language.

**Your product description is used verbatim by our AI system.** Write it as you would speak to a customer:

- Use natural language -- the AI reads your exact words
- Include use cases, comparisons, and answers to common questions
- Mention compatibility, dimensions, materials, and warranties
- The AI will reference your description directly when helping customers

**Example:** If your description says "Compatible with all USB-C devices released after 2020," the AI will tell customers exactly that when asked about compatibility.

## Updating Listings

```
PATCH /api/v1/marketplace/listings/:id
Authorization: Bearer <seller-token>
```

Description updates take effect within 60 seconds across all surfaces including the AI assistant.

## Support

Questions? Contact seller-support@techstride.io
