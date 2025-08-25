import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ProcessLinks.css';

const ProcessLinks = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { embeddings, paragraphs, request_id } = location.state || {};
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredChatIndex, setHoveredChatIndex] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [copyStatus, setCopyStatus] = useState(null);
  const [documentList, setDocumentList] = useState([]); // State for document list
  const username = localStorage.getItem('username');
  const userId = localStorage.getItem('user_id'); // Retrieve user_id from local storage

  const dummyRef = useRef(null);

  useEffect(() => {
    if (dummyRef.current) {
      dummyRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, loading]);

  // Fetch list of documents from Pinecone for the user
  const fetchDocumentList = async () => {
    if (!userId) {
      alert("User ID is missing. Please sign in again.");
      return;
    }
    
    try {
      const response = await fetch('http://127.0.0.1:5000/list_documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setDocumentList(data.documents || []);
      console.log(data.documents); 
    } catch (error) {
      console.error('Error fetching document list:', error);
      alert('Failed to load document list.');
    }
  };

  useEffect(() => {
    fetchDocumentList(); // Call fetchDocumentList when component mounts
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopyStatus(index); // Mark the index of the copied text
        setTimeout(() => setCopyStatus(null), 2000); // Reset after 2 seconds
      })
      .catch(err => console.error("Failed to copy text: ", err));
  };

  const handleExport = (text) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chat_export.txt';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const getAnswer = async (index = null) => {
    if (!userId) {
        alert("User ID is missing. Please sign in again.");
        return;
    }

    if (!query.trim() && index === null) return;

    if (index === null) {
        const newMessage = { role: 'user', content: query };
        const placeholderBotMessage = { role: 'assistant', content: 'loading' };
        setChatHistory((prevChatHistory) => [...prevChatHistory, newMessage, placeholderBotMessage]);
        setQuery('');
    } else {
        setChatHistory((prevChatHistory) => {
            const updatedHistory = [...prevChatHistory];
            updatedHistory[index + 1] = { role: 'assistant', content: 'loading' };
            return updatedHistory;
        });
    }
    
    setLoading(true);

    try {
        const currentQuery = index === null ? query : chatHistory[index].content;

        const response = await fetch('http://127.0.0.1:5001/get_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: currentQuery,
                chatHistory,
                request_id,
                user_id: userId  // Add user_id to request body
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        const newBotMessage = { 
            role: 'assistant', 
            content: data.answer, 
            document_name: data.document_name // Capture document name here
        };

        setChatHistory((prevChatHistory) => {
            if (index === null) {
                const updatedHistory = [...prevChatHistory];
                updatedHistory[updatedHistory.length - 1] = newBotMessage;
                return updatedHistory;
            } else {
                const updatedHistory = [...prevChatHistory];
                updatedHistory[index + 1] = newBotMessage;
                return updatedHistory;
            }
        });
    } catch (error) {
        console.error('Error fetching answer:', error);
        const errorMessage = { role: 'assistant', content: 'Error fetching answer. Please try again.' };

        setChatHistory((prevChatHistory) => {
            if (index === null) {
                const updatedHistory = [...prevChatHistory];
                updatedHistory[updatedHistory.length - 1] = errorMessage;
                return updatedHistory;
            } else {
                const updatedHistory = [...prevChatHistory];
                updatedHistory[index + 1] = errorMessage;
                return updatedHistory;
            }
        });
    } finally {
        setLoading(false);
    }
};

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditedContent(chatHistory[index].content);
  };

  const handleSaveAndRegenerate = (index) => {
    setChatHistory((prevChatHistory) => {
      const updatedHistory = [...prevChatHistory];
      updatedHistory[index] = { ...updatedHistory[index], content: editedContent };
      return updatedHistory;
    });
    setEditingIndex(null);
    getAnswer(index);
  };

  const handleRegenerate = (index) => {
    getAnswer(index); // Fetch a new answer for the same question without editing
  };

  const handleClear = (index) => {
    setChatHistory((prevChatHistory) =>
      prevChatHistory.filter((_, i) => i !== index && i !== index + 1)
    );
  };

  const clearKnowledgeBase = async () => {
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

            if (data.status === "empty") {
                alert('Knowledge base is already empty.');
            } else if (data.status === "cleared") {
                alert('Knowledge base cleared successfully.');
                window.location.reload(); // Reload the page after clearing the knowledge base
            } else {
                throw new Error('Unexpected response');
            }
        } catch (error) {
            console.error('Error clearing knowledge base:', error);
            alert('An error occurred while clearing the knowledge base.');
        }
    }
};


return (
  <div className="process-links-container">
    <header className="App-header">
      <h1 className="App-title" onClick={() => navigate(username ? '/app' : '/')}>
        FINSCRIBE
      </h1>
      {username && (
        <div className="user-info">
          <span>Hi, {username}</span>
          <button className="signout-button" onClick={handleSignOut}>Sign Out</button>
        </div>
      )}
    </header>

    <h2 className="chat-title">Chat with FINSCRIBE</h2>
    <div className="content-container"> {/* New Flex container */}
    <div className="chat-container">
    {chatHistory.map((msg, index) => (
        <div
            key={index}
            className="chat-bubble-container"
            onMouseEnter={() => setHoveredChatIndex(index)}
            onMouseLeave={() => setHoveredChatIndex(null)}
        >
            <div className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                <strong>{msg.role === 'user' ? 'You' : 'FINSCRIBE'}:</strong> 
                {msg.role === 'user' && editingIndex === index ? (
                    <div className="edit-mode">
                        <input
                            type="text"
                            className="edit-input"
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            autoFocus
                        />
                        <button className="save-regenerate-button" onClick={() => handleSaveAndRegenerate(index)}>
                            Save & Regenerate
                        </button>
                    </div>
                ) : (
                    msg.content === 'loading' ? (
                        <div className="typing-indicator">
                            <div className="dot"></div>
                            <div className="dot"></div>
                            <div className="dot"></div>
                        </div>
                    ) : (
                        <div>
                            <span>{msg.content}</span>
                            {msg.role === 'assistant' && hoveredChatIndex === index && (
                                <div className="chat-options">
                                    <span className="document-name">Document: {msg.document_name}</span>
                                    <button
                                        className="option-button"
                                        onClick={() => handleCopy(msg.content, index)}
                                    >
                                        {copyStatus === index ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button
                                        className="option-button"
                                        onClick={() => handleExport(msg.content)}
                                    >
                                        Export as .txt
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                )}
                {msg.role === 'user' && hoveredChatIndex === index && editingIndex !== index && (
                    <div className="chat-options">
                        <button className="option-button" onClick={() => handleEdit(index)}>Edit</button>
                        <button className="option-button" onClick={() => handleRegenerate(index)}>Regenerate</button>
                        <button className="option-button" onClick={() => handleClear(index)}>Clear</button>
                    </div>
                )}
            </div>
        </div>
    ))}
    <div ref={dummyRef}></div>
</div>

      <div className="document-list-container">
        <h3>Your Documents</h3>
        <ul>
          {documentList.map((doc, index) => (
            <li key={index}>{doc}</li>
            ))}
        </ul>
      </div>
    </div>

    <div className="question-input-container">
      <button onClick={clearKnowledgeBase} className="clear-knowledge-base-button">
        Clear Knowledge Base
      </button>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter your question here"
        className="query-input"
        onKeyDown={(e) => e.key === 'Enter' && getAnswer()}
      />
      <button onClick={() => getAnswer()} disabled={loading} className="get-answer-button">
        {loading ? 'Getting answer...' : 'Get Answer'}
      </button>
    </div>
  </div>
);  

};

export default ProcessLinks;
