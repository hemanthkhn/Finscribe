import os
import openai
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from flask import Flask, request, jsonify
from flask_cors import CORS

# Load environment variables from .env file
load_dotenv()

# Set OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Pinecone client with the API key
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Specify the index name (should match the name used in upserts)
index_name = "example-index101"

# Connect to the Pinecone index
index = pc.Index(index_name)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

def generate_embeddings(text):
    # Generate embeddings for the query text using OpenAI
    response = openai.Embedding.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response['data'][0]['embedding']

def semantic_search_pinecone(query_embedding, user_id, top_n=6):
    try:
        # Perform semantic search in Pinecone
        pinecone_response = index.query(
            vector=query_embedding,
            top_k=top_n,
            include_metadata=True,
            namespace=user_id
        )
        
        # Process matches
        matches = pinecone_response.get("matches", [])
        if not matches:
            print("No matches found.")
            return []  # Return an empty list if no matches are found

        # Prepare a list to hold valid results
        top_paragraphs = []
        for match in matches:
            metadata = match.get("metadata", {})

            # If metadata is a dictionary, process normally
            if isinstance(metadata, dict) and "text" in metadata:
                top_paragraphs.append({
                    "text": metadata["text"],
                    "document_name": metadata.get("document_name", "Unnamed Document")
                })
            elif isinstance(metadata, str):
                # If metadata is a string, use it directly with a default document name
                top_paragraphs.append({
                    "text": metadata,
                    "document_name": "Unnamed Document"
                })
            else:
                print(f"Skipping match due to unexpected metadata format: {match}")

        if not top_paragraphs:
            print("All matches were skipped due to missing metadata.")
            return ["No relevant data found for the provided query."]
        
        return top_paragraphs

    except Exception as e:
        print(f"Error performing semantic search: {e}")
        return ["An error occurred while retrieving data."]


def construct_answer(query, top_paragraphs):
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": f"Question: {query}"}
    ]

    # Loop through `top_paragraphs` and add each to the context
    for i, paragraph_info in enumerate(top_paragraphs):
        if isinstance(paragraph_info, dict):
            # Use provided text and document name from dictionary
            paragraph = paragraph_info.get("text", "No text found.")
            document_name = paragraph_info.get("document_name", "Unnamed Document")
        elif isinstance(paragraph_info, str):
            # Treat raw strings as paragraphs with a default document name
            paragraph = paragraph_info
            document_name = "Unnamed Document"
        else:
            print(f"Skipping entry due to unexpected format: {paragraph_info}")
            continue

        messages.append({"role": "user", "content": f"Context {i+1} (from {document_name}): {paragraph}"})

    # Final prompt for the assistant to answer based on context
    messages.append({"role": "user", "content": "Based on the above context, what is the answer to the question?"})

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=messages,
        max_tokens=300,
        temperature=0.6,
    )
    return response.choices[0].message['content'].strip()



@app.route('/get_answer', methods=['POST'])
def get_answer():
    data = request.get_json()
    query = data.get('query')
    user_id = data.get('user_id')  # Get user_id from request
    if not query:
        return jsonify({'error': 'Missing query'}), 400
    if not user_id:
        return jsonify({'error': 'Missing user_id'}), 400

    # Generate an embedding for the query
    query_embedding = generate_embeddings(query)

    # Perform semantic search in Pinecone to retrieve relevant paragraphs for the specific user
    search_results = semantic_search_pinecone(query_embedding, user_id)

    # Separate the answer and document name from search results
    top_paragraphs = [result["text"] for result in search_results]  # Modify based on your actual result structure
    document_names = [result["document_name"] for result in search_results]  # Assuming document names are available

    # Construct an answer using the retrieved paragraphs
    answer = construct_answer(query, top_paragraphs)

    # Include document name in the response along with the answer
    return jsonify({
        "answer": answer,
        "document_name": document_names[0] if document_names else "Unknown Document"  # Use the first document name
    })


@app.route('/clear_user_data', methods=['POST'])
def clear_user_data():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    try:
        # Delete data within the namespace (user-specific data)
        index.delete(delete_all=True, namespace=user_id)
        return jsonify({"message": "User data cleared successfully"}), 200
    except Exception as e:
        print(f"Error clearing user data for user_id {user_id}: {e}")
        return jsonify({"error": "Failed to clear user data"}), 500



if __name__ == '__main__':
    app.run(port=5001, debug=True)
