require("dotenv").config();        
const express = require('express');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');

const MongoStore = require('connect-mongo').default;
const { MongoClient } = require('mongodb');

const Joi = require('joi');


// environment variables from .env
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;


// make mongo url from parts above
const mongoUrl = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;

const client = new MongoClient(mongoUrl);
let userCollection;


// Telling express to use EJS now for assignment 2
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname + "/public"));


// Connecting our database with async/await
// want to make sure db is connected before app fully starts
async function connectDB() {
    // Testing connection to db
    console.log("Connecting to database...");
    await client.connect();
    const db = client.db(mongodb_database);
    userCollection = db.collection("users");
}


// small helper function
function isValidSession(req) {
    return req.session && req.session.user;
}


// middleware 1
// if no valid session then go to login
function sessionValidation(req, res, next) {
    if (!isValidSession(req)) {
        res.redirect("/login");
        return;
    }
    next();
}


// middleware 2
// check if logged in AND is admin
function adminAuthorization(req, res, next) {
    if (!isValidSession(req)) {
        res.redirect("/login");
        return;
    }

    if (req.session.user.user_type !== "admin") {
        res.status(403);
        res.render("403", {
            title: "403",
            user: req.session.user,
            error: "You are not authorized to view this page."
        });
        return;
    }

    next();
}


// wrapping startup in async function because I need db first
async function startServer() {
//testing
    console.log("Starting server...");

    await connectDB();
    console.log("Database connected.");
    // Part1: Setting up where session is stored
    var mongoStore = MongoStore.create({
        mongoUrl: mongoUrl,
        crypto: {
            secret: mongodb_session_secret
        }
    });
     // testing
     console.log("Mongo store for sessions set up.");
    // Part2: Setting up the session for our app
    app.use(session({
        store: mongoStore,
        secret: node_session_secret,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 60 * 60 * 1000 } // 1 hour as required
    }));
 //testing
 console.log("Session middleware set up.");

    // HOME PAGE
    // If user not logged in show signup/login
    // else show hello + members + logout
    app.get("/", (req, res) => {
        res.render("index", {
            title: "Home",
            user: req.session.user || null
        });
    });


    // Sign Up route
    app.get("/signup", (req, res) => {
        res.render("signup", {
            title: "Sign Up",
            user: req.session.user || null,
            error: null
        });
    });


    // Get the data from the form
    // validate with joi
    // hash password with bcrypt
    // save to mongodb
    // create session and redirect to members
    app.post("/signup", async (req, res) => {
        let name = req.body.name;
        let email = req.body.email;
        let password = req.body.password;

        // validate with joi
        const schema = Joi.object({
            name: Joi.string().alphanum().max(20).required(),
            email: Joi.string().email().required(),
            password: Joi.string().max(20).required()
        });

        const validationResult = schema.validate({ name, email, password });

        if (validationResult.error != null) {
            res.render("signup", {
                title: "Sign Up",
                user: null,
                error: validationResult.error.message
            });
            return;
        }

        // checking if email already exists because otherwise duplicate users happen
        let existingUser = await userCollection.findOne({ email: email });
        if (existingUser) {
            res.render("signup", {
                title: "Sign Up",
                user: null,
                error: "A user with that email already exists."
            });
            return;
        }

        // hash password with bcrypt
        const hashedPassword = await bcrypt.hash(password, 12);

        // Save to mongodb
        // new field user_type added for assignment 2
        await userCollection.insertOne({
            name: name,
            email: email,
            password: hashedPassword,
            user_type: "user"
        });

        // now create session and redirect to members
        req.session.user = {
            name: name,
            email: email,
            user_type: "user"
        };

        res.redirect("/members");
    });


    // Log in route
    app.get("/login", (req, res) => {
        res.render("login", {
            title: "Log In",
            user: req.session.user || null,
            error: null
        });
    });


    app.post("/login", async (req, res) => {
        let email = req.body.email;
        let password = req.body.password;

        const schema = Joi.object({
            email: Joi.string().email().required(),
            password: Joi.string().max(20).required()
        });

        const validationResult = schema.validate({ email, password });

        if (validationResult.error != null) {
            res.render("login", {
                title: "Log In",
                user: null,
                error: "Invalid input."
            });
            return;
        }

        let user = await userCollection.findOne({ email: email });

        if (!user) {
            res.render("login", {
                title: "Log In",
                user: null,
                error: "User and password not found."
            });
            return;
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            res.render("login", {
                title: "Log In",
                user: null,
                error: "User and password not found."
            });
            return;
        }

        // storing all useful stuff in session
        req.session.user = {
            name: user.name,
            email: user.email,
            user_type: user.user_type || "user" // fallback just in case old users don't have this field
        };

        res.redirect("/members");
    });


    // MEMBERS PAGE
    // A2 changed this from random image to 3 image responsive grid
    app.get("/members", sessionValidation, (req, res) => {
        const images = ["cat1.jpg", "cat2.jpg", "cat3.jpg"];

        res.render("members", {
            title: "Members",
            user: req.session.user,
            images: images
        });
    });


    // ADMIN PAGE
    // if not logged in -> login page
    // if logged in but not admin -> 403
    // if admin -> show list of all users
    app.get("/admin", adminAuthorization, async (req, res) => {
        let users = await userCollection.find({}).toArray();

        res.render("admin", {
            title: "Admin",
            user: req.session.user,
            users: users
        });
    });


    // Promote user to admin
    app.get("/admin/promote", adminAuthorization, async (req, res) => {
        let email = req.query.email;

        const schema = Joi.object({
            email: Joi.string().email().required()
        });

        const validationResult = schema.validate({ email });

        if (validationResult.error != null) {
            res.status(400).send("Invalid email.");
            return;
        }

        await userCollection.updateOne(
            { email: email },
            { $set: { user_type: "admin" } }
        );

        res.redirect("/admin");
    });


    // Demote user back to normal user
    app.get("/admin/demote", adminAuthorization, async (req, res) => {
        let email = req.query.email;

        const schema = Joi.object({
            email: Joi.string().email().required()
        });

        const validationResult = schema.validate({ email });

        if (validationResult.error != null) {
            res.status(400).send("Invalid email.");
            return;
        }

        await userCollection.updateOne(
            { email: email },
            { $set: { user_type: "user" } }
        );

        res.redirect("/admin");
    });


    // LOGOUT
    app.get("/logout", (req, res) => {
        req.session.destroy(() => {
            res.redirect("/");
        });
    });


    // 404 PAGE
    app.use((req, res) => {
        res.status(404);
        res.render("404", {
            title: "404",
            user: req.session.user || null
        });
    });


    // START SERVER
    // using render port if available, otherwise localhost 3000
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// call the async function to actually start everything
startServer().catch((err) => {
    console.log("Startup error:", err);
});
// 