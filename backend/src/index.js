// src/index.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'ASINOCRPROY' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API ASINOCRPROY escuchando en el puerto ${PORT}`);
});
