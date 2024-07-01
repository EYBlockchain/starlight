import express from 'express';
import router from "./api_routes.mjs"; // Importer les routes
import ServiceManager from './serviceManager.mjs'; // Importer ServiceManager

const app = express();
app.use(express.json());

const serviceManager = new ServiceManager();

serviceManager.init().then(() => {
  
  app.use((req, res, next) => { // this ligne to inject serviceManager to each http request (middleware express)
    req.serviceManager = serviceManager;
    next();
  });

  app.use('/', router); // Utiliser les routes

  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port);
  });

  function gracefulShutdown() {
    console.log('Shutting down');
    listener.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}).catch(err => {
  console.error('Error initializing ServiceManager:', err);
  process.exit(1);
});
