import React, { useState, useEffect } from 'react';
import { Button, TextField, Typography, Container, Box, Alert, Link as MuiLink } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import emailjs from 'emailjs-com';
import { auth, db } from './firebase'; // Firebase konfigürasyonunu import et
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';

const UserSignup = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    verificationCode: ''
  });
  const [message, setMessage] = useState('');
  const [randomNumber, setRandomNumber] = useState(null);
  const [timer, setTimer] = useState(60);
  const [isCodeValid, setIsCodeValid] = useState(false);

  const navigate = useNavigate();

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value
    });
  };

  const sendEmail = () => {
    const userID = "jQnD8B0lOLRwFh--u";
    const serviceID = "service_a7hr118";
    const templateID = "template_teivt2o";

    const number = Math.floor(Math.random() * 900000) + 100000;

    setRandomNumber(number);

    const params = {
      from_name: `${formData.firstName} ${formData.lastName}`,
      email_id: formData.email,
      message: `Merhaba ${formData.firstName}, kayıt işleminiz başarıyla tamamlandı. Doğrulama kodunuz: ${number}.`,
      to: formData.email 
    };

    emailjs.send(serviceID, templateID, params, userID)
      .then((res) => {
        setMessage("E-posta başarıyla gönderildi!");
        console.log("E-posta başarıyla gönderildi!", res.status);
      })
      .catch((err) => {
        setMessage(`E-posta gönderilirken bir hata oluştu: ${err.text}`);
        console.error('EmailJS Error:', err);
      });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (randomNumber && formData.verificationCode === randomNumber.toString()) {
      setMessage("Doğrulama başarılı. Kayıt işleminiz tamamlandı!");

      setTimer(0);

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        const checkEmailVerification = async () => {
          const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
              await user.reload();
              if (user.emailVerified) {
                await addDoc(collection(db, 'users'), {
                  uid: user.uid,
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  email: formData.email
                });

                setFormData({
                  firstName: '',
                  lastName: '',
                  email: '',
                  password: '',
                  verificationCode: ''
                });
                setRandomNumber(null);
                setIsCodeValid(true);
                navigate('/UserSignin');

                unsubscribe();
              } else {
                setMessage("Lütfen e-posta adresinizi doğrulayın.");
              }
            }
          });
        };

        checkEmailVerification();

      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          setMessage("Bu e-posta adresi zaten kullanılıyor. Lütfen farklı bir e-posta adresi deneyin.");
        } else {
          setMessage(`Kayıt işlemi sırasında bir hata oluştu: ${error.message}`);
        }
        console.error('Firebase Error:', error);
      }
    } else {
      setMessage("Doğrulama kodu geçersiz veya eksik!");
    }
  };

  useEffect(() => {
    let countdown;
    if (randomNumber) {
      countdown = setInterval(() => {
        setTimer((prev) => {
          if (prev === 1) {
            clearInterval(countdown);
            setMessage("Doğrulama süresi doldu. Lütfen tekrar deneyin.");
            setRandomNumber(null);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdown);
  }, [randomNumber]);

  const handleRegisterClick = () => {
    sendEmail();
  };

  return (
    <Container>
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography component="h1" variant="h5">
          Kayıt Sayfası
        </Typography>
        <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 2 }}>
          MR görüntülerinden beyin tümör tespiti uygulamasına hoş geldiniz.
        </Typography>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="firstName"
            label="Ad"
            name="firstName"
            autoComplete="given-name"
            autoFocus
            value={formData.firstName}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="lastName"
            label="Soyad"
            name="lastName"
            autoComplete="family-name"
            value={formData.lastName}
            onChange={handleChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="E-posta"
            name="email"
            autoComplete="email"
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
            autoComplete="new-password"
            value={formData.password}
            onChange={handleChange}
          />
          {randomNumber && (
            <TextField
              margin="normal"
              required
              fullWidth
              name="verificationCode"
              label={`Doğrulama Kodu (Süre: ${timer}s)`}
              type="text"
              id="verificationCode"
              autoComplete="off"
              value={formData.verificationCode}
              onChange={handleChange}
            />
          )}
          {!randomNumber && (
            <Button
              type="button"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2, backgroundColor: '#191970', color: 'white' }}
              onClick={handleRegisterClick}
            >
              Kayıt Ol
            </Button>
          )}
          {randomNumber && (
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{ mt: 3, mb: 2, backgroundColor: '#191970', color: 'white' }}
            >
              Gönder
            </Button>
          )}
        </Box>
        {message && (
          <Alert severity={message.includes('başarıyla') ? 'success' : 'error'} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}
        <Typography variant="body2" sx={{ mt: 2 }}>
          Hesabınız var mı? <MuiLink component={RouterLink} to="/UserSignin">Giriş Yap</MuiLink>
        </Typography>
      </Box>
    </Container>
  );
};

export default UserSignup;
