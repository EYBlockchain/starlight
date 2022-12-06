import express from 'express';
import router from "./routes/app.mjs"; // import the routes

const app = express();

app.use(express.json());

app.use('/', router); //to use the routes

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
