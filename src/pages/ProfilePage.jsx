import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    cpf: '',
    birthDate: '',
    email: '',
  });
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
    confirm: '',
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUser(parsed);
        setForm((prev) => ({
          ...prev,
          name: parsed.name || '',
          phone: parsed.phone || '',
          cpf: parsed.cpf || '',
          birthDate: parsed.birthDate || '',
          email: parsed.email || '',
        }));
      }
    } catch (e) {
      setUser(null);
    }
  }, []);

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '20px',
      gap: '16px',
    },
    card: {
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: '24px',
      width: '100%',
      maxWidth: '480px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    title: {
      margin: 0,
      color: '#166534',
      fontSize: '20px',
      fontWeight: 'bold',
    },
    sectionTitle: {
      margin: '12px 0 4px 0',
      color: '#166534',
      fontSize: '16px',
      fontWeight: 'bold',
    },
    label: { fontWeight: 'bold', color: '#111827', fontSize: '13px', marginBottom: '4px' },
    input: {
      width: '100%',
      padding: '10px',
      borderRadius: '10px',
      border: '1px solid #d1d5db',
      fontSize: '14px',
      boxSizing: 'border-box',
    },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    buttonPrimary: {
      marginTop: '8px',
      padding: '12px',
      background: '#166534',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    buttonGhost: {
      marginTop: '8px',
      padding: '12px',
      background: '#e5e7eb',
      color: '#111827',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
    infoRow: {
      background: '#f9fafb',
      borderRadius: '10px',
      padding: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      color: '#111827',
    },
    infoLabel: { fontWeight: 'bold', color: '#374151' },
    infoValue: { color: '#111827' },
    navbar: {
      width: '100%',
      maxWidth: '100%',
      background: '#bbf7d0',
      border: '1px solid #9ed8b6',
      borderRadius: '12px',
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      marginBottom: '16px',
    },
    backButton: {
      background: '#166534',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontWeight: 'bold',
    },
  };

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('loggedIn');
    sessionStorage.removeItem('loggedIn');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    navigate('/');
  };

  const handleSaveProfile = async () => {
    try {
      const res = await api.put('/profile', form);
      const updatedUser = { ...(user || {}), ...form };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setEditing(false);
      toast.success('Perfil atualizado.');
    } catch (err) {
      toast.error('Erro ao salvar perfil.');
    }
  };

  const handleChangePassword = async () => {
    if (!passwords.next || passwords.next !== passwords.confirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    try {
      await api.put('/auth/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      toast.success('Senha alterada com sucesso.');
      setPasswords({ current: '', next: '', confirm: '' });
      setEditing(false);
    } catch (err) {
      toast.error('Erro ao alterar senha.');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.navbar}>
        <span style={{ fontWeight: 'bold', color: '#166534' }}>Panda Loterias</span>
        <button style={styles.backButton} onClick={() => navigate('/home')}>
          Voltar
        </button>
      </div>
      <div style={styles.card}>
        <h2 style={styles.title}>Perfil</h2>

        {!editing && (
          <>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>ID</span>
              <span style={styles.infoValue}>{user?.id || '---'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Nome</span>
              <span style={styles.infoValue}>{user?.name || '---'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Telefone</span>
              <span style={styles.infoValue}>{user?.phone || '---'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>CPF</span>
              <span style={styles.infoValue}>{user?.cpf || '---'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Data de nascimento</span>
              <span style={styles.infoValue}>{user?.birthDate || '---'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Email</span>
              <span style={styles.infoValue}>{user?.email || '---'}</span>
            </div>
            <button style={styles.buttonPrimary} onClick={() => setEditing(true)}>
              Editar
            </button>
          </>
        )}

        {editing && (
          <>
            <div style={styles.label}>Nome</div>
            <input
              style={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Seu nome completo"
            />

            <div style={styles.label}>Telefone</div>
            <input
              style={styles.input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(99) 99999-9999"
            />

            <div style={styles.row}>
              <div>
                <div style={styles.label}>CPF (obrigatório para Pix)</div>
                <input
                  style={styles.input}
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <div style={styles.label}>Data de nascimento</div>
                <input
                  style={styles.input}
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div style={styles.label}>Email (opcional)</div>
              <input
                style={styles.input}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="voce@exemplo.com"
              />
            </div>

            <button style={styles.buttonPrimary} onClick={handleSaveProfile}>
              Salvar perfil
            </button>

            <div style={styles.sectionTitle}>Alterar senha</div>
            <div style={styles.label}>Senha atual</div>
            <input
              style={styles.input}
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              placeholder="Senha atual"
            />
            <div style={styles.label}>Nova senha</div>
            <input
              style={styles.input}
              type="password"
              value={passwords.next}
              onChange={(e) => setPasswords({ ...passwords, next: e.target.value })}
              placeholder="Nova senha"
            />
            <div style={styles.label}>Confirmar nova senha</div>
            <input
              style={styles.input}
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              placeholder="Repita a nova senha"
            />
            <button style={styles.buttonPrimary} onClick={handleChangePassword}>
              Alterar senha
            </button>
          </>
        )}

        <button style={styles.buttonPrimary} onClick={logout}>
          Sair
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
