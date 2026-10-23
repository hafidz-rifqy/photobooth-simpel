(function(){
    const video = document.getElementById('video');
    const captureBtn = document.getElementById('captureBtn');
    const flash = document.getElementById('flash');
    const photoCountSpan = document.getElementById('photoCount');
    const thumbnailStrip = document.getElementById('thumbnailStrip');
    const frameOptions = document.getElementById('frameOptions');
    const nameInput = document.getElementById('nameInput');
    const placeholderText = document.getElementById('placeholderText');
    const resultContainer = document.getElementById('resultContainer');
    const photoStripCanvas = document.getElementById('photoStripCanvas');
    const saveBtn = document.getElementById('saveBtn');
    const countdownOverlay = document.getElementById('countdownOverlay');
    const countdownNumber = document.getElementById('countdownNumber');
    const cameraError = document.getElementById('cameraError');
    const cameraErrorMsg = document.getElementById('cameraErrorMsg');
    const retryCameraBtn = document.getElementById('retryCameraBtn');

    let photos = [];
    let selectedFrame = 'pink';
    const MAX_PHOTOS = 3;
    let isCapturing = false;
    let cameraReady = false;
    let mediaStream = null;

    const frameStyles = {
        pink:   { bg: '#FFD9E8', accent: '#FF7A9F', text: '#B3406E', pattern: 'hearts' },
        blue:   { bg: '#D4E9FF', accent: '#6D9ED6', text: '#2A4B7C', pattern: 'stars' },
        green:  { bg: '#D9F0DF', accent: '#6AAE7E', text: '#2C6B3F', pattern: 'leaves' },
        purple: { bg: '#E8D9FF', accent: '#A77BCA', text: '#593A7A', pattern: 'moons' },
        yellow: { bg: '#FFF3C9', accent: '#E5B83C', text: '#7A5A1A', pattern: 'suns' }
    };

    // ---------- Kamera ----------
    async function initCamera() {
        cameraError.classList.remove('show');
        cameraReady = false;

        if (!window.isSecureContext) {
            showCameraError('Halaman ini tidak berjalan di <b>HTTPS</b> atau <b>localhost</b>.<br>Browser memblokir akses kamera. Coba buka lewat <code>https://</code> atau <code>localhost</code>.');
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showCameraError('Browser ini tidak mendukung akses kamera (getUserMedia). Coba pakai Chrome/Firefox terbaru.');
            return;
        }

        const constraintsList = [
            { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
            { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
            { video: true, audio: false }
        ];

        let lastError = null;
        for (const constraints of constraintsList) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                mediaStream = stream;
                video.srcObject = stream;
                await video.play();
                cameraReady = true;
                cameraError.classList.remove('show');
                captureBtn.disabled = false;
                return;
            } catch (err) {
                lastError = err;
                console.warn('Constraint gagal, coba berikutnya...', err.name);
            }
        }

        let msg = 'Kamera tidak bisa diakses.';
        if (lastError) {
            if (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError') {
                msg = 'Izin kamera <b>ditolak</b>. Klik ikon 🔒 di address bar → izinkan kamera, lalu klik "Coba Lagi".';
            } else if (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError') {
                msg = 'Tidak ada <b>kamera</b> terdeteksi di perangkat ini.';
            } else if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
                msg = 'Kamera sedang <b>dipakai aplikasi lain</b>. Tutup aplikasi tersebut lalu coba lagi.';
            } else if (lastError.name === 'OverconstrainedError') {
                msg = 'Resolusi kamera tidak cocok. Coba lagi.';
            } else if (lastError.name === 'SecurityError') {
                msg = 'Akses kamera diblokir karena halaman <b>tidak aman</b> (butuh HTTPS/localhost).';
            } else {
                msg = 'Error: ' + (lastError.message || lastError.name);
            }
        }
        showCameraError(msg);
    }

    function showCameraError(htmlMsg) {
        cameraErrorMsg.innerHTML = htmlMsg;
        cameraError.classList.add('show');
        captureBtn.disabled = true;
        cameraReady = false;
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            mediaStream = null;
        }
        video.srcObject = null;
        cameraReady = false;
    }

    retryCameraBtn.addEventListener('click', () => {
        stopCamera();
        initCamera();
    });

    // ---------- Flash & delay ----------
    function triggerFlash() {
        flash.classList.add('active');
        setTimeout(() => flash.classList.remove('active'), 150);
    }

    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    // ---------- Countdown 3-2-1 lalu ambil foto ----------
    async function countdownAndCapture() {
        countdownOverlay.classList.add('active');
        for (let i = 3; i >= 1; i--) {
            countdownNumber.textContent = i;
            countdownNumber.style.animation = 'none';
            void countdownNumber.offsetWidth;
            countdownNumber.style.animation = 'countPop 0.9s ease-in-out';
            await delay(1000);
        }
        countdownOverlay.classList.remove('active');

        triggerFlash();
        await delay(100);

        // canvas capture 4:3 (400x300)
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/png');
        photos.push(dataUrl);
        updatePhotoUI();

        if (photos.length === MAX_PHOTOS) {
            renderPhotoStrip();
        }
    }

    async function startPhotoSession() {
        if (isCapturing) return;
        if (!cameraReady) {
            alert('Kamera belum aktif. Pastikan izin kamera diberikan lalu klik "Coba Lagi".');
            return;
        }
        if (photos.length > 0) {
            if (!confirm('Foto sebelumnya akan hilang. Lanjutkan?')) return;
            resetSession();
        }

        isCapturing = true;
        captureBtn.disabled = true;

        for (let i = 0; i < MAX_PHOTOS; i++) {
            if (i > 0) await delay(400);
            await countdownAndCapture();
        }

        isCapturing = false;
        captureBtn.disabled = true;
    }

    function resetSession() {
        photos = [];
        updatePhotoUI();
        placeholderText.style.display = 'block';
        resultContainer.style.display = 'none';
        captureBtn.disabled = false;
        const ctx = photoStripCanvas.getContext('2d');
        ctx.clearRect(0, 0, photoStripCanvas.width, photoStripCanvas.height);
    }

    function updatePhotoUI() {
        photoCountSpan.textContent = photos.length;

        thumbnailStrip.innerHTML = '';
        photos.forEach((dataUrl) => {
            const img = document.createElement('img');
            img.src = dataUrl;
            thumbnailStrip.appendChild(img);
        });

        if (photos.length === MAX_PHOTOS) {
            placeholderText.style.display = 'none';
            resultContainer.style.display = 'flex';
            renderPhotoStrip();
        } else {
            resultContainer.style.display = 'none';
            placeholderText.style.display = 'block';
        }

        if (photos.length >= MAX_PHOTOS) {
            captureBtn.disabled = true;
        } else if (!isCapturing && cameraReady) {
            captureBtn.disabled = false;
        }
    }

    // ---------- Render strip dengan bingkai dekoratif & foto rasio 4:3 ----------
    function renderPhotoStrip() {
        if (photos.length < MAX_PHOTOS) return;

        const canvas = photoStripCanvas;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;   // 420
        const H = canvas.height;  // 900

        ctx.clearRect(0, 0, W, H);

        const style = frameStyles[selectedFrame] || frameStyles.pink;
        const frameColor = style.bg;
        const accentColor = style.accent;
        const textColor = style.text;

        // Background gradient lembut
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, frameColor);
        grad.addColorStop(1, lighten(frameColor, 18));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Pola dekoratif
        const symbols = { hearts: '❤️', stars: '✨', leaves: '🍃', moons: '🌙', suns: '☀️' };
        const symbol = symbols[style.pattern] || '✨';
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 30; i++) {
            ctx.font = `${14 + Math.random()*16}px "Segoe UI", sans-serif`;
            ctx.fillStyle = accentColor;
            ctx.save();
            ctx.translate(Math.random() * W, Math.random() * H);
            ctx.rotate((Math.random() - 0.5) * 0.6);
            ctx.fillText(symbol, 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;

        // Border ganda dekoratif
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 10;
        ctx.strokeRect(12, 12, W - 24, H - 24);

        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, W - 40, H - 40);

        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(28, 28, W - 56, H - 56);
        ctx.setLineDash([]);

        // Ornamen sudut
        drawCornerOrnaments(ctx, W, H, accentColor, style.pattern);

        // FOTO rasio 4:3 (sama dengan canvas capture 400x300)
        const photoW = 280;
        const photoH = 210;   // 280 x 210 = 4:3 ✓
        const startX = (W - photoW) / 2;
        const gap = 34;       // jarak antar foto
        const startY = 60;

        let loadedCount = 0;
        const imgObjects = [];

        photos.forEach((dataUrl, idx) => {
            const img = new Image();
            img.src = dataUrl;
            img.onload = () => {
                imgObjects[idx] = img;
                loadedCount++;
                if (loadedCount === MAX_PHOTOS) {
                    drawFramesAndImages(imgObjects, style, photoW, photoH, startX, startY, W, H, textColor, accentColor, gap);
                }
            };
        });
    }

    function drawCornerOrnaments(ctx, W, H, accent, pattern) {
        const icons = { hearts: '❤', stars: '★', leaves: '❧', moons: '☾', suns: '☀' };
        const icon = icons[pattern] || '★';
        ctx.font = '26px "Segoe UI", sans-serif';
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const pad = 22;
        ctx.save();
        ctx.fillText(icon, pad, pad);
        ctx.fillText(icon, W - pad, pad);
        ctx.fillText(icon, pad, H - pad);
        ctx.fillText(icon, W - pad, H - pad);
        ctx.restore();

        ctx.font = '20px "Segoe UI", sans-serif';
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.6;
        ctx.fillText('✦ ✦ ✦', W / 2, 40);
        ctx.globalAlpha = 1.0;
    }

    function drawFramesAndImages(images, style, photoW, photoH, startX, startY, W, H, textColor, accentColor, gap) {
        const ctx = photoStripCanvas.getContext('2d');

        // helper: gambar dengan object-fit cover agar tidak gepeng
        function drawImageCover(ctx, img, x, y, w, h) {
            const imgRatio = img.width / img.height;
            const boxRatio = w / h;
            let sx, sy, sw, sh;
            if (imgRatio > boxRatio) {
                sh = img.height;
                sw = sh * boxRatio;
                sx = (img.width - sw) / 2;
                sy = 0;
            } else {
                sw = img.width;
                sh = sw / boxRatio;
                sx = 0;
                sy = (img.height - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        }

        for (let i = 0; i < 3; i++) {
            const yPos = startY + i * (photoH + gap);

            // Bayangan + frame putih tebal
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.22)';
            ctx.shadowBlur = 16;
            ctx.shadowOffsetY = 8;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.roundRect(startX - 10, yPos - 10, photoW + 20, photoH + 20, 18);
            ctx.fill();
            ctx.restore();

            // garis aksen tepi frame
            ctx.strokeStyle = accentColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(startX - 10, yPos - 10, photoW + 20, photoH + 20, 18);
            ctx.stroke();

            // gambar foto dengan cover (tidak gepeng)
            if (images[i] && images[i].complete) {
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(startX, yPos, photoW, photoH, 14);
                ctx.clip();
                drawImageCover(ctx, images[i], startX, yPos, photoW, photoH);
                ctx.restore();
            }
        }

        // Nama custom
        const name = nameInput.value.trim() || 'Photobooth';
        const nameY = H - 80;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        const ribbonW = Math.min(W - 100, 60 + name.length * 18);
        ctx.roundRect((W - ribbonW) / 2, nameY - 30, ribbonW, 60, 30);
        ctx.fill();
        ctx.restore();

        ctx.font = 'bold 30px "Pacifico", "Quicksand", cursive';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, W / 2, nameY);

        ctx.font = '16px "Segoe UI", sans-serif';
        ctx.fillStyle = accentColor;
        ctx.fillText('✧  📸  ✧', W / 2, H - 25);
    }

    function lighten(hex, percent) {
        const num = parseInt(hex.replace('#',''), 16);
        const amt = Math.round(2.55 * percent);
        let R = (num >> 16) + amt;
        let G = (num >> 8 & 0x00FF) + amt;
        let B = (num & 0x0000FF) + amt;
        R = Math.min(255, Math.max(0, R));
        G = Math.min(255, Math.max(0, G));
        B = Math.min(255, Math.max(0, B));
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r);
        this.lineTo(x + w, y + h - r);
        this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.lineTo(x + r, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r);
        this.lineTo(x, y + r);
        this.quadraticCurveTo(x, y, x + r, y);
        return this;
    };

    function selectFrame(frame) {
        selectedFrame = frame;
        document.querySelectorAll('.frame-item').forEach(el => {
            el.classList.remove('selected');
            if (el.dataset.frame === frame) el.classList.add('selected');
        });
        if (photos.length === MAX_PHOTOS) {
            renderPhotoStrip();
        }
    }

    function saveImage() {
        if (photos.length < MAX_PHOTOS) {
            alert('Ambil 3 foto dulu ya!');
            return;
        }
        const canvas = photoStripCanvas;
        const link = document.createElement('a');
        const name = nameInput.value.trim() || 'photobooth';
        link.download = `photobooth_${name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    captureBtn.addEventListener('click', startPhotoSession);

    frameOptions.addEventListener('click', (e) => {
        const frameItem = e.target.closest('.frame-item');
        if (!frameItem) return;
        selectFrame(frameItem.dataset.frame);
    });

    nameInput.addEventListener('input', () => {
        if (photos.length === MAX_PHOTOS) {
            renderPhotoStrip();
        }
    });

    saveBtn.addEventListener('click', saveImage);

    initCamera();
    selectedFrame = 'pink';
    placeholderText.style.display = 'block';
    resultContainer.style.display = 'none';
    captureBtn.disabled = true;
})();