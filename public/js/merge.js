document.addEventListener('DOMContentLoaded', () => {
    const canvasEl = document.getElementById('twibbonCanvas');
    const wrapper = document.querySelector('.canvas-wrapper');
    const userPhotoInput = document.getElementById('userPhotoInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn'); // Tombol baru
    const statusText = document.getElementById('status');
    const zoomSlider = document.getElementById('zoomSlider');

    // Inisialisasi Fabric.js Canvas
    const canvas = new fabric.Canvas('twibbonCanvas', {
        backgroundColor: '#ffffff'
    });

    const twibbonUrl = canvasEl.dataset.twibbonUrl;
    let userImage = null;

    // Cek apakah Web Share API didukung dan tampilkan tombolnya
    if (navigator.share) {
        shareBtn.classList.remove('hidden');
    }

    // Fungsi untuk mengaktifkan/menonaktifkan tombol
    function setButtonsState(enabled) {
        downloadBtn.disabled = !enabled;
        shareBtn.disabled = !enabled;
    }

    // 1. Muat gambar Twibbon dan atur sebagai overlay
    fabric.Image.fromURL(twibbonUrl, (twibbonImg) => {
        const maxWidth = 600;
        const containerWidth = wrapper.clientWidth - (parseInt(getComputedStyle(wrapper).paddingLeft) * 2);
        const canvasWidth = Math.min(containerWidth, maxWidth);
        const aspectRatio = twibbonImg.height / twibbonImg.width;
        const canvasHeight = canvasWidth * aspectRatio;

        canvas.setWidth(canvasWidth);
        canvas.setHeight(canvasHeight);

        canvas.setOverlayImage(twibbonImg, canvas.renderAll.bind(canvas), {
            scaleX: canvasWidth / twibbonImg.width,
            scaleY: canvasHeight / twibbonImg.height,
            originX: 'left',
            originY: 'top',
        });
        statusText.textContent = "Twibbon siap. Silakan unggah fotomu.";
    }, { crossOrigin: 'Anonymous' });

    // 2. Handle saat pengguna mengunggah foto
    userPhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            fabric.Image.fromURL(event.target.result, (img) => {
                if (userImage) {
                    canvas.remove(userImage);
                }
                userImage = img;
                userImage.scaleToWidth(canvas.getWidth());
                userImage.center();
                userImage.set({
                    borderColor: 'rgba(255,255,255,0.7)',
                    cornerColor: 'rgba(255,255,255,0.7)',
                    cornerSize: 12,
                    transparentCorners: false,
                    cornerStyle: 'circle'
                });
                canvas.add(userImage);
                canvas.sendToBack(userImage);

                // Aktifkan semua tombol
                setButtonsState(true);
                zoomSlider.disabled = false;
                zoomSlider.value = userImage.scaleX;
                statusText.textContent = "Geser dan ubah ukuran fotomu.";
            });
        };
        reader.readAsDataURL(file);
    });

    // 3. Handle kontrol zoom
    zoomSlider.addEventListener('input', (e) => {
        if (userImage) {
            userImage.scale(parseFloat(e.target.value)).setCoords();
            canvas.renderAll();
        }
    });

    // 4. Handle tombol download
    downloadBtn.addEventListener('click', () => {
        if (!userImage) return;
        canvas.discardActiveObject();
        canvas.renderAll();
        const link = document.createElement('a');
        const slug = twibbonUrl.split('/').pop().split('.')[0];
        link.download = `twibbon-${slug}-by-gemini.png`;
        link.href = canvas.toDataURL({ format: 'png', quality: 1.0 });
        link.click();
    });

    // 5. LOGIKA DIPERBAIKI: Handle tombol share
    shareBtn.addEventListener('click', async () => {
        if (!userImage || !navigator.share) return;

        statusText.textContent = "Menyiapkan gambar untuk dibagikan...";
        canvas.discardActiveObject();
        canvas.renderAll();

        // PERBAIKAN: Gunakan toDataURL lalu konversi ke Blob menggunakan fetch
        const dataUrl = canvas.toDataURL({ format: 'png', quality: 1.0 });

        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], 'twibbon-hasil.png', { type: 'image/png' });

            const shareData = {
                files: [file],
                title: document.title,
                text: 'Aku baru saja membuat twibbon ini menggunakan TwibbonPro!',
            };

            await navigator.share(shareData);
            statusText.textContent = "Berhasil dibagikan!";
        } catch (err) {
            // Handle jika pengguna membatalkan dialog share atau ada error lain
            statusText.textContent = "Pembagian dibatalkan atau gagal.";
            console.error("Share failed:", err.message);
        }
    });
});
