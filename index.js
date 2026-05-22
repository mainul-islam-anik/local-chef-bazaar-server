const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { ObjectId } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;




// middlewere
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4di52mx.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


app.get('/', (req, res) =>{
    res.send('local chef bazaar server is running')
})


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    console.log('database Connected')
    // Send a ping to confirm a successful connection

    const db = client.db('localChef_db');
    const usersCollection = db.collection('users')
    const mealsCollection = db.collection('meals')
    const reviewsCollection = db.collection('reviews')
    const ordersCollection = db.collection("orders");
    const favoritesCollection = db.collection("favorites");
    const requestsCollection = db.collection("requests");

   




    // reviews api


    // =====USER API========

      // user post api
      app.post("/users", async (req, res) => {
      const user = req.body;
      user.createdAt = new Date();
      const exists = await usersCollection.findOne({ email: user.email });
      if (exists) return res.send({ message: "User already exists" });
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // সব users পাওয়া (admin only)
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // একজন user এর info পাওয়া (email দিয়ে)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // ===== MEALS =====
    // সব meals পাওয়া
    app.get('/daily-meals', async (req, res) => {
            const cursor = mealsCollection.find().sort({ createdAt: 1 }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
    })


    app.get("/meals", async (req, res) => {
            const limit = parseInt(req.query.limit) || 10;
            const skip = parseInt(req.query.skip) || 0;
            const sort = req.query.sort;

            let sortOption = {};
            if (sort === "asc") sortOption = { price: 1 };
            if (sort === "desc") sortOption = { price: -1 };

            const total = await mealsCollection.countDocuments();
            const meals = await mealsCollection.find().sort(sortOption).skip(skip).limit(limit).toArray();

            res.send({ meals, total });
    });

    // একটি meal এর details
    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Meal তৈরি করা (chef)
    app.post("/meals", async (req, res) => {
      const meal = req.body;
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });

    // Chef এর meals পাওয়া
    app.get("/my-meals/:email", async (req, res) => {
      const email = req.params.email;
      const result = await mealsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    // Meal delete
    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Meal update
    app.patch("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const result = await mealsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData }
      );
      res.send(result);
    });

    // ===== REVIEWS =====
    // সব reviews পাওয়া (home page এ দেখাবে)
    app.get("/reviews", async (req, res) => {
        const cursor = reviewsCollection.find().sort({ date: 1 }).limit(6)
        const result = await cursor.toArray();
        res.send(result);
    });

    // একটি meal এর reviews
    app.get("/reviews/:foodId", async (req, res) => {
      const foodId = req.params.foodId;
      const result = await reviewsCollection.find({ foodId }).toArray();
      res.send(result);
    });

    app.get("/my-reviews/:email", async (req, res) => {
  const email = req.params.email;
  const result = await reviewsCollection
    .find({ reviewerEmail: email })
    .toArray();
  res.send(result);
});

    // Review delete
    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // Review update
    app.patch("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const { rating, comment } = req.body;
      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { rating, comment } }
      );
      res.send(result);
    })

    // Review submit করা
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // ===== ORDERS =====
    // Order place করা
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    // User এর orders পাওয়া
    app.get("/orders/:email", async (req, res) => {
      const email = req.params.email;
      const result = await ordersCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // ===== FAVORITES =====
    app.post("/favorites", async (req, res) => {
      const fav = req.body;
      const exists = await favoritesCollection.findOne({
        userEmail: fav.userEmail,
        mealId: fav.mealId,
      });
      if (exists) return res.send({ message: "Already in favorites" });
      const result = await favoritesCollection.insertOne(fav);
      res.send(result);
    });

    app.get("/favorites/:email", async (req, res) => {
      const email = req.params.email;
      const result = await favoritesCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    app.delete("/favorites/:id", async (req, res) => {
      const id = req.params.id;
      const result = await favoritesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

 

    

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, ()=>{
    console.log(`local chef bazzar server is running on port : ${port}`)
})