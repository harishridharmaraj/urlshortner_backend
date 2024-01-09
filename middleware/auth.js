//custom middleware

import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
dotenv.config();
export const auth = (req, res, next) => {
  try {
    const token = req.header("x-auth-token");
    const jwts = jwt.verify(token, process.env.secret_key);
    console.log(jwts);
    req.email = jwts.email;
    next();
  } catch (err) {
    res.send({ error: err.message });
  }
};
