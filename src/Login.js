import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css'; // Import the login-specific CSS here
import zxcvbn from 'zxcvbn';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(null);
  const navigate = useNavigate();

  const checkPasswordStrength = (password) => {
    const result = zxcvbn(password);
    setPasswordStrength(password ? result.score : null);
  };

  const handleAuth = async () => {
    const endpoint = isSignup ? '/signup' : '/login';
    const userData = { username, password };

    try {
      const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('user_id', data.user_id);  // Store user_id in localStorage
        navigate('/app');
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (error) {
      console.error("Error during authentication:", error);
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <header className="login-header">FINSCRIBE</header>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="input-field"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          checkPasswordStrength(e.target.value);
        }}
        className="input-field"
      />

      {isSignup && passwordStrength !== null && (
        <div className="password-strength">
          <div className={`strength-meter strength-${passwordStrength}`}></div>
          <div className="password-strength-text">
            {passwordStrength === 0 && <span className="strength-text-weak">Weak</span>}
            {passwordStrength === 1 && <span className="strength-text-fair">Fair</span>}
            {passwordStrength === 2 && <span className="strength-text-good">Good</span>}
            {passwordStrength === 3 && <span className="strength-text-strong">Strong</span>}
            {passwordStrength === 4 && <span className="strength-text-very-strong">Very Strong</span>}
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      <button className="go-button" onClick={handleAuth}>
        {isSignup ? "Sign Up" : "Log In"}
      </button>
      <button className="toggle-button" onClick={() => setIsSignup(!isSignup)}>
        {isSignup ? "Already have an account? Login" : "Don't have an account? Signup"}
      </button>
    </div>
  );
};

export default Login;
