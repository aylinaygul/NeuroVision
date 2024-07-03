function SendMail() {
    // Form verilerini al
    const params = {
      from_name: document.getElementById("firstName").value,
      email_id: document.getElementById("email").value,
      message: document.getElementById("message").value
    };
  
    // EmailJS ile e-posta gönder
    emailjs.send('service_8b4kz9e', 'template_8b4kz9e', params, 'user_ID')
      .then((res) => {
        console.log("Success:", res.status);
        alert("Mail gönderildi");
      })
      .catch((err) => {
        console.error("Error:", err);
        alert("Mail gönderilirken bir hata oluştu");
      });
  }
  