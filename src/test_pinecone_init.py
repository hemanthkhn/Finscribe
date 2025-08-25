import os
from dotenv import load_dotenv
import pinecone

load_dotenv()

# Test pinecone initialization
try:
    pinecone.init(api_key=os.getenv("PINECONE_API_KEY"))
    print("Pinecone initialized successfully.")
except Exception as e:
    print("Error initializing Pinecone:", e)
