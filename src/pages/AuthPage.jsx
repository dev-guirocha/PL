import React, { useState } from 'react';
import axios from 'axios';
import InputMask from 'react-input-mask'; // Para formatar o telefone (11) 9...

// Configuração básica do Axios (ajuste a URL se necessário)
const api = axios.create({ baseURL: 'http://localhost:3000/api' });

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true); // Alternar entre Login e Cadastro
  const [formData, setFormData] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    
    try {
      const response = await api.post(endpoint, formData);
      const { token, user } = response.data;

      // Salvar token
      if (rememberMe || !isLogin) { // Se "Salvar Acesso" ou for cadastro
        localStorage.setItem('token', token);
      } else {
        sessionStorage.setItem('token', token);
      }
      
      alert(`Bem-vindo, ${user.name || 'Usuário'}! Login realizado.`);
      // Aqui redirecionaremos para a Home na próxima etapa
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar.');
    }
  };

  // Estilos "Inline" para garantir o visual exato pedido
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#dcfce7', // Fundo Verde Claro (Tailwind green-100 similar)
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
    },
    card: {
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      width: '100%',
      maxWidth: '400px',
    },
    title: {
      color: '#166534', // Verde escuro
      textAlign: 'center',
      marginBottom: '1.5rem',
    },
    inputGroup: {
      marginBottom: '1rem',
    },
    input: {
      width: '100%',
      padding: '12px',
      borderRadius: '8px',
      border: '1px solid #ccc',
      fontSize: '16px',
      boxSizing: 'border-box', // Importante para não quebrar layout
    },
    button: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#22c55e', // Verde vibrante (botão de ação)
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      cursor: 'pointer',
      marginTop: '10px',
      fontWeight: 'bold',
    },
    toggleText: {
      textAlign: 'center',
      marginTop: '15px',
      color: '#666',
      fontSize: '14px',
    },
    link: {
      color: '#166534',
      fontWeight: 'bold',
      cursor: 'pointer',
      textDecoration: 'underline',
    },
    checkboxContainer: {
        display: 'flex',
        alignItems: 'center',
        marginTop: '10px',
        fontSize: '14px',
        color: '#555'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>
            {isLogin ? 'Acessar Conta' : 'Criar Nova Conta'}
        </h2>

        {error && <p style={{color: 'red', textAlign: 'center', marginBottom: '10px'}}>{error}</p>}

        <form onSubmit={handleSubmit}>
          
          {/* Campo Nome (Só aparece no cadastro) */}
          {!isLogin && (
            <div style={styles.inputGroup}>
              <input
                type="text"
                name="name"
                placeholder="Seu Nome Completo"
                value={formData.name}
                onChange={handleChange}
                style={styles.input}
                required={!isLogin}
              />
            </div>
          )}

          {/* Campo Telefone (Com máscara) */}
          <div style={styles.inputGroup}>
            <InputMask
              mask="(99) 99999-9999"
              value={formData.phone}
              onChange={handleChange}
            >
              {(inputProps) => (
                <input
                  {...inputProps}
                  type="tel"
                  name="phone"
                  placeholder="Seu Celular (WhatsApp)"
                  style={styles.input}
                  required
                />
              )}
            </InputMask>
          </div>

          {/* Campo Senha */}
          <div style={styles.inputGroup}>
            <input
              type="password"
              name="password"
              placeholder="Sua Senha"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          {/* Checkbox Salvar Acesso (Só no Login) */}
          {isLogin && (
              <div style={styles.checkboxContainer}>
                  <input 
                    type="checkbox" 
                    id="saveAccess" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{marginRight: '8px'}}
                  />
                  <label htmlFor="saveAccess">Salvar acesso</label>
              </div>
          )}

          <button type="submit" style={styles.button}>
            {isLogin ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>

        <p style={styles.toggleText}>
          {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
          <span 
            style={styles.link} 
            onClick={() => {
                setIsLogin(!isLogin); 
                setError('');
                setFormData({name: '', phone: '', password: ''});
            }}
          >
            {isLogin ? 'Cadastre-se' : 'Fazer Login'}
          </span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;