import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(React.StrictMode, null, 
    React.createElement(LanguageProvider, null, 
      React.createElement(App)
    )
  )
);