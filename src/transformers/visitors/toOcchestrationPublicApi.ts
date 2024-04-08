// publicFunctionAPI.js

// Import necessaty dépendancies
const axios = require('axios'); // import axios from 'axios';
const config = require('config'); // import config from 'config';
const logger = require('./logger.mjs');

// URL de l'API pour appeler les fonctions publiques
const publicFunctionAPIUrl = config.publicFunctionAPIUrl; // Remplacez cela par l'URL réelle de votre API

// Fonction pour appeler une fonction publique d'un contrat intelligent
async function callPublicFunction(contractName, functionName, parameters) {
    try {
        const response = await axios.post(`${publicFunctionAPIUrl}/callFunction`, {
            contractName,
            functionName,
            parameters
        });
        return response.data;
    } catch (error) {
        logger.error('Erreur lors de l\'appel de la fonction publique :', error);
        throw new Error('Erreur lors de l\'appel de la fonction publique');
    }
}

// Fonction pour récupérer des données publiques d'un contrat intelligent
async function getPublicData(contractName, variableName) {
    try {
        const response = await axios.get(`${publicFunctionAPIUrl}/getData`, {
            params: {
                contractName,
                variableName
            }
        });
        return response.data;
    } catch (error) {
        logger.error('Erreur lors de la récupération de données publiques :', error);
        throw new Error('Erreur lors de la récupération de données publiques');
    }
}

// Export des fonctions pour les utiliser ailleurs dans votre projet
module.exports = {
    callPublicFunction,
    getPublicData
};
