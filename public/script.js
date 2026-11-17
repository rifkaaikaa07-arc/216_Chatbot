
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");

const messages = [];

// =========================
// Fungsi menampilkan pesan
// =========================

function addMessage(text, sender, historyMessage = null) {

    const message = document.createElement("div");

    message.classList.add("message", sender);

    const content = document.createElement("div");

    content.classList.add("message-content");
    content.textContent = text;

    message.appendChild(content);

    // Membuat tombol aksi
    const actions = document.createElement("div");
    actions.classList.add("message-actions");

    if (sender === "user") {

        const editButton = document.createElement("button");

        editButton.textContent = "✏️ Edit";

        editButton.addEventListener("click", () => {

            const index = messages.indexOf(historyMessage);

            if (index === -1) return;

            // Hapus riwayat mulai dari pesan yang diedit
            messages.splice(index);

            // Hapus pesan tersebut dan semua pesan setelahnya
            let currentMessage = message;

            while (currentMessage) {
                const nextMessage = currentMessage.nextElementSibling;
                currentMessage.remove();
                currentMessage = nextMessage;
            }

            // Masukkan pesan lama ke kolom input
            userInput.value = text;
            userInput.focus();

        });

        actions.appendChild(editButton);

    }

    if (sender === "bot" && text) {

        const copyButton = document.createElement("button");

        copyButton.textContent = "📋 Salin";

        copyButton.addEventListener("click", async () => {

            try {

                await navigator.clipboard.writeText(content.textContent);

                copyButton.textContent = "✓ Tersalin";

            } catch (error) {

                console.error("Gagal menyalin pesan:", error);
                copyButton.textContent = "Gagal menyalin";

            }

        });

        actions.appendChild(copyButton);

    }

    if (actions.children.length > 0) {
        message.appendChild(actions);
    }

    chatBox.appendChild(message);

    chatBox.scrollTop = chatBox.scrollHeight;

    return content;
}


// =========================
// Menampilkan error ramah
// =========================

function getFriendlyError(errorText) {

    try {

        const errorData = JSON.parse(errorText);

        const errorMessage =
            errorData.error?.message ||
            errorData.message ||
            errorData.error ||
            "";

        const errorCode =
            errorData.error?.code ||
            errorData.code;

        if (
            errorCode === 429 ||
            String(errorMessage).toLowerCase().includes("rate-limit") ||
            String(errorMessage).toLowerCase().includes("toomanyrequests")
        ) {
            return "Maaf, layanan AI sedang ramai saat ini. Silakan coba kembali beberapa saat lagi. 🌷";
        }

        return typeof errorMessage === "string" && errorMessage
            ? errorMessage
            : "Terjadi kesalahan pada server.";

    } catch (error) {

        return "Maaf, layanan AI sedang mengalami gangguan. Silakan coba kembali.";

    }
}


// =========================
// Proses streaming data
// =========================

function processLine(line, botContent, responseState) {

    const trimmedLine = line.trim();

    if (!trimmedLine.startsWith("data:")) {
        return;
    }

    const data = trimmedLine.slice(5).trim();

    if (!data || data === "[DONE]") {
        return;
    }

    try {

        const token = JSON.parse(data);

        if (typeof token === "string") {

            responseState.botResponse += token;

            botContent.textContent = responseState.botResponse;

            chatBox.scrollTop = chatBox.scrollHeight;

        } else if (token.error) {

            console.error("Stream API Error:", token.error);

        }

    } catch (error) {

        console.error("Gagal membaca token:", error);

    }
}


// =========================
// Kirim pesan chatbot
// =========================

chatForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const message = userInput.value.trim();

    if (!message) {
        return;
    }

    // Simpan pesan user
    const userMessage = {
        role: "user",
        content: message
    };

    messages.push(userMessage);

    // Tampilkan pesan user
    addMessage(message, "user", userMessage);

    // Kosongkan input
    userInput.value = "";

    // Disable input sementara
    userInput.disabled = true;

    const button = chatForm.querySelector("button");

    button.disabled = true;
    button.textContent = "Menunggu...";

    // Disable tombol aksi selama AI menjawab
    chatBox.querySelectorAll(".message-actions button").forEach(action => {
        action.disabled = true;
    });

    // Buat bubble AI kosong
    const botContent = addMessage("", "bot");

    const responseState = {
        botResponse: ""
    };

    try {

        const response = await fetch("/api/chat", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                messages: messages
            })

        });

        // Cek error OpenRouter
        if (!response.ok) {

            const errorData = await response.text();

            throw new Error(getFriendlyError(errorData));

        }

        // Cek streaming response
        if (!response.body) {
            throw new Error("Streaming tidak tersedia.");
        }

        // Baca streaming response
        const reader = response.body.getReader();

        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {

            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            // Decode data
            buffer += decoder.decode(value, {
                stream: true
            });

            // Pisahkan berdasarkan newline
            const lines = buffer.split("\n");

            // Simpan bagian yang belum lengkap
            buffer = lines.pop();

            for (const line of lines) {

                processLine(line, botContent, responseState);

            }

        }

        // Proses sisa data
        buffer += decoder.decode();

        if (buffer.trim()) {

            processLine(buffer, botContent, responseState);

        }

        // Simpan jawaban AI
        messages.push({
            role: "assistant",
            content: responseState.botResponse
        });

        // Tambahkan tombol salin pada jawaban AI
        const botMessage = botContent.parentElement;

        const copyButton = document.createElement("button");

        copyButton.textContent = "📋 Salin";

        copyButton.addEventListener("click", async () => {

            try {

                await navigator.clipboard.writeText(botContent.textContent);

                copyButton.textContent = "✓ Tersalin";

            } catch (error) {

                console.error("Gagal menyalin:", error);

            }

        });

        const actions = document.createElement("div");

        actions.classList.add("message-actions");
        actions.appendChild(copyButton);

        botMessage.appendChild(actions);

    } catch (error) {

        console.error(error);

        botContent.textContent = error.message;

        // Tandai pesan error
        botContent.parentElement.classList.add("error-message");

    } finally {

        // Aktifkan kembali input
        userInput.disabled = false;

        button.disabled = false;

        button.textContent = "Kirim";

        // Aktifkan kembali tombol aksi
        chatBox.querySelectorAll(".message-actions button").forEach(action => {
            action.disabled = false;
        });

        userInput.focus();

    }

});
