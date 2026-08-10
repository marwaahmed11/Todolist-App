
const mongoose = require("mongoose");

module.exports = async () => {
    try {
        const connectionParams = {
           // useNewUrlParser: true,
           //useCreateIndex: true,
          // useUnifiedTopology: true,
        };
        await mongoose.connect(
            //mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.2

            // "mongodb://mongodb:mongodb@"+process.env.ENV_PORT+":27017/mongodb?directConnection=true&serverSelectionTimeoutMS=2000",
             //  "mongodb://127.0.0.1:27017/todo-app",  // to run mongodb in local machine
            //"mongodb://<db-container-name if they are in the same network>:27017/todo-app",
            "mongodb://mongodb:27017/todo-app",
           
              connectionParams
          );
        console.log("Connected to MongoDB successfully.");
    } catch (error) {
        console.log("Could not connect to database.", error);
    }
};
