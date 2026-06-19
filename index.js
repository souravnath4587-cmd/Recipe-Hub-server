const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_DATA_URI;
const authUri = process.env.MONGODB_AUTH_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const authClient = new MongoClient(authUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    await authClient.connect();

    const database = client.db("Recipe-Hub");
    const authDatabase = authClient.db("RecipeHub-Auth");

    const recipeCollection = database.collection("recipes");

    // recipes api related

    app.put("/api/myRecipes/:id", async (req, res) => {
      try {
        const id = req.params.id.trim();

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid ID format." });
        }

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            recipeName: req.body.recipeName,
            recipeImage: req.body.recipeImage,
            category: req.body.category,
            cuisineType: req.body.cuisineType,
            difficultyLevel: req.body.difficultyLevel,
            preparationTime: req.body.preparationTime,
            ingredients: req.body.ingredients,
            instructions: req.body.instructions,
          },
        };

        const result = await recipeCollection.updateOne(filter, updatedDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          error: "Server error encountered updating document entries",
        });
      }
    });

    app.get("/api/myRecipe/:id", async (req, res) => {
      try {
        const id = req.params.id.trim();
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalied..",
          });
        } else {
          const query = {
            _id: new ObjectId(id),
          };
          const result = await recipeCollection.findOne(query);
          res.send(result);
        }
      } catch (error) {
        res
          .status(500)
          .send({ error: "Failed to fetch recipes from database" });
      }
    });

    app.delete("/api/myRecipes/:id", async (req, res) => {
      try {
        const id = req.params.id.trim();
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalied..",
          });
        } else {
          const query = {
            _id: new ObjectId(id),
          };
          const result = await recipeCollection.deleteOne(query);
          res.send(result);
        }
      } catch (error) {
        res
          .status(500)
          .send({ error: "Failed to fetch recipes from database" });
      }
    });

    app.get("/api/myRecipes", async (req, res) => {
      try {
        const query = {};
        if (req.query.recipeCreatorId) {
          query.recipeCreatorId = req.query.recipeCreatorId;
        }

        // CRITICAL: Convert the cursor to an array
        const result = await recipeCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: "Failed to fetch recipes from database" });
      }
    });

    app.post("/api/recipes", async (req, res) => {
      const recipe = req.body;
      const result = await recipeCollection.insertOne(recipe);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Recipe Hub Server is Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
