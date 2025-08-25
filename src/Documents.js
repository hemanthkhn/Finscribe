import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css'; // Import shared styles from App.css
import './Documents.css'; // Import any additional styles specific to Documents
import pdfIcon from './icons/pdf-icon.png';
import docIcon from './icons/doc-icon.png';
import txtIcon from './icons/txt-icon.png';
import defaultIcon from './icons/file-icon.png';

const Documents = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileObjects, setFileObjects] = useState(null); // Stores actual File objects
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();
  const username = localStorage.getItem('username'); // Retrieve username from local storage

  // Load file metadata from local storage on component mount
  useEffect(() => {
    const savedFiles = JSON.parse(localStorage.getItem('selectedFiles')) || [];
    setSelectedFiles(savedFiles);
  
    // Check if user_id is in local storage, fetch if missing
    const userId = localStorage.getItem('user_id');
    if (!userId && username) {
      fetchUserIdFromPinecone(username).then(fetchedUserId => {
        if (fetchedUserId) {
          localStorage.setItem('user_id', fetchedUserId); // Cache user_id for future use
        }
      });
    }
  }, []);
  

  // Save file metadata to local storage whenever selectedFiles changes
  useEffect(() => {
    localStorage.setItem('selectedFiles', JSON.stringify(selectedFiles));
  }, [selectedFiles]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    const fileMetadata = files.map(file => ({
      name: file.name,
      type: file.type,
    }));

    setSelectedFiles(fileMetadata);
    setFileObjects(files); // Store the actual File objects
    setStatus(""); // Clear status message when new files are selected
  };
  const fetchUserIdFromPinecone = async (username) => {
    try {
        console.log("Fetching user_id for username:", username);  // Log username
        const response = await fetch('http://127.0.0.1:5000/get_user_id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })  // Send username to backend
        });

        if (!response.ok) {
            console.error("Failed to retrieve user_id from backend. Status:", response.status);
            throw new Error('Failed to retrieve user_id from Pinecone');
        }

        const data = await response.json();
        console.log("Received user_id:", data.user_id);  // Log user_id
        return data.user_id;  // Assuming the backend returns { "user_id": "..." }
    } catch (error) {
        console.error("Error retrieving user_id:", error);
        alert("Failed to retrieve user_id. Please try again.");
        return null;
    }
};


const handleGenerateEmbeddings = async () => {
  const username = localStorage.getItem('username');
  const userId = await fetchUserIdFromPinecone(username);
  if (!userId) return;

  if (!fileObjects || fileObjects.length === 0) {
      alert("Please reselect the files for processing.");
      return;
  }

  setLoading(true);
  setStatus("Starting embedding generation...");

  try {
      const formData = new FormData();
      fileObjects.forEach((file) => {
          formData.append("file", file);
      });
      formData.append("user_id", userId);

      const response = await fetch('http://127.0.0.1:5000/generate_embeddings_from_file', {
          method: 'POST',
          body: formData,
      });

      if (response.status === 409) {  // Check for duplicate document status
          const errorData = await response.json();
          alert(errorData.error || "Duplicate document error");  // Show alert for duplicate document
          return;
      }

      if (!response.ok) {
          throw new Error('Failed to generate embeddings');
      }

      const data = await response.json();
      navigate('/process_links', { state: { embeddings: data.embeddings, paragraphs: data.paragraphs } });
      console.log(data.embeddings);
      console.log(data.paragraphs);
      setStatus("Embeddings generated successfully.");
      setSelectedFiles([]);
      setFileObjects(null);
      localStorage.removeItem('selectedFiles');
  } catch (error) {
      console.error('Error generating embeddings:', error);
      alert("An error occurred during embedding generation.");  // Show alert for general errors
  } finally {
      setLoading(false);
  }
};


  const getFileIcon = (file) => {
    const fileType = file.name.split('.').pop().toLowerCase();
    switch (fileType) {
      case 'pdf':
        return pdfIcon;
      case 'doc':
      case 'docx':
        return docIcon;
      case 'txt':
        return txtIcon;
      default:
        return defaultIcon;
    }
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setFileObjects(null);
    localStorage.removeItem('selectedFiles');
    setStatus("Files cleared.");
  };

  return (
    <div className="documents-container">
      <header className="App-header">
        <h1 className="App-title" onClick={() => navigate(username ? '/app' : '/')}>
          FINSCRIBE
        </h1>
        {username && (
          <div className="user-info">
            <span>Hi, {username}</span>
            <button className="signout-button" onClick={() => navigate('/')}>Sign Out</button>
          </div>
        )}
      </header>

      <h2 className="title">Select Documents for Embedding Generation</h2>
      <div className="documents-content">
        <label htmlFor="file-upload" className="file-input-label">
          Choose Files
          <input 
            id="file-upload"
            type="file"
            multiple
            onChange={handleFileChange} 
            className="file-input"
          />
        </label>
        
        <div className="documents-preview">
          {selectedFiles.map((file, index) => (
            <div key={index} className="document-preview">
              <img src={getFileIcon(file)} alt="File type icon" className="file-icon" />
              <span>{file.name}</span>
            </div>
          ))}
        </div>

        {selectedFiles.length > 0 && !fileObjects && (
          <p className="status-message">Please reselect the files to generate embeddings.</p>
        )}

        <div className="button-container">
          <button 
            className="generate-button" 
            onClick={handleGenerateEmbeddings} 
            disabled={!fileObjects || loading}
          >
            {loading ? 'Generating Embeddings...' : 'Generate Embeddings'}
          </button>
          <button 
            className="clear-button" 
            onClick={clearSelectedFiles}
            disabled={loading}
          >
            Clear Files
          </button>
        </div>

        {loading && (
          <div className="spinner-container">
            <div className="spinner"></div>
          </div>
        )}
        {status && <p className="status-message">{status}</p>}
      </div>
    </div>
  );
};

export default Documents;
