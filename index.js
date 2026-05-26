const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { ObjectId } = require('mongodb');
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require("jsonwebtoken");
const app = express()
const port = process.env.PORT || 5000;
const admin = require("firebase-admin");


const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// Middleware
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true,
}));
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4di52mx.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});



// ✅ Collections গুলো run() এর বাইরে declare করো
// তাহলে middleware গুলো access করতে পারবে
const db = client.db('localChef_db');
const usersCollection = db.collection('users')
const mealsCollection = db.collection('meals')
const reviewsCollection = db.collection('reviews')
const ordersCollection = db.collection("orders");
const favoritesCollection = db.collection("favorites");
const requestsCollection = db.collection("requests");
const paymentsCollection = db.collection("payments");

// ===== JWT Middleware =====
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// ✅ Admin verify — এখন usersCollection access করতে পারবে
const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await usersCollection.findOne({ email });
  if (user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

// ✅ Chef verify — এখন usersCollection access করতে পারবে
const verifyChef = async (req, res, next) => {
  const email = req.decoded.email;
  const user = await usersCollection.findOne({ email });
  if (user?.role !== "chef") {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

app.get('/', (req, res) => {
  res.send('local chef bazaar server is running')
});

// ✅ JWT route — run() এর বাইরে
app.post("/jwt", (req, res) => {
  const { email } = req.body;
  const token = jwt.sign(
    { email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.send({ token });
});

async function run() {
  try {
    // await client.connect();
    console.log('Database Connected ✅')

    // =====USER API========
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.createdAt = new Date();
      const exists = await usersCollection.findOne({ email: user.email });
      if (exists) return res.send({ message: "User already exists" });
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // ===== MEALS =====
    app.get('/daily-meals', async (req, res) => {
      const cursor = mealsCollection.find().sort({ createdAt: 1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/meals", async (req, res) => {
      const limit = parseInt(req.query.limit) || 10;
      const skip = parseInt(req.query.skip) || 0;
      const sort = req.query.sort;
      let sortOption = {};
      if (sort === "asc") sortOption = { price: 1 };
      if (sort === "desc") sortOption = { price: -1 };
      const total = await mealsCollection.countDocuments();
      const meals = await mealsCollection
        .find()
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .toArray();
      res.send({ meals, total });
    });

    app.get("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // ✅ verifyChef এখন কাজ করবে
    app.post("/meals", verifyToken, verifyChef, async (req, res) => {
      const meal = req.body;
      const result = await mealsCollection.insertOne(meal);
      res.send(result);
    });

    app.get("/my-meals/:email", async (req, res) => {
      const email = req.params.email;
      const result = await mealsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    app.delete("/meals/:id", async (req, res) => {
      const id = req.params.id;
      const result = await mealsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

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
    app.get("/reviews", async (req, res) => {
      const cursor = reviewsCollection.find().sort({ date: 1 }).limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

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

    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const { rating, comment } = req.body;
      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { rating, comment } }
      );
      res.send(result);
    });

    app.post("/reviews", verifyToken, async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // ===== ORDERS =====
    app.post("/orders", verifyToken, async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const result = await ordersCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    app.get("/chef-orders/:chefId", async (req, res) => {
      const chefId = req.params.chefId;
      const result = await ordersCollection
        .find({ chefId: chefId })
        .toArray();
      res.send(result);
    });

    app.patch("/orders/update-status/:id", async (req, res) => {
      const id = req.params.id;
      const { orderStatus } = req.body;
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { orderStatus } }
      );
      res.send(result);
    });

    // ===== FAVORITES =====
    app.post("/favorites", verifyToken, async (req, res) => {
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
      const result = await favoritesCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    app.delete("/favorites/:id", async (req, res) => {
      const id = req.params.id;
      const result = await favoritesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // ===== REQUESTS =====
    app.post("/requests", async (req, res) => {
      const request = req.body;
      const exists = await requestsCollection.findOne({
        userEmail: request.userEmail,
        requestStatus: "pending",
      });
      if (exists) return res.send({ message: "Already has pending request" });
      const result = await requestsCollection.insertOne(request);
      res.send(result);
    });

    app.get("/requests", verifyToken, verifyAdmin, async (req, res) => {
      const result = await requestsCollection.find().toArray();
      res.send(result);
    });

    app.patch("/requests/accept/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { userEmail, requestType } = req.body;
      await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus: "approved" } }
      );
      if (requestType === "chef") {
        const chefId = `chef-${Math.floor(1000 + Math.random() * 9000)}`;
        await usersCollection.updateOne(
          { email: userEmail },
          { $set: { role: "chef", chefId: chefId } }
        );
      } else if (requestType === "admin") {
        await usersCollection.updateOne(
          { email: userEmail },
          { $set: { role: "admin" } }
        );
      }
      res.send({ success: true });
    });

    app.patch("/requests/reject/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus: "rejected" } }
      );
      res.send(result);
    });

    // ===== ADMIN =====
    app.patch("/users/fraud/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "fraud" } }
      );
      res.send(result);
    });

    app.get("/admin/statistics", verifyToken, verifyAdmin, async (req, res) => {
      const totalUsers = await usersCollection.countDocuments();
      const totalOrders = await ordersCollection.countDocuments();
      const pendingOrders = await ordersCollection.countDocuments({ orderStatus: "pending" });
      const deliveredOrders = await ordersCollection.countDocuments({ orderStatus: "delivered" });
      const cancelledOrders = await ordersCollection.countDocuments({ orderStatus: "cancelled" });
      const acceptedOrders = await ordersCollection.countDocuments({ orderStatus: "accepted" });
      const payments = await ordersCollection
        .find({ paymentStatus: "paid" })
        .toArray();
      const totalPayment = payments.reduce(
        (sum, order) => sum + order.price * order.quantity, 0
      );
      res.send({
        totalUsers,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        cancelledOrders,
        acceptedOrders,
        totalPayment,
      });
    });

    // ===== PAYMENTS =====
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const { price } = req.body;
      const amount = Math.round(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentsCollection.insertOne(payment);
      await ordersCollection.updateOne(
        { _id: new ObjectId(payment.orderId) },
        { $set: { paymentStatus: "paid" } }
      );
      res.send(paymentResult);
    });

    // await client.db("admin").command({ ping: 1 });
    // console.log("MongoDB Connected Successfully! ✅");
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port: ${port} 🚀`)
});