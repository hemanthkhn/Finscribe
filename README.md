# Finscribe – Intelligent Financial Insights

[cite_start]Finscribe is an advanced financial web application developed to help users query and extract relevant information from large sets of financial documents and online resources[cite: 78]. [cite_start]By leveraging state-of-the-art AI technologies, such as OpenAI’s GPT-3.5 model and Pinecone’s vector similarity search, Finscribe enables users to securely manage their data, process diverse document formats, and generate actionable insights based on natural-language queries[cite: 79].

[cite_start]The platform is designed for financial professionals, researchers, and analysts who require timely and accurate financial information, empowering them with personalized insights to enhance decision-making[cite: 83].



## Features

* [cite_start]**Secure User Authentication**: Employs bcrypt hashing for robust password security and Pinecone namespaces to ensure user-specific data is isolated and private[cite: 365, 367, 368].
* [cite_start]**Multi-Format Document Ingestion**: Supports uploading and processing of **PDF, DOCX, and TXT** files, with a robust duplicate detection mechanism to maintain an efficient knowledge base[cite: 380, 382].
* [cite_start]**Web Content Scraping**: Allows users to paste URL links to ingest online content, using Beautiful Soup and Selenium to extract clean text for analysis[cite: 386].
* [cite_start]**AI-Powered Knowledge Base**: Users can interact with their uploaded documents through a powerful and intuitive chat interface to retrieve contextually relevant insights[cite: 390].
* **Interactive Chat Experience**:
    * [cite_start]**Real-Time Query Editing**: Modify previously submitted questions directly in the chat to refine searches without starting over[cite: 555].
    * [cite_start]**Answer Regeneration**: Request a new response to a query to gain alternative perspectives or additional detail[cite: 561, 564].
    * [cite_start]**Source Document Referencing**: Each answer explicitly references the source document(s) it was derived from, enhancing transparency and user trust[cite: 585, 588].
    * [cite_start]**Export and Copy**: Easily copy answers to the clipboard or export the entire chat history as a text file for offline review and documentation[cite: 572, 580].
* [cite_start]**Full Data Control**: A "Clear Knowledge Base" feature gives users the ability to securely and permanently delete all of their stored document embeddings from the database[cite: 396, 397].



## Tech Stack & Architecture

[cite_start]Finscribe is built on a modular architecture composed of a frontend, a backend, and a vector database, ensuring flexibility and scalability[cite: 285].

* [cite_start]**Frontend**: **React.js** [cite: 289]
* [cite_start]**Backend**: **Flask** [cite: 293]
* **AI Models**:
    * [cite_start]**OpenAI `text-embedding-ada-002`** for generating 1536-dimensional vector embeddings[cite: 249, 263].
    * [cite_start]**OpenAI `GPT-3.5-turbo`** for synthesizing information and generating contextual answers[cite: 604, 605].
* [cite_start]**Vector Database**: **Pinecone** for high-performance vector similarity search[cite: 299].
* [cite_start]**Web Scraping**: **Beautiful Soup** & **Selenium**[cite: 386].

[cite_start]When a user uploads a document, the Flask backend generates semantic embeddings and stores them in Pinecone[cite: 295, 298]. [cite_start]User queries are also embedded, allowing for a high-speed similarity search to retrieve the most relevant context, which is then passed to the GPT-3.5 model to generate a coherent, human-readable answer[cite: 302, 318].



## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

* Python 3.8+
* Node.js and npm

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/hemanthkhn/Finscribe.git](https://github.com/hemanthkhn/Finscribe.git)
    cd Finscribe
    ```

2.  **Setup the Python Backend:**
    * Create and activate a virtual environment:
        ```bash
        # For macOS/Linux
        python3 -m venv venv
        source venv/bin/activate
        ```
    * Install the required Python packages:
        ```bash
        pip install -r requirements.txt
        ```

3.  **Setup the Frontend:**
    * Install the necessary Node.js packages:
        ```bash
        npm install
        ```

4.  **Configure Environment Variables:**
    * Create a file named `.env` in the root backend directory.
    * Add your secret API keys. This file is included in `.gitignore` and must not be committed.
        ```
        OPENAI_API_KEY="your_new_openai_api_key"
        PINECONE_API_KEY="your_pinecone_api_key"
        ```

### Running the Application

1.  **Start the Backend Server:**
    ```bash
    python3 app.py
    python3 get_answer.py


    ```
2.  **Start the Frontend Development Server:**
    ```bash
    npm start
    ```
3.  Open your browser and navigate to `http://localhost:3000`.
