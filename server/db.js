
const mongoose = require("mongoose");

module.exports = async () => {
    try {
        const connectionParams = {
           // useNewUrlParser: true,
           //useCreateIndex: true,
          // useUnifiedTopology: true,
        };
        const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/todo-app";
        await mongoose.connect(
            mongoURI,
            connectionParams
          );
        console.log("Connected to MongoDB successfully.");
    } catch (error) {
        console.log("Could not connect to database.", error);
    }
};
