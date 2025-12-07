// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';

const HomePage = () => (
  <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
    <h1>Login ok!</h1>
    <p>Você chegou aqui após logar. Ajuste este conteúdo para o app real.</p>
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
