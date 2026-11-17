const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.redirect("/index.html");
});

app.post("/api/chat", async (req, res) => {
    console.log("Request masuk ke Express!");


app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});