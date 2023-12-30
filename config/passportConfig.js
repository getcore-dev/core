const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");

function initialize(passport, getUserByEmail, getUserById, getUserByUsername) {
  const authenticateUser = async (username, password, done) => {
    try {
      const user = await getUserByUsername(username);
      if (user == null) {
        return done(null, false, {
          message: "No user with that username exists",
        });
      }

      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Password incorrect" });
      }
    } catch (e) {
      console.error("Error in authentication:", e);
      return done(e);
    }
  };

  passport.use(
    new LocalStrategy({ usernameField: "username" }, authenticateUser)
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await getUserById(id);
      done(null, user);
    } catch (e) {
      console.error("Error in deserialization:", e);
      done(e, null);
    }
  });
}

module.exports = { initialize };
