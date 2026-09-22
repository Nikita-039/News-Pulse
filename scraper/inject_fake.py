import os
from datetime import datetime, timezone
from pymongo import MongoClient

# Use the same DB string
client = MongoClient("mongodb+srv://anshikaansh2501_db_user:c9zqXn3zVxp4eNsN@cluster0.omtwvhh.mongodb.net/?appName=Cluster0")
db = client["news_pulse"]
articles = db["articles"]

# Insert 3 fake articles about the exact same topic to force a cluster
fake_articles = [
    {
        "url": "https://test.com/fake-apple-1",
        "title": "Apple releases new iPhone 16 with AI features",
        "source": "BBC News",
        "summary": "Apple has announced the new iPhone 16 featuring advanced artificial intelligence capabilities and a new camera button.",
        "published_at": datetime.now(timezone.utc),
        "content": "Full article text here about Apple and iPhone 16...",
    },
    {
        "url": "https://test.com/fake-apple-2",
        "title": "iPhone 16 launched by Apple with AI focus",
        "source": "NPR",
        "summary": "The new iPhone 16 is here. Apple focused heavily on artificial intelligence during their launch event today.",
        "published_at": datetime.now(timezone.utc),
        "content": "Full article text here about Apple and iPhone 16...",
    },
    {
        "url": "https://test.com/fake-apple-3",
        "title": "Apple's iPhone 16 brings artificial intelligence to the masses",
        "source": "The Guardian",
        "summary": "With the launch of the iPhone 16, Apple is pushing artificial intelligence features to millions of users.",
        "published_at": datetime.now(timezone.utc),
        "content": "Full article text here about Apple and iPhone 16...",
    }
]

for a in fake_articles:
    articles.update_one({"url": a["url"]}, {"$set": a}, upsert=True)

print("Inserted 3 fake Apple articles.")
