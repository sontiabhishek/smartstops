const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const pitstopsRoute = require('./routes/pitstops');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/pitstops', pitstopsRoute);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartstops')
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
