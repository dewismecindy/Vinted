const express = require("express");
const router = express.Router();
const createStripe = require("stripe");
// const formidableMiddleware = require("express-formidable");
// router.use(formidableMiddleware());

/* Votre clé privée doit être indiquée ici */
const stripe = createStripe(process.env.STRIPE_API_SECRET);

// on réceptionne le token
router.post("/payment", async (req, res) => {
  console.log(req.body);
  try {
    // on envoie le token a Stripe avec le montant
    let { status } = await stripe.charges.create({
      amount: (req.body.amount * 100).toFixed(0),
      currency: "eur",
      description: `Paiement vinted pour : ${req.body.title}`,
      source: req.body.token,
    });
    // Le paiement a fonctionné
    // On peut mettre à jour la base de données
    // On renvoie une réponse au client pour afficher un message de statut
    res.json({ status });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
