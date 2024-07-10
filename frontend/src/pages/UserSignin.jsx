import React, { useState } from 'react';
import { Button, TextField, Typography, Container, Box, Alert, Link as MuiLink } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom'; // useNavigate'ı import edin
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase'; // Firebase konfigürasyonunu import et

const UserSignin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [message, setMessage] = useState('');

  const navigate = useNavigate(); // useNavigate fonksiyonunu çağır

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Firebase Authentication ile kullanıcı girişi
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      setMessage('Giriş yapıldı. Yönlendiriliyorsunuz...');
      setTimeout(() => {
        navigate('');  // Giriş başarılıysa kullanıcıyı /detect sayfasına yönlendir
      }, 1000);  // 1 saniye bekleme, mesajın görünmesini sağlamak için

    } catch (error) {
      setMessage('Giriş sırasında bir hata oluştu.');  // Hata durumunda kullanıcıya mesaj gösterilir
    }
  };

  return (
    <Container>
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Giriş Sayfası
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 2 }}>
          MR görüntülerinden beyin tümör tespiti uygulamasına hoş geldiniz.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="E-posta"
            name="email"
            autoComplete="email"
            autoFocus
            value={formData.email}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Şifre"
            type="password"
            id="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleChange}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            color="primary"
            sx={{ mt: 3, mb: 2, background: '#191970' }}
          >
            Giriş Yap
          </Button>
        </Box>
        {message && (
          <Alert severity={message.includes('Giriş yapıldı') ? 'success' : 'error'} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
        <Typography variant="body2" sx={{ mt: 2 }}>
          Hesabınız yok mu? <MuiLink component={RouterLink} to="/UserSignup">Kayıt Ol</MuiLink>
        </Typography>
      </Box>
    </Container>
  );
};

export default UserSignin;
