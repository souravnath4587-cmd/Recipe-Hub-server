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
    const userCollection = authDatabase.collection("user");
    const reportCollection = database.collection("reports");

    // users related api
    app.get("/api/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.patch("/api/users/:id/status", async (req, res) => {
      const { id } = req.params;
      const newStatusValue = req.body.status;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await userCollection.updateOne(query, {
        $set: {
          status: newStatusValue,
        },
      });
      res.send(result);
    });

    // recipes api related

    app.post("/api/reports", async (req, res) => {
      const { recipeId, userId, reason, details } = req.body;

      // Validation
      if (!recipeId || !userId || !reason) {
        return res
          .status(400)
          .json({ error: "Missing required reporting fields." });
      }

      const validReasons = ["Spam", "Offensive Content", "Copyright Issue"];
      if (!validReasons.includes(reason)) {
        return res
          .status(400)
          .json({ error: "Invalid reporting reason classification." });
      }

      try {
        const reportDocument = {
          recipeId: new ObjectId(recipeId),
          userId: userId,
          reason: reason,
          details: details || "",
          createdAt: new Date(),
          status: "Pending Review", // Useful for your admin dashboard later
        };

        const result = await reportCollection.insertOne(reportDocument);

        res.status(201).json({
          success: true,
          message: "Report logged successfully into administration pipelines.",
          reportId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch("/api/recipes/:id/favourite", async (req, res) => {
      const { id } = req.params;
      const { userId } = req.body;
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Unauthorized access token missing." });
      }
      try {
        const query = {
          _id: new ObjectId(id),
        };
        const recipe = await recipeCollection.findOne(query);
        if (!recipe) {
          return res.status(404).json({ error: "Recipe not found." });
        }
        const favourite = recipe.favourite || [];
        const isAlreadyFavourite = favourite.includes(userId);
        let updateOperator;
        if (isAlreadyFavourite) {
          updateOperator = { $pull: { favourite: userId } };
        } else {
          updateOperator = {
            $addToSet: {
              favourite: userId,
            },
          };
        }

        await recipeCollection.updateOne(query, updateOperator);
        const updateRecipe = await recipeCollection.findOne(query);
        const favouriteArray = updateRecipe.favourite || [];
        const absoluteCountAsNumber = favouriteArray.length; // Raw standard number

        // 3. Store that definitive numerical length directly back into your field
        await recipeCollection.updateOne(query, {
          $set: { favouritesCount: absoluteCountAsNumber },
        });
        res.status(200).json({
          success: true,
          favoritesCount: favouriteArray.length,
          isFavourited: favouriteArray.includes(userId),
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.patch("/api/recipes/:id/vote", async (req, res) => {
      const { id } = req.params;
      const { direction } = req.body; // Expects a string payload: "up" or "down"

      try {
        const query = { _id: new ObjectId(id) };

        // Set modifier mathematically based on direction value
        let mathematicalModifier = 0;
        if (direction === "up") mathematicalModifier = 1;
        if (direction === "down") mathematicalModifier = -1;

        // Apply change natively inside your existing recipes document
        const result = await recipeCollection.updateOne(query, {
          $inc: {
            likesCount: mathematicalModifier, // Positive increments, negative decrements
          },
        });

        // Fetch the updated value to return to the UI
        const updatedRecipe = await recipeCollection.findOne(query);

        res.status(200).json({
          success: true,
          likesCount: updatedRecipe.likesCount || 0,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/allRecipes", async (req, res) => {
      const result = await recipeCollection.find().toArray();
      res.send(result);
    });

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
