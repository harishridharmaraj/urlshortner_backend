import express from "express";
import * as dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import bcrypt from "bcryptjs";
import UserModel from "./modals/usermodel.js";
import nodemailer from "nodemailer";
import randomstring from "randomstring";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { auth } from "./middleware/auth.js";

const app = express();
app.use(cors({ credentials: true }));
dotenv.config();
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

const MONGO_URL = process.env.MONGO_URL;
const mailpass = process.env.mailpass;
const secret = process.env.secret_key;

const tokentiming = new Date();
tokentiming.setMinutes(tokentiming.getMinutes() + 5);
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
    user: "personal@harisworkspace.com",
    pass: mailpass,
  },
});

app.post("/createusers", async (req, res) => {
  const { email, password } = req.body;
  try {
    const activationToken = randomstring.generate(32);
    console.log(activationToken);
    const salt = await bcrypt.genSalt(10);
    const hashedpassword = await bcrypt.hash(password, salt);

    const users = await UserModel.create({
      ...req.body,
      accounttoken: activationToken,
      password: hashedpassword,
      refreshToken: null,
    });
    res.send("User Created");
    const activationmail = `Welcome to UrlShortner<br/>

    To activate your account, please <a href='http://localhost:4000/account/${activationToken}'>click here</a><br/>
    
    If you did not make this request and are concerned about the security of your account, Kindly ignore this mail.
    <br/>
    Best Regards,<br/>
    Guvi Tasks`;

    const info = await transporter.sendMail({
      from: "harisworkspace <personal@harisworkspace.com>",
      to: email,
      subject: "Account Activation✌️",
      html: activationmail,
    });
    console.log("Message sent:" + info.messageId);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
app.put("/forgetpass", async (req, res) => {
  const { email } = req.body;
  const resetToken = randomstring.generate(32);
  try {
    await UserModel.findOneAndUpdate(
      {
        email: email,
      },
      { passwordtoken: resetToken, tokenexpiry: tokentiming }
    );
    res.send("Password Token Updated");
    const resetmail = `We received your request to change your account password.<br/>
  
    To reset your password please <a href='http://localhost:3000/reset/${resetToken}'>click here</a><br/>
    
    If you did not make this request and are concerned about the security of your account, Kindly ignore this mail.
    <br/>
    Best Regards,<br/>
    Guvi Tasks`;

    await transporter.sendMail({
      from: "harisworkspace <personal@harisworkspace.com>",
      to: email,
      subject: "Password Reset - UrlShortner✌️",
      html: resetmail,
    });
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
app.put("/createpass/:token", async (req, res) => {
  const { pass } = req.body;
  const { token } = req.params;
  const users = await UserModel.find({
    passwordtoken: token,
  });
  if (users) {
    const updatepass = await UserModel.findOneAndUpdate(
      { passwordtoken: token, tokenexpiry: { $lte: new Date() } },
      { password: pass, $unset: { passwordtoken: 1, tokenexpiry: 1 } }
    );
    if (updatepass) {
      res.send("Password changed successfully");
    } else {
      res.status(500).send("Error updating password");
    }
  } else {
    res.send("User not found");
    console.log("User not found");
  }
});
app.get("/account/:verification", async (req, res) => {
  const { verification } = req.params;
  const users = await UserModel.find({ accounttoken: verification });
  if (users) {
    const accverify = await UserModel.findOneAndUpdate(
      { accounttoken: verification },
      { account: true, $unset: { accounttoken: 1 } }
    );
    if (accverify) {
      res.redirect("http://localhost:3000/login");
    } else {
      res.status(500).send("Error Verifying Account");
    }
  } else {
    res.send("User not found");
    console.log("User not found");
  }
});

app.get("/", (req, res) => {
  res.send("Hiii");
});
//Login Route
app.post("/login", async (req, res) => {
  const { email, pass } = req.body;
  const user = await UserModel.findOne({ email: email });

  if (user) {
    const passMatch = await bcrypt.compare(pass, user.password);

    if (passMatch) {
      console.log("user: ", user);
      const usertoken = jwt.sign(
        { email: user.email, id: user._id },
        process.env.secret_key,
        { expiresIn: "1h" }
      );
      res.json(usertoken);
    } else {
      res.status(404).json({
        error: "Invalid Credentials",
      });
    }
  } else {
    res.status(500).json({ error: "Invalid Credentials" });
  }
});

// Dashboard Route
app.get("/dashboard", auth, async (req, res) => {
  const email = req.email;
  try {
    const user = await UserModel.findOne({ email: email });

    if (user) {
      const totalClicks = user.urls.reduce(
        (acc, url) => acc + url.clickCount,
        0
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const convertedToday = user.urls.filter(
        (url) => url.createdAt >= today
      ).length;

      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const convertedThisMonth = user.urls.filter(
        (url) => url.createdAt >= thisMonthStart
      ).length;

      res.json({
        user,
        totalClicks,
        convertedToday,
        convertedThisMonth,
        urls: user.urls,
      });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/shortner", auth, async (req, res) => {
  const email = req.email;
  const user = await UserModel.find({ email: email });
  res.json(user);
});
app.get("/analytics", auth, async (req, res) => {
  const email = req.email;
  const user = await UserModel.find({ email: email });
  res.json(user);
});
app.get("/a/:shorturl", async (req, res) => {
  const { shorturl } = req.params;
  console.log(shorturl);
  try {
    const user = await UserModel.findOne({ "urls.shorturl": shorturl });

    if (user) {
      const urlObject = user.urls.find((url) => url.shorturl === shorturl);
      console.log("nnn:", urlObject);
      if (urlObject) {
        urlObject.clickCount += 1;
        await user.save();

        res.status(200).redirect(urlObject.originalurl);
      } else {
        res.status(404).json({ error: "Short URL not found" });
      }
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/urls", async (req, res) => {
  const { originalUrl, shorturl, email } = req.body;

  try {
    const user = await UserModel.findOne({ email: email });

    if (user) {
      user.urls.push({
        originalurl: originalUrl,
        shorturl: shorturl,
        clickCount: 0,
        createdAt: new Date(),
      });

      await user.save();

      res.status(200).json({ message: "URL saved successfully" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(4000, () => {
  console.log("Server is running on Port 4000");
});
mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MONGO DB is Connected");
  })
  .catch((error) => {
    console.log("Mongo Connection Error", error);
  });
