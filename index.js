// Permet l'accès aux variables d'environnement
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI);

// Connexion à l'espace de stockage cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const userRoutes = require("./routes/user");
const offerRoutes = require("./routes/offer");
const paymentRoutes = require("./routes/payment");
app.use(userRoutes);
app.use(offerRoutes);
app.use(paymentRoutes);

app.get("/", (req, res) => {
  res.json("Bienvenue sur l'API de Vinted");
});

const server = app.listen(process.env.PORT || 4000, () => {
  console.log("Server started");
});
server.timeout = Number(process.env.SERVER_TIMEOUT) || 1000000;
