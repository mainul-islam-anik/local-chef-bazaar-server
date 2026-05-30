const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { ObjectId, MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require("jsonwebtoken");

const app = express()
const port = process.env.PORT || 5000;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://local-chef-bazaar-958e3.web.app",
    "https://local-chef-bazaar-958e3.firebaseapp.com",
  ],
  credentials: true,
}));
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4di52mx.mongodb.net/localChef_db?retryWrites=true&w=majority&appName=Cluster0`;

// ✅ Global client — Vercel cold start fix
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 1, // ✅ Vercel এর জন্য 1 রাখুন
});

// ✅ Collections globally declare
const db = client.db('localChef_db');
const usersCollection = db.collection('users');
const mealsCollection = db.collection('meals');
const reviewsCollection = db.collection('reviews');
const ordersCollection = db.collection("orders");
const favoritesCollection = db.collection("favorites");
const requestsCollection = db.collection("requests");
const paymentsCollection = db.collection("payments");

// ✅ Connect একবার করুন
async function connectDB() {
  try {
    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
      console.log('MongoDB Connected ✅');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// ✅ প্রতিটা request এর আগে connect check করুন
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ===== JWT =====
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Unauthorized access" });
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req.decoded.email });
  if (user?.role !== "admin") return res.status(403).send({ message: "Forbidden" });
  next();
};

const verifyChef = async (req, res, next) => {
  const user = await usersCollection.findOne({ email: req.decoded.email });
  if (user?.role !== "chef") return res.status(403).send({ message: "Forbidden" });
  next();
};

// ===== ROUTES =====
app.get('/', (req, res) => res.send('LocalChefBazaar Server Running ✅'));

app.post("/jwt", (req, res) => {
  const token = jwt.sign(
    { email: req.body.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.send({ token });
});

// USERS
app.post("/users", async (req, res) => {
  try {
    const user = req.body;
    user.createdAt = new Date();
    const exists = await usersCollection.findOne({ email: user.email });
    if (exists) return res.send({ message: "User already exists" });
    res.send(await usersCollection.insertOne(user));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  try { res.send(await usersCollection.find().toArray()); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/users/:email", async (req, res) => {
  try { res.send(await usersCollection.findOne({ email: req.params.email })); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.patch("/users/fraud/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    res.send(await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: "fraud" } }
    ));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// MEALS
app.get('/daily-meals', async (req, res) => {
  try {
    res.send(await mealsCollection.find().sort({ createdAt: 1 }).limit(6).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/meals", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;
    const sort = req.query.sort;
    const search = req.query.search || "";

    let sortOption = {};
    if (sort === "asc") sortOption = { price: 1 };
    if (sort === "desc") sortOption = { price: -1 };

    let searchFilter = {};
    if (search.trim()) {
      searchFilter = {
        $or: [
          { foodName: { $regex: search.trim(), $options: "i" } },
          { chefName: { $regex: search.trim(), $options: "i" } },
        ],
      };
    }

    const total = await mealsCollection.countDocuments(searchFilter);
    const meals = await mealsCollection
      .find(searchFilter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();
    res.send({ meals, total });
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/meals/:id", async (req, res) => {
  try { res.send(await mealsCollection.findOne({ _id: new ObjectId(req.params.id) })); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.post("/meals", verifyToken, verifyChef, async (req, res) => {
  try { res.send(await mealsCollection.insertOne(req.body)); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/my-meals/:email", async (req, res) => {
  try {
    res.send(await mealsCollection.find({ userEmail: req.params.email }).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.delete("/meals/:id", async (req, res) => {
  try { res.send(await mealsCollection.deleteOne({ _id: new ObjectId(req.params.id) })); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.patch("/meals/:id", async (req, res) => {
  try {
    res.send(await mealsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    ));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// REVIEWS
app.get("/reviews", async (req, res) => {
  try {
    res.send(await reviewsCollection.find().sort({ date: 1 }).limit(6).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/reviews/:foodId", async (req, res) => {
  try {
    res.send(await reviewsCollection.find({ foodId: req.params.foodId }).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/my-reviews/:email", async (req, res) => {
  try {
    res.send(await reviewsCollection.find({ reviewerEmail: req.params.email }).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.post("/reviews", verifyToken, async (req, res) => {
  try { res.send(await reviewsCollection.insertOne(req.body)); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.patch("/reviews/:id", async (req, res) => {
  try {
    const { rating, comment } = req.body;
    res.send(await reviewsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { rating, comment } }
    ));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    res.send(await reviewsCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// ORDERS
app.post("/orders", verifyToken, async (req, res) => {
  try { res.send(await ordersCollection.insertOne(req.body)); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/orders/:email", verifyToken, async (req, res) => {
  try {
    if (req.decoded.email !== req.params.email) {
      return res.status(403).send({ message: "Forbidden" });
    }
    res.send(await ordersCollection.find({ userEmail: req.params.email }).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/chef-orders/:chefId", async (req, res) => {
  try {
    res.send(await ordersCollection.find({ chefId: req.params.chefId }).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.patch("/orders/update-status/:id", async (req, res) => {
  try {
    res.send(await ordersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { orderStatus: req.body.orderStatus } }
    ));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// FAVORITES
app.post("/favorites", verifyToken, async (req, res) => {
  try {
    const exists = await favoritesCollection.findOne({
      userEmail: req.body.userEmail,
      mealId: req.body.mealId,
    });
    if (exists) return res.send({ message: "Already in favorites" });
    res.send(await favoritesCollection.insertOne(req.body));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/favorites/:email", async (req, res) => {
  try {
    res.send(await favoritesCollection.find({ userEmail: req.params.email }).toArray());
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.delete("/favorites/:id", async (req, res) => {
  try {
    res.send(await favoritesCollection.deleteOne({ _id: new ObjectId(req.params.id) }));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// REQUESTS
app.post("/requests", async (req, res) => {
  try {
    const exists = await requestsCollection.findOne({
      userEmail: req.body.userEmail,
      requestStatus: "pending",
    });
    if (exists) return res.send({ message: "Already has pending request" });
    res.send(await requestsCollection.insertOne(req.body));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.get("/requests", verifyToken, verifyAdmin, async (req, res) => {
  try { res.send(await requestsCollection.find().toArray()); }
  catch (e) { res.status(500).send({ message: e.message }); }
});

app.patch("/requests/accept/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userEmail, requestType } = req.body;
    await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { requestStatus: "approved" } }
    );
    if (requestType === "chef") {
      const chefId = `chef-${Math.floor(1000 + Math.random() * 9000)}`;
      await usersCollection.updateOne(
        { email: userEmail },
        { $set: { role: "chef", chefId } }
      );
    } else if (requestType === "admin") {
      await usersCollection.updateOne(
        { email: userEmail },
        { $set: { role: "admin" } }
      );
    }
    res.send({ success: true });
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.patch("/requests/reject/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    res.send(await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { requestStatus: "rejected" } }
    ));
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// ADMIN STATISTICS
app.get("/admin/statistics", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();
    const totalOrders = await ordersCollection.countDocuments();
    const pendingOrders = await ordersCollection.countDocuments({ orderStatus: "pending" });
    const deliveredOrders = await ordersCollection.countDocuments({ orderStatus: "delivered" });
    const cancelledOrders = await ordersCollection.countDocuments({ orderStatus: "cancelled" });
    const acceptedOrders = await ordersCollection.countDocuments({ orderStatus: "accepted" });
    const payments = await ordersCollection.find({ paymentStatus: "paid" }).toArray();
    const totalPayment = payments.reduce((sum, o) => sum + o.price * o.quantity, 0);
    res.send({
      totalUsers, totalOrders, pendingOrders,
      deliveredOrders, cancelledOrders, acceptedOrders, totalPayment
    });
  } catch (e) { res.status(500).send({ message: e.message }); }
});

// PAYMENTS
app.post("/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(req.body.price * 100),
      currency: "usd",
      payment_method_types: ["card"],
    });
    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.post("/payments", verifyToken, async (req, res) => {
  try {
    const payment = req.body;
    const result = await paymentsCollection.insertOne(payment);
    await ordersCollection.updateOne(
      { _id: new ObjectId(payment.orderId) },
      { $set: { paymentStatus: "paid" } }
    );
    res.send(result);
  } catch (e) { res.status(500).send({ message: e.message }); }
});

app.listen(port, () => console.log(`Server running on port: ${port} 🚀`));