/*
|--------------------------------------------------------------------------
| Global APP Init
|--------------------------------------------------------------------------
*/
    global.defaultDB = 'auth';
    global._directory_base = __dirname;
    global.config = {};
    config.app = require('./config/app.js');
    config.database = require('./config/database.js')[defaultDB][config.app.env];

/*
|--------------------------------------------------------------------------
| APP Setup
|--------------------------------------------------------------------------
*/
    //Node Modules 
    const bodyParser = require('body-parser');
    const express = require('express');
    const app = express();
    const mongoose = require('mongoose');
    const CronJob = require('cron').CronJob;
    const axios = require('axios');

    //utils
    const kafka = require(_directory_base + '/app/v1.2/utils/Kafka.js');
    const Cron = require(_directory_base + '/app/v1.2/utils/Cron.js');

/*
|--------------------------------------------------------------------------
| APP Init
|--------------------------------------------------------------------------
*/
    // Parse request of content-type - application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({extended: false}));

    // Parse request of content-type - application/json
    app.use(bodyParser.json());

    //Server Running Message
    let server = app.listen(parseInt(config.app.port[config.app.env]), () => {
        console.log('Server listening')
        console.log("\tStatus \t\t: OK");
        console.log( "\tService \t: " + config.app.name + " (" + config.app.env + ")" );
		console.log( "\tPort \t\t: " + config.app.port[config.app.env] );
    });
    const timeout = require('connect-timeout');
    //set timeout 5 minutes
    app.use(timeout('300s'));
    
    // Setup Database
	mongoose.Promise = global.Promise;
	mongoose.connect(config.database.url, {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        useFindAndModify: true,
		ssl: config.database.ssl
	}).then(() => {
		console.log("Database :");
		console.log("\tStatus \t\t: Connected");
		console.log("\tMongoDB URL \t: " + config.database.url + " (" + config.app.env + ")");
	}).catch(err => {
		console.log("Database :");
		console.log("\tDatabase Status : Not Connected");
		console.log("\tMongoDB URL \t: " + config.database.url + " (" + config.app.env + ")");
	});

/*
 |--------------------------------------------------------------------------
 | Routing
 |--------------------------------------------------------------------------
 */
    require( './routes/api.js' )( app );

/*
 |--------------------------------------------------------------------------
 | Kafka Consumer
 |--------------------------------------------------------------------------
 */
    kafka.consumer();
/*
 |--------------------------------------------------------------------------
 | Cron Job
 |--------------------------------------------------------------------------
 */
    //scheduling check target sampling dan inspection setiap 00:00
    new CronJob('10 0 * * *', async () => {
    // new CronJob('* * * * *', async () => {
        let url = config.app.url[config.app.env].microservice_point + '/api/v1.0/cron/daily-transaction';
        // let url = 'http://localhost:5016/api/v1.0/cron/daily-transaction';
        console.log(url);
        axios.get(url)
        .then(function (response) {
            // handle success
            console.log('success');
        })
        .catch(function (error) {
            // handle error
            console.log(error);
        });
    }, null, true, 'Asia/Jakarta');
    
    //scheduling check semua block diinspeksi setiap akhir bulan
    new CronJob('20 0 1 * *', async () => {
    // new CronJob('* * * * *', async () => {
        let url = config.app.url[config.app.env].microservice_point + '/api/v1.0/cron/block-inspected';
        console.log(url);
        // let url = 'http://localhost:5016/api/v1.0/cron/block-inspected';
        axios.get(url)
        .then(function (response) {
            // handle success
            console.log('success');
        })
        .catch(function (error) {
            // handle error
            console.log(error);
        });
    }, null, true, 'Asia/Jakarta');

    //scheduling hitung total point
    new CronJob('30 0 1 * *', async () => {
    // new CronJob('* * * * *', async () => {
        let url = config.app.url[config.app.env].microservice_point + '/api/v1.0/cron/monthly-point';
        // console.log(url);
        // let url = 'http://localhost:5016/api/v1.0/cron/monthly-point';
        axios.get(url)
        .then(function (response) {
            // handle success
            console.log('response');
        })
        .catch(function (error) {
            // handle error
            console.log(error);
        });
    }, null, true, 'Asia/Jakarta');
    