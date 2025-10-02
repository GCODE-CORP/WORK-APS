document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('passwordInput');
    const errorMessage = document.getElementById('errorMessage');
    const loginBox = document.getElementById('login-box');
    const CORRECT_PASSWORD = 'aps200543';

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const enteredPassword = passwordInput.value;

        if (enteredPassword === CORRECT_PASSWORD) {
            // บันทึกสถานะการล็อกอินไว้ใน sessionStorage
            sessionStorage.setItem('isAuthenticated', 'true');
            
            errorMessage.textContent = 'รหัสผ่านถูกต้อง! กำลังเข้าสู่ระบบ...';
            errorMessage.classList.remove('text-red-400');
            errorMessage.classList.add('text-green-400');
            loginBox.style.boxShadow = '0 0 40px rgba(74, 222, 128, 0.6)';
            loginBox.style.borderColor = '#4ade80';

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);

        } else {
            errorMessage.textContent = 'รหัสผ่านไม่ถูกต้อง! กรุณาลองใหม่';
            errorMessage.classList.add('text-red-400');
            errorMessage.classList.remove('text-green-400');
            loginBox.classList.add('shake');
            passwordInput.value = '';

            setTimeout(() => {
                loginBox.classList.remove('shake');
            }, 500);
        }
    });
});
