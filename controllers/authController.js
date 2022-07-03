const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios").default;
const engine = require("ejs-mate");
const URL = require("url").URL;

let refreshTokens = [];
const alloweOrigin = {
  "http://localhost:3020": true,
  "http://localhost:3030": true,
  "http://localhost:8000": true,
  "http://localhost:3080": false,
};

const authController = {
  doLogin: async (req, res) => {
    try {
      const user = await User.findOne({ username: req.body.username });
      if (!user) {
        res.status(404).json("Wrong username!");
      }
      const validPassword = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (!validPassword) {
        res.status(404).json("Wrong password!");
      }
      const { serviceURL } = req.query;
      console.log("da dung tk mk");
      if (user && validPassword) {
        const accessToken = authController.generateAccessToken(user);
        const refreshToken = authController.generateRefreshToken(user);
        refreshTokens.push(accessToken);
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          path: "/",
          sameSite: "strict",
          secure: false,
        });
        const { password, ...others } = user._doc;
        let originService = "";
        Object.keys(alloweOrigin).forEach((url) => {
          if (serviceURL.includes(url)) {
            originService = url;
          }
        });

        let ress = await axios.post(`${originService}/simplesso/receiveToken`, {
          ...others,
          accessToken,
        });
      }

      return res.redirect(`${serviceURL}`);
    } catch (err) {
      res.status(500).json(err);
    }
  },
  ssoLogin: async (req, res) => {
    const { serviceURL } = req.query;
    if (serviceURL != null) {
      const url = new URL(serviceURL);
      if (alloweOrigin[url.origin] !== true) {
        return res
          .status(400)
          .json({ message: "Your are not allowed to access the sso-server" });
      }
    }
    return res.render("login", {
      title: "SSO-Server | Login",
    });
  },
  //REGISTER
  registerUser: async (req, res) => {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(req.body.password, salt);

      // Create new user
      const newUser = await new User({
        username: req.body.username,
        email: req.body.email,
        password: hashed,
      });

      // Save to DB
      const user = await newUser.save();
      res.status(200).json(user);
    } catch (err) {
      res.status(500).json(err);
    }
  },

  //GENERATE ACCESS TOKEN
  generateAccessToken: (user) => {
    return jwt.sign(
      {
        id: user.id,
        admin: user.admin,
      },
      process.env.JWT_ACCESS_KEY,
      { expiresIn: "2h" }
    );
  },
  //GENERATE REFRESH TOKEN
  generateRefreshToken: (user) => {
    return jwt.sign(
      {
        id: user.id,
        admin: user.admin,
      },
      process.env.JWT_REFRESH_KEY,
      { expiresIn: "365d" }
    );
  },
  //LOGIN
  loginUser: async (req, res) => {
    try {
      const user = await User.findOne({ username: req.body.username });
      if (!user) {
        res.status(404).json("Wrong username!");
      }
      const validPassword = await bcrypt.compare(
        req.body.password,
        user.password
      );
      if (!validPassword) {
        res.status(404).json("Wrong password!");
      }
      if (user && validPassword) {
        const accessToken = authController.generateAccessToken(user);
        const refreshToken = authController.generateRefreshToken(user);
        refreshTokens.push(accessToken);
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          path: "/",
          sameSite: "strict",
          secure: false,
        });
        const { password, ...others } = user._doc;
        res.status(200).json({ ...others, accessToken });
      }
    } catch (err) {
      res.status(500).json(err);
    }
  },
  requestRefreshToken: async (req, res) => {
    //Take refresh token from user
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json("You're not authenticated");
    if (!refreshToken.includes(refreshToken)) {
      return res.status(403).json("Refresh token is not valid");
    }
    jwt.verify(refreshToken, process.env.JWT_REFRESH_KEY, (err, user) => {
      if (err) {
        console.log(err);
      }
      refreshTokens = refreshTokens.filter((token) => token !== refreshToken);
      //Create new accessToken, refreshToken
      const newAccessToken = authController.generateAccessToken(user);
      const newRefreshToken = authController.generateRefreshToken(user);
      refreshTokens.push(newAccessToken);
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        path: "/",
        sameSite: "strict",
        secure: false,
      });
      res.status(200).json({ accessToken: newAccessToken });
    });
  },
  userLogout: async (req, res) => {
    res.clearCookie("refreshToken");
    refreshTokens = refreshTokens.filter(
      (token) => token !== req.cookies.refreshToken
    );
    res.status(200).json("Logged out successfully");
  },
};

module.exports = authController;
