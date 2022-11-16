// Import du package 'express'
const express = require("express");
// Appel à la fonction Router(), issue du package 'express'
const router = express.Router();

// Import du package cloudinary
const cloudinary = require("cloudinary").v2;

const fileUpload = require("express-fileupload");
const convertToBase64 = require("../utils/convertToBase64");

// Import du model User et Offer
// afin d'éviter des erreurs (notamment dues à d'eventuelles références entre les collections)
// nous vous conseillons d'importer tous vos models dans toutes vos routes
const User = require("../models/User");
const Offer = require("../models/Offer");

// Import du middleware isAuthenticated
const isAuthenticated = require("../middleware/isAuthenticated");

// Import des datas (ne pas en tenir compte, cela sert au reset de la BDD entre 2 sessions de formation)
const products = require("../data/products.json");

// Route qui nous permet de récupérer une liste d'annonces, en fonction de filtres
// Si aucun filtre n'est envoyé, cette route renverra l'ensemble des annonces
router.get("/offers", async (req, res) => {
  try {
    // création d'un objet dans lequel on va sotcker nos différents filtres
    let filters = {};

    if (req.query.title) {
      filters.product_name = new RegExp(req.query.title, "i");
    }

    if (req.query.priceMin) {
      filters.product_price = {
        $gte: req.query.priceMin,
      };
    }

    if (req.query.priceMax) {
      if (filters.product_price) {
        filters.product_price.$lte = req.query.priceMax;
      } else {
        filters.product_price = {
          $lte: req.query.priceMax,
        };
      }
    }

    let sort = {};

    if (req.query.sort === "price-desc") {
      sort = { product_price: -1 };
    } else if (req.query.sort === "price-asc") {
      sort = { product_price: 1 };
    }

    let page;
    if (Number(req.query.page) < 1) {
      page = 1;
    } else {
      page = Number(req.query.page);
    }

    let limit = Number(req.query.limit);

    const offers = await Offer.find(filters)
      .populate({
        path: "owner",
        select: "account",
      })
      .sort(sort)
      .skip((page - 1) * limit) // ignorer les x résultats
      .limit(limit); // renvoyer y résultats

    // cette ligne va nous retourner le nombre d'annonces trouvées en fonction des filtres
    const count = await Offer.countDocuments(filters);

    res.json({
      count: count,
      offers: offers,
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

// Route qui permmet de récupérer les informations d'une offre en fonction de son id
router.get("/offer/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id).populate({
      path: "owner",
      select: "account.username account.phone account.avatar",
    });
    res.json(offer);
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ message: error.message });
  }
});

router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    // route qui permet de poster une nouvelle annonce
    try {
      const { title, description, price, brand, size, condition, color, city } =
        req.body;
      console.log(req.headers);

      if (title && price && req.files?.picture) {
        // Création de la nouvelle annonce (sans l'image)
        const newOffer = new Offer({
          product_name: title,
          product_description: description,
          product_price: price,
          product_details: [
            { MARQUE: brand },
            { TAILLE: size },
            { ÉTAT: condition },
            { COULEUR: color },
            { EMPLACEMENT: city },
          ],
          owner: req.user,
        });

        // Vérifier le type de fichier
        if (
          Array.isArray(req.files.picture) === true ||
          req.files.picture.mimetype.slice(0, 5) !== "image"
        ) {
          res
            .status(400)
            .json({ message: "You must send a single image file !" });
        } else {
          // Envoi de l'image à cloudinary
          const result = await cloudinary.uploader.upload(
            convertToBase64(req.files.picture, "vinted_upload", {
              folder: `api/vinted-v2/offers/${newOffer._id}`,
              public_id: "preview",
              cloud_name: "lereacteur",
            })
          );

          // ajout de l'image dans newOffer
          newOffer.product_image = result;
          await newOffer.save();
          res.json(newOffer);
        }
      } else {
        res
          .status(400)
          .json({ message: "title, price and picture are required" });
      }
    } catch (error) {
      console.log(error.message);
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  "/offer/update/:id",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    const offerToModify = await Offer.findById(req.params.id);
    try {
      if (req.body.title) {
        offerToModify.product_name = req.body.title;
      }
      if (req.body.description) {
        offerToModify.product_description = req.body.description;
      }
      if (req.body.price) {
        offerToModify.product_price = req.body.price;
      }

      const details = offerToModify.product_details;
      for (i = 0; i < details.length; i++) {
        if (details[i].MARQUE) {
          if (req.body.brand) {
            details[i].MARQUE = req.body.brand;
          }
        }
        if (details[i].TAILLE) {
          if (req.body.size) {
            details[i].TAILLE = req.body.size;
          }
        }
        if (details[i].ÉTAT) {
          if (req.body.condition) {
            details[i].ÉTAT = req.body.condition;
          }
        }
        if (details[i].COULEUR) {
          if (req.body.color) {
            details[i].COULEUR = req.body.color;
          }
        }
        if (details[i].EMPLACEMENT) {
          if (req.body.location) {
            details[i].EMPLACEMENT = req.body.location;
          }
        }
      }
      // Dans son modèle product_details est décrite comme étant de type Array. Or on stocke à l'intérieur un tableau d'objet. Lorsque l'on modifie un élément qui n'est pas explicitement prévu dans le modèle, le .save() ne suffit pas à sauvegardr les mofications. On doit le notifier de la sorte avant la sauvegarde afin qu'elle soit bien prise en compte.
      offerToModify.markModified("product_details");

      if (req.files?.picture) {
        const result = await cloudinary.uploader.upload(
          convertToBase64(req.files.picture, {
            public_id: `api/vinted/offers/${offerToModify._id}/preview`,
          })
        );
        offerToModify.product_image = result;
      }

      await offerToModify.save();

      res.status(200).json("Offer modified succesfully !");
    } catch (error) {
      console.log(error.message);
      res.status(400).json({ error: error.message });
    }
  }
);

router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
  try {
    //Je supprime ce qui il y a dans le dossier
    await cloudinary.api.delete_resources_by_prefix(
      `api/vinted/offers/${req.params.id}`
    );
    //Une fois le dossier vide, je peux le supprimer !
    await cloudinary.api.delete_folder(`api/vinted/offers/${req.params.id}`);

    offerToDelete = await Offer.findById(req.params.id);

    await offerToDelete.delete();

    res.status(200).json("Offer deleted succesfully !");
  } catch (error) {
    console.log(error.message);
    res.status(400).json({ error: error.message });
  }
});

// CETTE ROUTE SERT AU RESET DE LA BDD ENTRE 2 SESSIONS DE FORMATION. CELA NE FAIT PAS PARTIE DE L'EXERCICE.
// RESET ET INITIALISATION BDD
router.get("/reset-offers", fileUpload(), async (req, res) => {
  const allUserId = await User.find().select("_id");
  // Il y a 21 users dans le fichier owners.json
  if (allUserId.length > 21) {
    return res
      .status(400)
      .send(
        "Il faut d'abord reset la BDD de users. Voir la route /reset-users"
      );
  } else {
    // Vider la collection Offer
    await Offer.deleteMany({});

    // Supprimer les images du dossier "api/vinted/offers" sur cloudinary
    try {
      await cloudinary.api.delete_resources_by_prefix("api/vinted-v2/offers");
    } catch (error) {
      console.log("deleteResources ===>  ", error.message);
    }

    // Créer les annonces à partir du fichier products.json
    for (let i = 0; i < products.length; i++) {
      try {
        // Création de la nouvelle annonce
        const newOffer = new Offer({
          product_name: products[i].product_name,
          product_description: products[i].product_description,
          product_price: products[i].product_price,
          product_details: products[i].product_details,
          // créer des ref aléatoires
          owner: allUserId[Math.floor(Math.random() * allUserId.length + 1)],
        });

        // Uploader l'image principale du produit

        const resultImage = await cloudinary.uploader.upload(
          products[i].product_image.secure_url,
          {
            folder: `api/vinted-v2/offers/${newOffer._id}`,
            public_id: "preview",
          }
        );

        // Uploader les images de chaque produit
        newProduct_pictures = [];
        for (let j = 0; j < products[i].product_pictures.length; j++) {
          try {
            const resultPictures = await cloudinary.uploader.upload(
              products[i].product_pictures[j].secure_url,
              {
                folder: `api/vinted-v2/offers/${newOffer._id}`,
              }
            );

            newProduct_pictures.push(resultPictures);
          } catch (error) {
            console.log("uploadCloudinaryError ===> ", error.message);
          }
        }

        newOffer.product_image = resultImage;
        newOffer.product_pictures = newProduct_pictures;

        await newOffer.save();
        console.log(`✅ offer saved : ${i + 1} / ${products.length}`);
      } catch (error) {
        console.log("newOffer error ===> ", error.message);
      }
    }
    res.send("Done !");
    console.log(`🍺 All offers saved !`);
  }
});

module.exports = router;
