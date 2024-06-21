import express from 'express';
import router from "./api_routes.mjs"; // import the routes
import Web3 from './common/web3.mjs'
import { EncryptedDataEventListener } from './encrypted-data-listener.mjs'


const app = express();

app.use(express.json());

app.use('/', router); //to use the routes

function gracefulshutdown() {
    console.log("Shutting down");
    listener.close(() => {
        console.log("HTTP server closed.");      
        process.exit(0); 
    });
}

process.on("SIGTERM", gracefulshutdown);
process.on("SIGINT", gracefulshutdown);

const web3 = Web3.connection()
const eventListener = new EncryptedDataEventListener(web3)
  await eventListener.start()


const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
