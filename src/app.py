import os
import time
import openai
import hashlib
import bcrypt
import pinecone
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from langchain.document_loaders import UnstructuredURLLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from flask import Flask, request, jsonify
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
from werkzeug.utils import secure_filename
import tempfile
import docx2txt
import PyPDF2
import uuid

# Load environment variables from .env file
load_dotenv()

# Set OpenAI API key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = 'example-index101'
user_index_name = 'example-index'  # Index for storing user data

# Flask application setup
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Selenium setup with headless Chrome
def setup_driver():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    service = ChromeService(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    return driver

# Function to scrape full content with scrolling using Selenium
def scrape_full_content(url):
    driver = setup_driver()
    driver.get(url)

    # Scroll to the bottom of the page to load all content
    last_height = driver.execute_script("return document.body.scrollHeight")
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)  # Adjust this delay if necessary
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

    # Get the full HTML content after scrolling
    page_source = driver.page_source
    driver.quit()

    # Parse the HTML with BeautifulSoup to extract all text content
    soup = BeautifulSoup(page_source, 'html.parser')
    full_content = ' '.join([p.get_text() for p in soup.find_all(['p', 'h1', 'h2', 'h3', 'span', 'div'])])
    
    # Debugging output
    print(f"URL: {url}")
    print(f"Full content length: {len(full_content)}")
    # print(f"Content preview (first 500 characters): {full_content[:500]}")  # Show a sample of the content
    
    return full_content

# Function to generate embeddings using OpenAI with batching
def generate_embeddings(texts, batch_size=100):
    embeddings = []
    for i in range(0, len(texts), batch_size):
        batch_texts = texts[i:i + batch_size]
        response = openai.Embedding.create(
            input=batch_texts,
            model="text-embedding-ada-002"
        )
        batch_embeddings = [data['embedding'] for data in response['data']]
        embeddings.extend(batch_embeddings)
    return embeddings

# Function to convert uploaded file to text
def convert_file_to_text(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()

# Utility function to hash passwords
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def upsert_embeddings_to_pinecone(chunks, embeddings, user_id, document_id, document_name):
    # Generate unique IDs for each embedding, incorporating user_id and document_id for traceability
    batched_embeddings = [
        (f"{user_id}_{document_id}_{uuid.uuid4()}", embeddings[i], {
            "user_id": user_id,
            "document_id": document_id,
            "document_name": document_name,
            "text": chunks[i]
        }) 
        for i in range(len(embeddings))
    ]

    # Check if Pinecone index exists; create it if it doesn't
    if index_name not in [index['name'] for index in pc.list_indexes()]:
        try:
            print(f"Creating index '{index_name}' as it does not exist.")
            pc.create_index(
                name=index_name,
                dimension=len(embeddings[0]),
                metric='dotproduct',
                spec=ServerlessSpec(cloud='aws', region='us-east-1')
            )
            while not pc.describe_index(index_name).status['ready']:
                time.sleep(1)
            print(f"Index '{index_name}' created successfully.")
        except pinecone.core.openapi.shared.exceptions.PineconeApiException as e:
            print(f"Error creating index '{index_name}': {e}")
            return

    # Connect to Pinecone index and upsert embeddings with user-specific metadata
    index = pc.Index(index_name)
    batch_size = 100
    for chunk in batch(batched_embeddings, batch_size):
        try:
            # Specify the namespace as the user_id for isolation
            index.upsert(vectors=chunk, namespace=user_id)
            print(f"Batch of {len(chunk)} embeddings upserted to Pinecone successfully for user_id: {user_id}.")
        except Exception as e:
            print(f"Error upserting embeddings to Pinecone: {e}")
    
    print(f"{len(batched_embeddings)} embeddings upserted for user_id: {user_id} and document_id: {document_id} successfully.")



# Signup route
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    
    # Hash the password
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # Generate a unique user_id
    user_id = str(uuid.uuid4())

    # Connect to the existing index
    try:
        index = pc.Index(user_index_name)
    except pc.core.openapi.shared.exceptions.PineconeApiException as e:
        print("Error connecting to index:", e)
        return jsonify({"error": "Failed to connect to user index"}), 500

    # Store user data in Pinecone with a minimal non-zero vector and include user_id in metadata
    minimal_vector = [1e-5] * 512
    try:
        index.upsert([
            (user_id, minimal_vector, {"username": username, "password": hashed_password, "user_id": user_id})
        ])
        print(f"User '{username}' with ID '{user_id}' added to index.")
    except pc.core.openapi.shared.exceptions.PineconeApiException as e:
        print("Error storing user data:", e)
        return jsonify({"error": "Failed to store user data"}), 500

    # Return the user_id to the frontend
    return jsonify({"message": "Signup successful", "user_id": user_id}), 201

# Login route
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    # Ensure username and password are provided
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400

    # Retrieve user data from Pinecone
    try:
        user_index = pc.Index(user_index_name)
        result = user_index.query(vector=[1e-5]*512, filter={"username": username}, top_k=1, include_metadata=True)
    except Exception as e:
        print("Error querying Pinecone:", e)
        return jsonify({"success": False, "message": "Failed to query user data"}), 500

    # Check if any matches were found
    if result.get("matches"):
        stored_password = result["matches"][0].get("metadata", {}).get("password")
        user_id = result["matches"][0].get("metadata", {}).get("user_id")  # Retrieve user_id from metadata

        if stored_password and bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8')):
            # Successful login, return user_id along with success message
            return jsonify({"success": True, "message": "Login successful", "user_id": user_id}), 200

    return jsonify({"success": False, "message": "Invalid username or password"}), 401


# Helper function to split list into chunks of a specified size
def batch(iterable, batch_size=100):
    for i in range(0, len(iterable), batch_size):
        yield iterable[i:i + batch_size]

# Route to process links and generate embeddings
@app.route('/process_links', methods=['POST'])
def process_links():
    data = request.get_json()
    urls = data.get('urls', [])
    user_id = data.get("user_id")  # Get user_id from request data
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    duplicate_urls = []
    all_chunks = []
    all_embeddings = []

    # Process each URL
    for url in urls:
        document_name = url  # Use the URL as document name
        document_id = str(uuid.uuid4())  # Generate a unique document ID

        # Check for duplicates (optional: implement check_document_exists if needed)
        if check_document_exists(user_id, document_name):
            duplicate_urls.append(url)
            continue  # Skip processing for duplicate URLs

        # Scrape content for each unique URL
        content = scrape_full_content(url)
        if not content:  # Skip if content is empty
            continue

        # Split content into chunks
        r_splitter = RecursiveCharacterTextSplitter(chunk_size=200, chunk_overlap=0)
        chunks = r_splitter.split_text(content)

        # Generate embeddings for each chunk
        embeddings = generate_embeddings(chunks)

        # Upsert embeddings with metadata to Pinecone
        upsert_embeddings_to_pinecone(chunks, embeddings, user_id, document_id, document_name)

        # Collect chunks and embeddings for the final response
        all_chunks.extend(chunks)
        all_embeddings.extend(embeddings)

    # Return response with duplicates information
    if duplicate_urls:
        return jsonify({
            "message": "Some URLs were duplicates and were not processed.",
            "duplicates": duplicate_urls,
            "embeddings": all_embeddings,
            "paragraphs": all_chunks
        }), 409  # Use 409 to indicate partial success due to duplicates

    return jsonify({
        'message': 'Documents processed and upserted successfully.',
        "embeddings": all_embeddings,
        "paragraphs": all_chunks
    }), 200


def convert_file_to_text(file_path, file_type):
    try:
        if file_type == "text/plain":  # For .txt files
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        elif file_type == "application/pdf":  # For .pdf files
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                return ''.join(page.extract_text() for page in pdf_reader.pages)
        elif file_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":  # For .docx files
            return docx2txt.process(file_path)
        elif file_type == "text/x-python":  # For .py files
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        else:
            return None
    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        return None

# Route to generate embeddings from uploaded file
@app.route('/generate_embeddings_from_file', methods=['POST'])
def generate_embeddings_from_file():
    data = request.form
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    files = request.files.getlist('file')
    if not files:
        return jsonify({"error": "No selected file"}), 400

    index = pc.Index(index_name)

    for file in files:
        document_name = file.filename
        document_id = str(uuid.uuid4())

        # Check if document already exists
        if check_document_exists(user_id, document_name):
            print(f"Duplicate document '{document_name}' detected for user_id {user_id}")
            return jsonify({"error": f"Document '{document_name}' already exists."}), 409

        # Process the document to text
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            file_path = temp_file.name
            file.save(file_path)

        # Convert file to text and perform additional processing
        try:
            file_type = file.content_type
            text = convert_file_to_text(file_path, file_type)
            if text:
                chunks = split_into_chunks(text)
                embeddings = generate_embeddings(chunks)
                upsert_embeddings_to_pinecone(chunks, embeddings, user_id, document_id, document_name)
            else:
                print(f"Unsupported file type or empty content for {document_name}")
        except Exception as e:
            print(f"Error processing file {document_name}: {e}")
            return jsonify({"error": str(e)}), 500
        finally:
            os.remove(file_path)

    return jsonify({"message": "Embeddings generated and uploaded successfully",'embeddings':embeddings,'paragraphs':chunks}), 200

def split_into_chunks(text, chunk_size=200, chunk_overlap=0):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap
    )
    return splitter.split_text(text)

def check_document_exists(user_id, document_name):
    index = pc.Index(index_name)

    try:
        # Query Pinecone to check if the document exists based on user_id and document_name
        existing_doc_query = index.query(
            vector=[0.0] * 1536,  # Dummy vector
            top_k=1,
            filter={"user_id": user_id, "document_name": document_name},
            namespace=user_id,
            include_metadata=True
        )

        # Check if any matches are found
        return len(existing_doc_query.get("matches", [])) > 0
    except Exception as e:
        print(f"Error checking for existing document '{document_name}' for user_id {user_id}: {e}")
        return False

# @app.route('/check_knowledge_base', methods=['GET','POST'])
@app.route('/check_knowledge_base', methods=['POST'])
def check_knowledge_base():
    data = request.get_json()
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    try:
        # Connect to the Pinecone index
        index = pc.Index(index_name)
        
        # Get index statistics for all namespaces
        index_stats = index.describe_index_stats()
        print(index_stats)
        
        # Retrieve the vector count for the specific user namespace
        vector_count = index_stats.get("namespaces", {}).get(user_id, {}).get("vector_count", 0)
        print(vector_count)

        # Return the vector count as recordCount in the JSON response
        return jsonify({"status": "success", "recordCount": vector_count})
    except Exception as e:
        print("Error checking knowledge base for user_id", user_id, ":", e)
        return jsonify({"error": "Failed to check knowledge base", "recordCount": 0}), 500



@app.route('/get_user_id', methods=['POST'])
def get_user_id():
    data = request.get_json()
    username = data.get("username")
    
    if not username:
        print("Username is missing in the request.")
        return jsonify({"error": "Missing username"}), 400

    try:
        # Connect to the Pinecone index
        print("Connecting to Pinecone index:", user_index_name)
        index = pc.Index(user_index_name)

        # Define a minimal vector to use in the query
        minimal_vector = [0.0] * 512  # Adjust 512 to match the dimensionality of your index

        print(f"Querying Pinecone index for username: {username}")
        results = index.query(
            vector=minimal_vector,  # Provide a minimal vector
            filter={"username": username},  # Filter by username
            top_k=1,
            include_metadata=True
        )

        # Log the full response to understand its structure
        print("Full query results from Pinecone:", results)

        # Check if any matches were found
        matches = results.get("matches", [])
        if not matches:
            print("No matches found for username:", username)
            return jsonify({"error": "User not found"}), 404

        # Retrieve user_id from the metadata of the first match
        user_id = matches[0]["metadata"].get("user_id")
        if not user_id:
            print("user_id is missing in the metadata for username:", username)
            return jsonify({"error": "user_id not found in metadata"}), 500
        
        print("Retrieved user_id:", user_id)  # Log retrieved user_id
        return jsonify({"user_id": user_id})

    except Exception as e:
        print(f"Error fetching user_id from Pinecone: {e}")
        return jsonify({"error": "Failed to retrieve user_id"}), 500


@app.route('/clear_index', methods=['POST'])
def clear_index():
    data = request.get_json()
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    try:
        index = pc.Index(index_name)

        # Query to retrieve all vector IDs associated with this user_id namespace
        query_results = index.query(
            vector=[0.0] * 1536,  # Dummy vector since we only want IDs
            top_k=10000,          # Retrieve up to 10000 IDs, even if we process them in smaller chunks
            namespace=user_id,
            include_values=False  # We only need the IDs
        )

        # Extract all vector IDs
        vector_ids = [match['id'] for match in query_results.get("matches", [])]

        # Function to split list into batches of a given size
        def batch(ids, batch_size=1000):
            for i in range(0, len(ids), batch_size):
                yield ids[i:i + batch_size]

        # Process IDs in batches of 1000
        if vector_ids:
            for id_batch in batch(vector_ids, 1000):
                index.delete(ids=id_batch, namespace=user_id)  # Send only the batch of IDs
            return jsonify({"message": "User data cleared successfully.", "status": "cleared"}), 200
        else:
            return jsonify({"message": "No data found for the user.", "status": "empty"}), 200

    except Exception as e:
        print(f"Error clearing knowledge base for user_id {user_id}: {e}")
        return jsonify({"error": "Failed to clear knowledge base"}), 500


@app.route('/list_documents', methods=['POST'])
def list_documents():
    data = request.get_json()
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400

    try:
        index = pc.Index(index_name)

        # Retrieve metadata for all documents in the user's namespace
        results = index.query(
            vector=[0.0] * 1536,  # Dummy vector for retrieval
            top_k=10000,          # Adjust if more documents are needed
            namespace=user_id,
            include_metadata=True
        )

        # Extract unique document names
        documents = {match["metadata"]["document_name"] for match in results["matches"] if "document_name" in match["metadata"]}
        
        return jsonify({"documents": list(documents)})

    except Exception as e:
        print(f"Error retrieving documents for user_id {user_id}: {e}")
        return jsonify({"error": "Failed to retrieve documents"}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)
