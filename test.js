const request = require("supertest");
const app = require("./index");
const expect = require("chai").expect;

describe("GET /api/getUsername/:id", function () {
  it("should return the correct username for a given id", function (done) {
    this.timeout(5000); // Increase timeout to 5000ms
    request(app)
      .get("/api/getUsername/1703744211631")
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);
        expect(res.body).to.be.an("object");
        expect(res.body.username).to.equal("test");
        done();
      });
  });
});

describe("Database Function findByUsername", function () {
  it("should return user data for a valid username", async function () {
    const username = "test";
    const user = await findByUsername(username);
    expect(user).to.be.an("object");
    expect(user.username).to.equal(username);
  });
});

describe("POST /login", function () {
  it("should redirect to the home page on successful login", function (done) {
    request(app)
      .post("/login")
      .send({
        username: "test",
        password: "test",
      })
      .expect(302)
      .expect("Location", "/")
      .end(done);
  });

  it("should redirect back to the login page on failed login", function (done) {
    request(app)
      .post("/login")
      .send({
        username: "wrong",
        password: "wrong",
      })
      .expect(302)
      .expect("Location", "/login")
      .end(done);
  });
});

describe("GET /post/create", function () {
  it("should redirect to login if not authenticated", function (done) {
    request(app)
      .get("/post/create") // Replace with a valid protected route
      .expect(302)
      .expect("Location", "/login")
      .end(done);
  });
});

describe("POST /posts", function () {
  it("should create a new post and redirect", function (done) {
    request(app)
      .post("/posts")
      .send({
        user_id: "1703744211631",
        title: "Test Post",
        content: "Test Content",
      }) // Replace with valid data
      .expect(302) // Assuming redirection after post creation
      .end(done);
  });
});

module.exports = app;
