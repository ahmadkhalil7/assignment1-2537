
require("dotenv").config();        
const express = require('express');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');

const MongoStore = require('connect-mongo').default;
const { MongoClient } = require('mongodb');

const Joi = require('joi');



const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;

const mongoUrl = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;

const client = new MongoClient(mongoUrl);
let userCollection;

// Connecting our database with the help of asycn function and await to make sure that the connection is established before we start using the database.
async function connectDB() {
    await client.connect();
    const db = client.db(mongodb_database);
    userCollection = db.collection("users");
}
// now lets run our fuction to connect to the database
connectDB();


// Part1: Setting up the loaction for session and and where to save it mongoDB
var mongoStore = MongoStore.create({
    mongoUrl: mongoUrl,      // use THIS MongoDB
    crypto: {
        secret: mongodb_session_secret // encrypt it
    }
});
app.use(express.urlencoded({ extended: false }));

app.use(express.static(__dirname + "/public"));


// Part2: Setting up the session for our app
app.use(session({
    store: mongoStore,
    secret: node_session_secret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }

}));



// Todo 2 If user not logged in show 
   // 2.1:sing up button 
   // 2.2:log in button 
// else if user is logged in show
    // 2.3:Hello username 
    //2.4:goto memebers area button
    //2.5:log out button 


    // mistake done forgot to put it inside the route
app.get("/", (req,res)=>{
    // Log in user 
    if (req.session.authenticated){
        res.send(`<h1>Hello ${req.session.username}</h1>
            <a href="/members">Go to members area</a>
            <a href="/logout">Log out</a> `);
    } else {
        // 2.1 and 2.2 
        res.send (`<h1>Not logged in </h1>
            <a href="/signup">Sign up</a>
            <a href="/login">Log in</a> `);
    }
});



// Sign Up route
app.get("/signup", (req,res) => {
    res.send (` <h1> Sign Up</h1>
            <form method="post" action="/signupSubmit">
            <input name="name" type="text" placeholder="Name"> <br>
            <input name="email" type="email" placeholder="Email"> <br>
            <input name="password" type="password" placeholder="Password"> <br>
            <button type="submit">Submit</button>
          
       
    </form> 
        
        `);
    });



    // Get the data from the form 
    //validate with joi 
    // hash pashword with bcrupt 
    // Save to mongdb
    // create sesseion and redirect to memebers 


    app.post("/signupSubmit", async (req,res) => {
         let name=req.body.name;
         let email=req.body.email;
         let password=req.body.password;
    
    
        // validate with joi
        const schema = Joi.object({
    name: Joi.string().alphanum().max(20).required(),
    email: Joi.string().email().required(),
    password: Joi.string().max(20).required()
});

const validationResult = schema.validate({ name, email, password });

if (validationResult.error != null) {
    res.send(`
        <p>${validationResult.error.message}</p>
        <a href="/signup">Try again</a>
    `);
    return;
}



// hash pashword with bcrupt
const hashedPassword = await bcrypt.hash(password, 12);



// Save to mongdb
await userCollection.insertOne({
    name: name,
    email: email,
    password: hashedPassword
}); 


// now create sesseion and redirect to memebers
req.session.authenticated = true;
req.session.username = name;
req.session.email = email;
res.redirect("/members");


    });




// Now lets create the login route
app.get("/login", (req, res) => {
    res.send(`
        <h1>Log In</h1>
        <form method="post" action="/loginSubmit">
            <input name="email" type="email" placeholder="Email"><br>
            <input name="password" type="password" placeholder="Password"><br>
            <button>Submit</button>
        </form>
    `);
});

app.post("/loginSubmit", async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().max(20).required()
    });

    const validationResult = schema.validate({ email, password });
    if (validationResult.error != null) {
        res.send(`<p>Invalid input</p><a href="/login">Try again</a>`);
        return;
    }

    let user = await userCollection.findOne({ email: email });
    if (!user) {
        res.send(`<p>User not found</p><a href="/login">Try again</a>`);
        return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        res.send(`<p>Wrong password</p><a href="/login">Try again</a>`);
        return;
    }

    req.session.authenticated = true;
    req.session.username = user.name;
    req.session.email = email;
    res.redirect("/members");
});

// MEMBERS PAGE
app.get("/members", (req, res) => {
    if (!req.session.authenticated) {
        res.redirect("/");
        return;
    }

    const images = ["cat1.jpg", "cat2.jpg", "cat3.jpg"];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    res.send(`
        <h1>Hello ${req.session.username}!</h1>
        <img src="/${randomImage}" width="300px"><br>
        <a href="/logout">Sign Out</a>
    `);
});

// LOGOUT
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// So the last page will be 404
app.use((req, res) => {
    res.status(404);
    res.send("Page not found - 404");
});

// START SERVER
app.listen(3000, () => {
    console.log("Server running on port 3000!");
});



// zaynrashidkhalil_db_user
// G79bzbWXWOsezLop


