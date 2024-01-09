import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    fname: { type: String, required: true },
    lname: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    passwordtoken: String,
    tokenexpiry: Date,
    account: Boolean,
    accounttoken: String,
    refreshToken: String,
    jwtSecret: String,
    urls: [
      {
        originalurl: String,
        shorturl: { type: String, default: 0 },
        clickCount: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

const UserModel = model("User", UserSchema);

export default UserModel;
