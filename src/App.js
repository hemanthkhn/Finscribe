import React, { useState, useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import './App.css';
import ProcessLinks from './ProcessLinks';
import Documents from './Documents';
import 'bootstrap/dist/css/bootstrap.min.css';
import Login from './Login';
import uploadIcon from './assets/upload.png';
import pasteIcon from './assets/paste.png';
import askFromKnowledgeBase from './assets/askFromKnowledgeBase.png';
import clearKnowledgeBaseButton from './assets/clearKnowledgeBaseButton.png';

// import askIcon from './assets/images/ask-icon.png';
// import clearIcon from './assets/images/clear-icon.png';


const Header = ({ username, onSignOut }) => (
  <header className="App-header">
    <span className="App-title" onClick={() => window.location.href = username ? '/app' : '/'}>
      FINSCRIBE
    </span>
    {username && (
      <div className="user-info">
        <span>Hi, {username}</span>
        <button className="signout-button" onClick={onSignOut}>Sign Out</button>
      </div>
    )}
  </header>
);

const App = ({ uploadedFiles, setUploadedFiles, link, setLink, showLinkInput, setShowLinkInput, loading, setLoading }) => {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  const [status, setStatus] = useState(""); // Define status in App.js

  // Show an alert when status is updated
  useEffect(() => {
    if (status) {
      alert(status); // Show alert
      setStatus(""); // Reset status after showing the alert
    }
  }, [status]);

  // Handle "FINSCRIBE" click to navigate based on login status
  const handleTitleClick = () => {
    if (isLoggedIn) {
      navigate('/app');
    } else {
      navigate('/');
    }
  };

  const clearKnowledgeBase = async () => {
    const userId = localStorage.getItem('user_id');  // Retrieve user_id from local storage
    if (!userId) {
        alert("User ID is missing. Please sign in again.");
        return;
    }

    if (window.confirm('Are you sure you want to clear the entire knowledge base? This action cannot be undone.')) {
        try {
            const response = await fetch('http://127.0.0.1:5000/clear_index', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_id: userId })  // Add user_id to request body
            });

            const data = await response.json();
            console.log("Response from backend:", data);  // Log the full response to inspect structure

            if (data.status === "cleared") {
                alert('Knowledge base cleared successfully.');
                window.location.reload(); // Reload the page after clearing the knowledge base
            } else {
                alert(data.message || 'Unexpected response');
            }
        } catch (error) {
            console.error('Error clearing knowledge base:', error);
            alert('An error occurred while clearing the knowledge base.');
        }
    }
};


  const handleNavigateToDocuments = () => {
    navigate('/documents');
  };

  const handlePasteLinksClick = () => {
    setShowLinkInput(true);
  };

  const handleGoClick = async () => {
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      setStatus("User ID is missing. Please sign in again.");
      return;
    }

    const urls = link.split(',').map(url => url.trim());
    const ob = { urls, user_id: userId };

    try {
      setLoading(true);

      const response = await fetch('http://127.0.0.1:5000/process_links', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ob)
      });

      if (response.status === 409) {  // Check for 409 Conflict response
        const data = await response.json();
        const duplicates = data.duplicates.join(', ');
        setStatus(`Duplicate URLs detected: ${duplicates}`);
      } else if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      } else {
        const data = await response.json();
        console.log("Embeddings:", data.embeddings);
        console.log("Splitted chunks:", data.paragraphs);
        setStatus("URLs processed successfully.");
        navigate('/process_links', { state: { embeddings: data.embeddings, paragraphs: data.paragraphs } });
      }
    } catch (error) {
      console.error("Error processing links:", error);
      setStatus("Error processing links. Please try again.");
    } finally {
      setLoading(false);
    }
  };

const handleAskFromKnowledgeBase = async () => {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
      alert("User ID is missing. Please sign in again.");
      return;
  }

  try {
      const response = await fetch('http://127.0.0.1:5000/check_knowledge_base', {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify({ user_id: userId })  // Include user_id here
      });
      const data = await response.json();
      
      if (data.status === "success" && data.recordCount> 0) {
          navigate('/process_links');
      } else {
          alert("The knowledge base is empty.");
      }
  } catch (error) {
      console.error("Error checking knowledge base:", error);
      alert("Error checking knowledge base. Please try again.");
  }
};


const handleSignOut = () => {
  localStorage.removeItem('isLoggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('user_id');  // Remove user_id on sign out
  navigate('/');
};


return (
  <div className="App">
    <header className="App-header">
      <span className="App-title" onClick={handleTitleClick}>FINSCRIBE</span>
      {username && (
        <div className="user-info">
          <span>Hi, {username}</span>
          <button className="signout-button" onClick={handleSignOut}>Sign Out</button>
        </div>
      )}
    </header>

    <div className="button-grid">
      <div className="button-item">
        <img src={uploadIcon} alt="Upload Icon" className="button-icon" />
        <div className="uploadBtn" onClick={handleNavigateToDocuments}>
          Upload Documents
        </div>
      </div>

      <div className="button-item">
        <img src={pasteIcon} alt="Paste Icon" className="button-icon" />
        <button className="pasteBtn" onClick={handlePasteLinksClick}>
          Paste URL Links           
        </button>
        {showLinkInput && (
          <div className="link-input-container">
            <input
              type="text"
              placeholder="Paste your links here (comma separated)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="input-field"
            />
            <button className="go-button" onClick={handleGoClick} disabled={loading}>
              {loading ? 'Generating...' : 'Go'}
            </button>
          </div>
        )}
      </div>

      <div className="button-item">
        <img src={askFromKnowledgeBase} alt="Ask Icon" className="button-icon" />
        <button className="askBtn" onClick={handleAskFromKnowledgeBase}>
          Ask from Knowledge Base
        </button>
      </div>

      <div className="button-item">
        <img src={clearKnowledgeBaseButton} alt="Clear Icon" className="button-icon" />
        <button onClick={clearKnowledgeBase} className="clear-knowledge-base-button">
          Clear Knowledge Base
        </button>
      </div>
    </div>

    {loading && <div className="loading-message">Generating embeddings, please wait...</div>}
  </div>
);

};

// ProtectedRoute component to ensure only logged-in users access certain routes
const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
      navigate('/');
    }
  }, [navigate]);

  return children;
};

const AppWrapper = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [link, setLink] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/app" element={
        <ProtectedRoute>
          <App 
            uploadedFiles={uploadedFiles} 
            setUploadedFiles={setUploadedFiles} 
            link={link} 
            setLink={setLink} 
            showLinkInput={showLinkInput} 
            setShowLinkInput={setShowLinkInput} 
            loading={loading} 
            setLoading={setLoading} 
          />
        </ProtectedRoute>
      } />
      <Route path="/process_links" element={
        <ProtectedRoute>
          <ProcessLinks />
        </ProtectedRoute>
      } />
      <Route path="/documents" element={
        <ProtectedRoute>
          <Documents />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default AppWrapper;
