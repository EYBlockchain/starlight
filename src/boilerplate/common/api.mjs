import express from 'express';
import router from "./api_routes.mjs"; // import the routes

import Web3 from "./common/web3.mjs";
import { newNullifierReponseFunction } from "./common/nullifier-storage.mjs";


const app = express();

app.use(express.json());

app.use('/', router); //to use the routes

const web3 = Web3.connection();

function gracefulshutdown() {
    console.log("Shutting down");
    listener.close(() => {
        console.log("HTTP server closed.");      
        process.exit(0); 
    });
}

process.on("SIGTERM", gracefulshutdown);
process.on("SIGINT", gracefulshutdown);

const eventListener = new NewNullifierReponseFunction(web3);

// Listen for the custom event
eventListener.on('newNullifierEvent', eventData => {
    console.log('Custom event received:', eventData);
});

await eventListener.start();


const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
